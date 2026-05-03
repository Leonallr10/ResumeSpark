import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  suggestionRequestSchema,
  suggestionResponseSchema,
} from "@/lib/schemas";
import { getResumeText } from "@/lib/resume";
import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";
const GEMINI_SUGGESTION_MODELS = [
  "gemini-1.5-pro",
  "gemini-1.5-pro-latest",
  "gemini-pro",
] as const;

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

export async function POST(request: Request) {
  const parsedRequest = suggestionRequestSchema.safeParse(await request.json());

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const provider = parsedRequest.data.provider;
  const resolvedApiKey =
    parsedRequest.data.apiKey?.trim() || process.env[ENV_KEY_MAP[provider]];

  if (!resolvedApiKey) {
    return NextResponse.json(
      { error: `Missing ${provider} API key. Add it in settings or .env.local.` },
      { status: 500 },
    );
  }

  try {
    const prompt = buildResumeTailorPrompt(parsedRequest.data);
    let responseText: string;

    if (provider === "groq") {
      responseText = await generateWithGroq(resolvedApiKey, prompt, parsedRequest.data.model);
    } else if (provider === "claude") {
      responseText = await generateWithClaude(resolvedApiKey, prompt, parsedRequest.data.model);
    } else {
      const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
      const result = await generateWithRetry(ai, prompt, parsedRequest.data.model);
      responseText = result.text ?? "";
    }

    const parsedJson = parseGeminiJson(responseText);
    const validatedResponse = suggestionResponseSchema.parse(parsedJson);
    const safeResponse = filterInvalidTargets(validatedResponse, parsedRequest.data);

    return NextResponse.json(safeResponse);
  } catch (error) {
    const quotaError = isQuotaGeminiError(error);
    const retryableError = isRetryableGeminiError(error);
    const retryAfterSeconds = getRetryAfterSeconds(error);
    const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
    const message =
      error instanceof z.ZodError
        ? `${providerLabel} returned an invalid response shape.`
        : quotaError
          ? `${providerLabel} quota limit reached. Please retry shortly.`
        : retryableError
          ? `${providerLabel} is busy right now. Please retry in a moment.`
        : "Unable to generate resume suggestions.";

    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: quotaError ? 429 : retryableError ? 503 : 500,
        headers:
          quotaError || retryableError
            ? {
                "Retry-After": String(retryAfterSeconds ?? 4),
              }
            : undefined,
      },
    );
  }
}

async function generateWithGroq(apiKey: string, prompt: string, model?: string): Promise<string> {
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: model || "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert resume tailoring assistant. Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.25,
  });

  return response.choices[0]?.message?.content ?? "";
}

async function generateWithClaude(apiKey: string, prompt: string, model?: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: "You are an expert resume tailoring assistant. Return valid JSON only. Do not wrap the JSON in markdown code blocks.",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.25,
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  return textBlock?.text ?? "";
}

type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;
type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;

function buildResumeTailorPrompt(input: SuggestionRequest) {
  const sectionIndex = input.resumeSections
    .map((section) => {
      const lines = section.lines
        .map((line) => {
          const metadata = [
            `lineId=${line.id}`,
            `kind=${line.kind ?? "text"}`,
            typeof line.sourceLine === "number" ? `sourceLine=${line.sourceLine + 1}` : "",
            line.sourceText ? `latex=${line.sourceText}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          return `- ${metadata}\n  visibleText=${line.text}`;
        })
        .join("\n");

      return `sectionId=${section.id}\nsectionTitle=${section.title}\n${lines}`;
    })
    .join("\n\n");

  return `
You are an expert Technical Recruiter, Senior Software Engineer, and Resume Strategist. Tailor the uploaded resume for the target company, role, and job description using the PROJECT-FIRST methodology below. Output must be compatible with this app's inline LaTeX suggestion workflow.

You MUST work through these phases IN ORDER internally before writing JSON. Do not skip any phase.

=== PHASE 1: JD DECOMPOSITION ===
Before anything else, decompose the job description into this structured map:
JD_MAP:
  must_have_skills: [required technical skills explicitly stated in JD]
  good_to_have_skills: [preferred/bonus skills, "nice to have" items]
  action_verbs: [verbs the JD uses — e.g. "build", "design", "optimize", "architect", "implement", "develop"]
  domain_keywords: [domain terms — e.g. "scalable", "real-time", "microservices", "distributed", "cloud-native", "CI/CD"]
  role_focus: [what the role emphasizes — e.g. "frontend performance", "API design", "data pipelines", "full-stack"]
  seniority: [fresher / 0-2 yrs / mid / senior — inferred from years required and JD language]
  company_tone: [inferred from company name and JD style:
    FAANG/Big Tech = technical depth, scale, system design, efficiency
    Startup = builder mindset, ownership, shipped fast, versatility
    Product company = user impact, feature ownership, cross-functional collaboration
    AI/ML company = models, pipelines, data processing, metrics
    Enterprise/Consulting = reliability, compliance, stakeholder management]

=== PHASE 2: PROJECT-JD ALIGNMENT SCORING ===
For EACH project in both the existing resume AND the extra project input, compute a relevance score:
  score = 0
  +2 for each must_have_skill present in project's tech stack or description
  +1 for each good_to_have_skill present in project's tech stack or description
  +1 for each domain_keyword concept demonstrated by the project
  +2 if the project has measurable outcomes, metrics, or quantifiable results
  +1 if the project demonstrates the role_focus area

Rank ALL projects (resume + extra) by score, highest first.
- The highest-scoring projects go on the resume.
- If an extra project scores HIGHER than an existing resume project, REPLACE the weaker resume project with the stronger extra project using the full project replacement format.
- For the Projects section: select the top 1-2 projects by score. Highest-scoring project is listed FIRST.
- For Experience section: reorder bullets within each role to lead with highest-scoring content.

=== PHASE 3: BULLET CONSTRUCTION ENGINE ===
For each selected project and experience entry, construct or rewrite bullets using this exact formula:
  [JD Action Verb] + [What you built/did] + [Using JD-relevant tech] + [Outcome/Scale/Impact]

Bullet construction rules:
- Use action verbs FROM the JD_MAP.action_verbs (mirror the JD's exact language). If the JD says "build", use "Built". If it says "design", use "Designed".
- Replace generic user terms with JD's exact terminology:
    user says "made a login page" + JD says "authentication" → "Engineered secure authentication flow using JWT and session management"
    user says "used MongoDB" + JD says "scalable data storage" → "Designed scalable NoSQL data layer using MongoDB for flexible schema management"
    user says "reduced load time" + JD says "performance optimization" → "Optimized frontend load performance, reducing initial render time by X%"
- If the user provided a number/metric → ALWAYS include it in the bullet
- If no number exists → phrase impact qualitatively without fabricating (e.g. "improving query latency" not "reducing latency by 50%")
- Highest-relevance projects (score >= 6): 3 bullets
- Medium-relevance projects (score 3-5): 2 bullets
- Each bullet must be focused on ONE major achievement, system, or outcome — not a list of technologies
- Every bullet must use STAR format: action verb + technical method + measurable or qualitative result

=== PHASE 4: SKILLS SECTION CONSTRUCTION ===
Extract all technologies from selected projects and experience. Construct the skills section:
1. List JD must_have_skills FIRST within each category
2. Follow with good_to_have_skills that appear in resume/projects
3. Group by category matching the resume's existing format (e.g. Languages | Frameworks & Libraries | Tools & Technologies)
4. Remove skills not present in any selected project, experience, or extra project input
5. Do not add skills that the candidate hasn't demonstrated

=== PHASE 5: SUMMARY GENERATION ===
Generate the summary using this template pattern:
"[Role title from JD]-oriented [degree/background] with [experience descriptor] in [top 2-3 JD keywords drawn from projects]. [Most impressive project/achievement snippet]. [Value proposition for company or what candidate brings]."

Adjust tone based on JD_MAP.company_tone:
- FAANG/Big Tech: emphasize technical depth, system scale, algorithmic thinking, efficiency
- Startup: emphasize builder mindset, full-stack ownership, shipping fast, adaptability
- Product company: emphasize user impact, feature ownership, data-driven decisions
- AI/ML company: emphasize model development, data pipelines, ML metrics, research
- Enterprise: emphasize reliability, best practices, cross-team collaboration

=== PHASE 6: VALIDATION CHECKLIST ===
Before outputting JSON, verify ALL of these. If any check fails, revise the relevant suggestion:
✅ Every bullet starts with a verb from JD_MAP.action_verbs or an equivalent strong verb (Engineered, Architected, Spearheaded — not "Worked on", "Helped with", "Was responsible for")
✅ Top 5 JD keywords appear naturally across all bullets combined
✅ Highest-relevance project (by Phase 2 score) is listed first in Projects section
✅ No bullet is a bare tech list — each has verb + what was built + outcome
✅ Skills section leads with JD must_have_skills in each category row
✅ Summary mentions the exact role title and aligns with company_tone
✅ No fabricated metrics — only what user provided or extra project input contains
✅ ATS-safe: plain text bullets, no tables inside project section, standard LaTeX formatting
✅ Total content fits within one-page budget (~55-58 lines)
✅ Every content line fills exactly 1 full line (~90-100 chars) or 2 full lines (~185-200 chars) — zero half-filled lines

=== PHASE 7: LAYOUT DENSITY ENFORCEMENT ===
Core rule: Every line must be fully utilized. No orphan lines, no trailing whitespace, no half-filled bullets. The resume must look visually dense and professionally packed.

BULLET LINE DENSITY RULES (based on A4, 10.5pt, textwidth ~7.47in with 0.25in bullet indent):
- 1 FULL LINE = 90-100 characters (including spaces). Aim for 95 chars.
- 2 FULL LINES = 185-200 characters. Aim for 190 chars.
- DANGER ZONE = 100-185 characters — this produces 1.5 lines with an orphan word on the second line. NEVER produce bullets in this range.
- If a bullet is 100-140 chars: COMPRESS to under 100 by removing filler words, shortening phrases.
- If a bullet is 140-185 chars: EXPAND to 185+ by adding qualifying phrase, context, tech detail, or outcome.
- If a bullet is under 80 chars: ELABORATE by adding tech detail, scale context, or method to reach 90-100 chars.
- TARGET: Every bullet is either exactly 1 full line (90-100 chars) or exactly 2 full lines (185-200 chars). NEVER 1.5 lines.

EXPANSION STRATEGIES (how to fill the half line):
- Bullet ends mid-line → add "ensuring X outcome" or "to support Y use case"
- Tech mentioned but not explained → add "leveraging [tech] for [purpose]"
- No scale/context → add "across [N] modules / users / endpoints"
- Missing method → add "following [pattern] architecture" or "using [design principle]"
- Vague action → replace with specific verb + add tool/framework detail

WHITE SPACE SECTION RULES (priority order):
1. Elaborate existing bullets: pick the shortest bullet in that section, expand from 1 line → 2 lines using above strategies.
2. Add a new project: pull the next highest-relevance project from user's extra project list, construct 2-3 bullets using JD verbs, insert to fill remaining space.
3. Only if no extra project available: add a sub-section with 2-3 one-liner achievement highlights.

PAGE FILL TARGETS:
- For 1-page resume: content must fill 92-100% of the page. Bottom margin gap no more than 0.3 inch.
- Sparse = unconfident. Dense = prepared. Fill every line with purposeful, JD-aligned content — not padding, but elaboration that makes every project sound more complete.

FINAL DENSITY CHECKLIST:
✅ No bullet ends at 1.5 lines — all bullets are 1 or 2 full lines
✅ No section ends with visible white space gap
✅ If white space exists → bullet elaborated OR project added
✅ Every added word serves a purpose — no filler fluff
✅ Elaborations use JD keywords — density AND relevance together
✅ Page fill >= 92%

=== PHASE 8: OUTPUT AS JSON ===
Compress and finalize into concise line-level suggestions only. Do not include the analysis, a full rewritten resume, markdown, explanations outside JSON, or any extra response fields. Every bullet/content line MUST fill exactly 1 full line or exactly 2 full lines on the page — never half-filled lines with trailing whitespace.

ONE-PAGE BUDGET (CRITICAL — exceeding this causes overflow whitespace):
With A4, 10.5pt font, and the given margins, the resume has approximately 55-58 usable content lines. You MUST count your output and stay within budget. Rough allocation:
- Header: 4 lines (fixed, do not modify)
- Summary: 2-3 lines
- Skills: 4-5 lines (section header + 3 items)
- Experience: 18-22 lines total across ALL roles (each role heading = 2 lines + 2-4 bullets each). If 3 roles exist, aim for 3 bullets per role max. If content is too long, cut the LEAST relevant role's bullets first or remove the weakest role entirely.
- Projects: 5-7 lines (1 project with 2-3 bullets, or 2 compact projects with 2 bullets each)
- Education: 3 lines (fixed)
- Achievements: 4-5 lines (fixed)
If the total exceeds ~55 lines, you MUST suggest deleting weaker bullets or trimming long two-line bullets into one-line bullets. NEVER let the resume overflow to page 2 — page overflow creates large whitespace gaps on page 1 which is worse than having slightly fewer bullets.

Truthfulness and evidence rules:
- Return valid JSON only. Do not wrap it in markdown.
- CRITICAL: Every string value in the JSON must be a single line. Do NOT use literal newlines inside any JSON string — use a single space instead. All suggestedText, reason, and jdMatchReason values must be one continuous line with no line breaks.
- Do not invent companies, dates, degrees, titles, certifications, metrics, tools, achievements, responsibilities, scale, or experience.
- Use a JD keyword only when the resume or extra project input supports that skill or context.
- Use metrics only when they already appear in the resume or extra project input. If no metric is present, phrase impact qualitatively.
- New content may only be grounded in the uploaded resume or the user-provided extra projects. JD wording can guide priority and phrasing, not create unsupported facts.
- Do not exaggerate beyond a believable junior/student/project resume.
- If a missing JD requirement is not supported by the resume or extra project input, do not add it as a suggestion. Mention the gap in sectionReviews only when that section also has an actionable supported suggestion.

Suggestion quality rules:
- Review every resume section, field, and bullet point.
- Give suggestions only where the change improves JD match, clarity, keyword coverage, impact, technical depth, relevance, or one-page concision. Generate at least 2 to 3 distinct suggestion options per relevant section/project to give the user sufficient choices.
- Prioritize JD-critical content near the top of the resume when the existing structure allows it.
- Use the bullet construction formula from Phase 3. Emphasize business impact, system scale, and engineering excellence rather than just listing tasks.
- Follow STAR-style impact: action verb (from JD), technical method, result.
- Keep each bullet focused on one major achievement, system, feature, or measurable outcome.
- For one-page resumes, avoid half-empty generic lines. Merge short supported details into fuller one-line or two-line bullets without making them bloated.
- **CRITICAL LINE-FILL RULE:** Every bullet point, summary sentence, and skill row MUST occupy exactly a full 1 line or a full 2 lines on the rendered page. NEVER leave a line half-filled with trailing whitespace. CHARACTER BUDGET: 1 full line = 90-100 chars, 2 full lines = 185-200 chars. DANGER ZONE: 100-185 chars produces 1.5 lines (orphan word on second line) — NEVER produce bullets in this range. If content is 100-140 chars, COMPRESS to under 100. If content is 140-185 chars, EXPAND to 185+. The goal is zero visible whitespace gaps — every line of content must run edge-to-edge.
- Prefer concrete engineering language over generic recruiter phrases.
- Reorder skill text to match JD priority (Phase 4 ordering) when editing a skills row.
- Remove or replace duplicated, vague, or low-relevance content when a stronger supported line exists.
- If a section or line is already strong and needs no edit, do not mention it in suggestions or sectionReviews.

App compatibility rules:
- Preserve this exact JSON contract. Do not add fields such as jdAnalysis, gapAnalysis, optimizedResume, or keyImprovements.
- Each suggestedText must be one resume-ready line only. Do not put multiple bullets, paragraphs, section blocks, or newline-separated content into one suggestion.
- Keep suggestedText compact enough to fit a one-page resume. Each bullet MUST fill exactly 1 full line (~90-100 chars) or exactly 2 full lines (~185-200 chars) on an A4 page at 10.5pt font. Never produce half-filled lines — no trailing whitespace gaps.
- Every suggestion must target an existing lineId and sectionId from the resume.
- Preserve the target line kind. Do not turn company names, project names, education names, dates, locations, or role headings into achievement bullets.
- For kind=subheading, only improve the company/project/school heading text. Do not put a bullet, sentence, achievement, metric, tool list, or period-ending paragraph into suggestedText.
- For kind=projectHeading, only improve the project title. Do not put project explanation bullets into suggestedText.
- For kind=text skill rows that look like "Label: values", return the same label once followed by improved values, matching the exact format of the original resume (e.g., "Programming Languages: JavaScript, TypeScript, Python"). Do not duplicate the old values.
- Ensure any tech stack content exactly aligns with the template of the resume given by the user. Match the existing prefixes and formatting.
- For kind=bullet, return only the bullet body text without a leading bullet symbol. Keep one concise achievement per suggestion.
- Insertions should target existing bullet lines only. Do not insert raw text around subheading/projectHeading structural lines.
- Deletions should target duplicated or weak bullet/text lines only. Do not delete subheading/projectHeading structural lines.
- For missing JD requirements, suggest insertion only if supported by existing resume text or extra project input.
- Prefer project replacements when the JD asks for backend APIs, relational databases, Django/Flask/FastAPI, authentication, testing, Docker, Kubernetes, or distributed systems and the existing project is less relevant than a supported extra project.

PROJECT REPLACEMENT AND ADDITION RULES (CRITICAL):
- **ONE project per block.** NEVER mix bullet points from different projects under a single project heading. Each project heading must only have bullets describing THAT specific project.
- **FULL PROJECT REPLACEMENT FORMAT:** When replacing an existing project with a different one from extra project input, send exactly ONE suggestion with action "replace" targeting the subheading line (kind=subheading) of the project being replaced. The suggestedText MUST use this exact format:
  Project | heading:NEW PROJECT NAME | tech:Tech1, Tech2, Tech3 | dates:Start -- End | link:https://url-here | detail:First bullet point about this project;;Second bullet point about this project;;Third bullet point about this project
  Rules for this format:
  - "Project |" prefix is required (case-insensitive)
  - All fields (heading, tech, dates, link, detail) must be included
  - Use ";;" to separate multiple bullet points in the detail field
  - Include exactly 2-3 bullet points in detail, each being a full achievement sentence
  - The link field can be empty if no link exists (link:)
  - This ONE suggestion replaces the ENTIRE project block (heading + tech stack + dates + all bullets)
  - Do NOT send separate suggestions for the tech stack line or bullet lines when doing a full project replacement
  Example: Project | heading:Task Management System | tech:Java, Spring Boot, MongoDB, Docker, Kubernetes, React, TypeScript | dates:Feb 2025 -- Feb 2025 | link:https://github.com/example | detail:Built a full-stack task management platform with React/TypeScript frontend and Spring Boot REST API backend for task lifecycle management;;Designed RESTful APIs integrated with MongoDB to persist task details, owners, shell commands, and execution history with timestamped output tracking;;Implemented Kubernetes-based command execution by dynamically creating pods to run task commands in isolated container environments
- **UPDATING an existing project (not replacing):** Only modify individual bullet lines using "replace" action on those specific bullet lines. Do not change heading or tech stack unless the tech stack needs JD keyword reordering.
- NEVER put a project title, date, or tech stack inside a bullet point. These belong in the subheading/techstack lines only.
- NEVER combine multiple projects into one block. If you want to add 2 projects, you need 2 separate complete project blocks.
- Each project must have exactly 2-3 focused bullet points about THAT project's achievements only.
- sectionReviews must include only sections that have actionable suggestions. Do not return "strong" reviews for unchanged sections.
- Keep reason and jdMatchReason short, specific, and useful. reason explains resume quality impact; jdMatchReason names the JD requirement or keyword match.

Return this exact JSON shape:
{
  "suggestions": [
    {
      "id": "short-unique-id",
      "targetLineId": "existing line id",
      "sectionId": "existing section id",
      "action": "replace | insert_before | insert_after | delete",
      "originalText": "existing target line text when useful",
      "suggestedText": "new or replacement resume text. Empty string only for delete.",
      "reason": "why this improves the resume",
      "jdMatchReason": "which JD need this supports"
    }
  ],
  "sectionReviews": [
    {
      "sectionId": "existing section id",
      "status": "strong | needs_changes | missing_jd_keywords | not_relevant",
      "summary": "short review of this section against the JD"
    }
  ]
}

Target company and role:
${input.companyRole}

Job description:
${input.jd}

Extra project input:
${input.project}

Resume as plain text:
${getResumeText(input.resumeSections)}

Resume sections with stable IDs:
${sectionIndex}
`.trim();
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!cleaned) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fix unescaped newlines/tabs inside JSON string values
    const fixed = cleaned.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
    );

    try {
      return JSON.parse(fixed);
    } catch {
      // Attempt to recover truncated JSON by closing open structures
      const recovered = recoverTruncatedJson(fixed);
      return JSON.parse(recovered);
    }
  }
}

function recoverTruncatedJson(text: string): string {
  // If JSON is truncated mid-response, try to close it gracefully
  let recovered = text;

  // If we're inside an unterminated string, close it
  const quoteCount = (recovered.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    recovered += '"';
  }

  // Count open braces/brackets and close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;

  for (let i = 0; i < recovered.length; i++) {
    const ch = recovered[i];
    if (ch === '"' && (i === 0 || recovered[i - 1] !== '\\')) {
      inString = !inString;
    }
    if (!inString) {
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
    }
  }

  // Remove trailing comma before closing
  recovered = recovered.replace(/,\s*$/, "");

  // Close any open object properties that are incomplete
  // e.g. truncated at "key": or "key": "val
  const trailingIncomplete = recovered.match(/,?\s*"[^"]*"\s*:\s*$/);
  if (trailingIncomplete) {
    recovered += '""';
  }

  for (let i = 0; i < openBrackets; i++) recovered += "]";
  for (let i = 0; i < openBraces; i++) recovered += "}";

  return recovered;
}

function filterInvalidTargets(response: SuggestionResponse, input: SuggestionRequest) {
  const validSections = new Set(input.resumeSections.map((section) => section.id));
  const lineById = new Map(
    input.resumeSections.flatMap((section) =>
      section.lines.map((line) => [line.id, line] as const),
    ),
  );
  const suggestions = response.suggestions.filter((suggestion) => {
    const targetLine = lineById.get(suggestion.targetLineId);

    if (!targetLine || !validSections.has(suggestion.sectionId)) {
      return false;
    }

    if (
      (targetLine.kind === "subheading" || targetLine.kind === "projectHeading") &&
      (suggestion.action === "delete" ||
        suggestion.action === "insert_before" ||
        suggestion.action === "insert_after" ||
        (looksLikeBulletText(suggestion.suggestedText) &&
          !isProjectReplacementFormat(suggestion.suggestedText)))
    ) {
      return false;
    }

    if (
      suggestion.action !== "replace" &&
      targetLine.kind !== "bullet" &&
      targetLine.kind !== "text" &&
      !isProjectReplacementFormat(suggestion.suggestedText)
    ) {
      return false;
    }

    return true;
  });
  const suggestedSections = new Set(suggestions.map((suggestion) => suggestion.sectionId));

  return {
    suggestions,
    sectionReviews: response.sectionReviews.filter((review) => {
      if (!validSections.has(review.sectionId) || review.status === "strong") {
        return false;
      }

      return suggestedSections.has(review.sectionId);
    }),
  };
}


function isProjectReplacementFormat(text: string) {
  const normalized = text.trim().toLowerCase();
  return (
    /^project\s*\|/.test(normalized) &&
    normalized.includes("heading:") &&
    normalized.includes("detail:")
  );
}

function looksLikeBulletText(value: string) {
  const text = value.trim();

  return (
    text.length > 120 ||
    /[.!?]$/.test(text) ||
    /^(built|developed|engineered|implemented|architected|optimized|resolved|introduced|created|designed|integrated)\b/i.test(
      text,
    )
  );
}

async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  preferredModel?: string,
) {
  const delaysMs = [1200, 2500];
  let lastRetryableOrQuotaError: unknown;
  const modelsToTry = preferredModel
    ? [preferredModel, ...GEMINI_SUGGESTION_MODELS.filter((model) => model !== preferredModel)]
    : [...GEMINI_SUGGESTION_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: suggestionResponseJsonSchema,
            temperature: 0.25,
          },
        });
      } catch (error) {
        if (isUnsupportedModelError(error)) {
          // Skip models unavailable for this account/version and continue fallback.
          break;
        }

        if (isQuotaGeminiError(error)) {
          // Quota can be model-specific, so try the next fallback model immediately.
          lastRetryableOrQuotaError = error;
          break;
        }

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        lastRetryableOrQuotaError = error;

        if (attempt < delaysMs.length) {
          await delay(delaysMs[attempt]);
        }
      }
    }
  }

  throw lastRetryableOrQuotaError ?? new Error("Gemini returned a retryable failure.");
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('"code":503') ||
    message.includes("503") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand")
  );
}

function isQuotaGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes('"code":429') ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limit") ||
    normalized.includes("exceeded your current quota")
  );
}

function isUnsupportedModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    message.includes('"code":404') ||
    message.includes("NOT_FOUND") ||
    normalized.includes("not supported for generatecontent") ||
    normalized.includes("model is not found")
  );
}

function getRetryAfterSeconds(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);

  if (retryDelayMatch) {
    return Number.parseInt(retryDelayMatch[1], 10);
  }

  const retryInMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);

  if (retryInMatch) {
    return Math.max(1, Math.ceil(Number.parseFloat(retryInMatch[1])));
  }

  return undefined;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const suggestionResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "sectionReviews"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "targetLineId",
          "sectionId",
          "action",
          "suggestedText",
          "reason",
          "jdMatchReason",
        ],
        properties: {
          id: { type: "string" },
          targetLineId: { type: "string" },
          sectionId: { type: "string" },
          action: {
            type: "string",
            enum: ["replace", "insert_before", "insert_after", "delete"],
          },
          originalText: { type: "string" },
          suggestedText: { type: "string" },
          reason: { type: "string" },
          jdMatchReason: { type: "string" },
        },
      },
    },
    sectionReviews: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sectionId", "status", "summary"],
        properties: {
          sectionId: { type: "string" },
          status: {
            type: "string",
            enum: ["strong", "needs_changes", "missing_jd_keywords", "not_relevant"],
          },
          summary: { type: "string" },
        },
      },
    },
  },
};
