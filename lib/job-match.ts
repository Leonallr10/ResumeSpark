import type { ResumeSection } from "@/types/resume";
import type { JobMatchKeyword, JobMatchResult, AtsScoreBreakdown } from "@/types/job-match";

// ─── LaTeX text stripping ──────────────────────────────────────────────────────

/**
 * Strip LaTeX markup from a raw LaTeX string and return clean readable text.
 * Applied iteratively to handle nested commands like \textbf{\textit{...}}.
 */
export function stripLatexCommands(raw: string): string {
  let s = raw;

  // Remove % comments (LaTeX line comments)
  s = s.replace(/%[^\n]*/g, "");

  // Remove environments \begin{...}...\end{...} control sequences (just the markers)
  s = s.replace(/\\begin\{[^}]+\}/g, "");
  s = s.replace(/\\end\{[^}]+\}/g, "");

  // Convert resume-specific commands that have visible content
  // Run multiple passes to handle nesting
  for (let pass = 0; pass < 4; pass++) {
    // resumeItem → bullet text
    s = s.replace(/\\resumeItem\{((?:[^{}]|\{[^{}]*\})*)\}/g, "• $1");
    s = s.replace(/\\resumeItemNoBullet\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\resumeSubItem\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1: $2");

    // resumeSubheading / resumeProjectHeading
    s = s.replace(
      /\\resumeSubheading\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g,
      "$1  $2 | $3 | $4"
    );
    s = s.replace(
      /\\resumeProjectHeading\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g,
      "$1  $2"
    );

    // achievementEntry (3-arg)
    s = s.replace(
      /\\achievementEntry\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g,
      "$1 $2 $3"
    );

    // Text formatting – strip the wrapper but keep content
    s = s.replace(/\\textbf\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\textit\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\emph\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\small\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\large\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\techstack\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\href\{[^}]+\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
    s = s.replace(/\\url\{[^}]+\}/g, "");

    // Generic cmd{content} → content (for remaining unknown commands)
    s = s.replace(/\\[a-zA-Z]+\*?\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
  }

  // Remove section headings (already captured as titles)
  s = s.replace(/\\section\*?\{[^}]*\}/g, "");

  // Remove remaining standalone LaTeX commands
  s = s.replace(/\\[a-zA-Z]+\*?\s*/g, " ");

  // Clean LaTeX special characters
  s = s.replace(/\\\\/g, "\n"); // \\ → newline
  s = s.replace(/\{|\}/g, ""); // bare braces
  s = s.replace(/\$[^$]*\$/g, ""); // inline math
  s = s.replace(/~\s*/g, " "); // non-breaking space
  s = s.replace(/\\&/g, "&");
  s = s.replace(/\\%/g, "%");
  s = s.replace(/\\#/g, "#");
  s = s.replace(/\\_/g, "_");
  s = s.replace(/--+/g, "–");
  s = s.replace(/``|''/g, '"');
  s = s.replace(/\|/g, " | ");

  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/**
 * Extract sections and clean text directly from raw LaTeX source.
 * More reliable than relying on AST-based parseLatexResume for text content.
 */
export function extractLatexSections(
  latexCode: string
): { title: string; lines: string[] }[] {
  // Get the document body (between \begin{document} and \end{document})
  const docMatch = latexCode.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const body = docMatch ? docMatch[1] : latexCode;

  // Find all \section{Title} markers
  const sectionRegex = /\\section\*?\{([^}]+)\}/g;
  const sectionPositions: { title: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(body)) !== null) {
    sectionPositions.push({ title: stripLatexCommands(m[1]), index: m.index });
  }

  const result: { title: string; lines: string[] }[] = [];

  // Header section (content before first \section{})
  const headerEnd = sectionPositions[0]?.index ?? body.length;
  const headerRaw = body.slice(0, headerEnd);
  const headerClean = stripLatexCommands(headerRaw);
  const headerLines = headerClean
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  if (headerLines.length > 0) {
    result.push({ title: "Header", lines: headerLines });
  }

  // Each \section{} block
  for (let i = 0; i < sectionPositions.length; i++) {
    const start = sectionPositions[i].index;
    const end = sectionPositions[i + 1]?.index ?? body.length;
    const sectionRaw = body.slice(start, end);
    const sectionClean = stripLatexCommands(sectionRaw);
    const lines = sectionClean
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 1);

    result.push({
      title: sectionPositions[i].title,
      lines,
    });
  }

  return result;
}

// ─── Keyword lists ─────────────────────────────────────────────────────────────

const ACTION_VERBS = new Set([
  "developed","built","designed","implemented","architected","led","managed",
  "created","delivered","improved","optimized","scaled","reduced","increased",
  "automated","migrated","deployed","launched","collaborated","mentored",
  "analyzed","established","enhanced","streamlined","integrated","maintained",
  "refactored","engineered","coordinated","spearheaded","drove","accelerated",
  "negotiated","presented","resolved","transformed","introduced","authored",
  "modeled","generated","monitored","configured","debugged","tested","shipped",
  "identified","designed","built","architected","engineered","implemented",
  "integrated","launched","optimized","contributed","developed","led",
]);

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","was","are","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "can","that","this","these","those","it","its","we","our","you","your",
  "they","their","i","my","he","she","him","her","us","as","if","so","not",
  "no","all","more","also","into","than","then","them","what","when","who",
  "which","there","here","how","about","other","any","each","both","same",
  "such","very","just","work","working","years","year","experience","ability",
  "strong","excellent","good","great","best","high","well","etc","via",
  "including","through","using","within","across","without","under","over",
]);

// Technology & tool patterns
const TECH_PATTERNS: RegExp[] = [
  /\b(python|javascript|typescript|java|kotlin|swift|go|golang|rust|c\+\+|c#|ruby|php|scala|r|dart|elixir|haskell|perl|matlab|bash|powershell)\b/gi,
  /\b(react|angular|vue|next\.?js|nuxt|svelte|ember|backbone|express|fastapi|django|flask|spring|rails|laravel|nestjs|gatsby)\b/gi,
  /\b(node\.?js|deno|bun)\b/gi,
  /\b(aws|gcp|azure|cloud|lambda|s3|ec2|rds|dynamo|cloudfront|cloudwatch|ecs|eks|fargate|sqs|sns|kinesis|bigquery|gke|vercel|netlify|heroku)\b/gi,
  /\b(docker|kubernetes|k8s|helm|terraform|ansible|chef|puppet|jenkins|gitlab|github actions|circleci|argo|istio|envoy)\b/gi,
  /\b(postgresql|mysql|sqlite|mongodb|redis|elasticsearch|cassandra|neo4j|dynamodb|firestore|supabase|prisma|sequelize|typeorm|sqlalchemy|hibernate)\b/gi,
  /\b(graphql|rest|grpc|soap|oauth|jwt|openapi|swagger|websocket|http\/2|protobuf)\b/gi,
  /\b(kafka|rabbitmq|celery|airflow|spark|hadoop|flink|beam|pubsub|nats|mqtt)\b/gi,
  /\b(git|github|gitlab|bitbucket|jira|confluence|linear|notion|figma|postman|datadog|grafana|prometheus|splunk|new relic|sentry|pagerduty)\b/gi,
  /\b(machine learning|deep learning|nlp|neural network|tensorflow|pytorch|scikit-learn|pandas|numpy|keras|hugging face|langchain|llm|gpt|bert|rag|faiss|pinecone|qdrant|chroma|pgvector|openai|anthropic|gemini|mistral|llama|ollama)\b/gi,
  /\b(microservices|monolith|serverless|event-driven|soa|api gateway|service mesh|cqrs|event sourcing|saga|circuit breaker)\b/gi,
  /\b(agile|scrum|kanban|devops|devsecops|sre|ci\/cd|tdd|bdd|pair programming|code review)\b/gi,
  /\b(ios|android|flutter|react native|xamarin|ionic|cordova|expo)\b/gi,
  /\b(pydantic|langgraph|langchain|fastapi|uvicorn|celery|dramatiq|sqlmodel|alembic)\b/gi,
  /\b(vector database|embedding|semantic search|retrieval augmented|prompt engineering|fine-tuning|inference|token|context window)\b/gi,
];

const SOFT_SKILL_PATTERNS: RegExp[] = [
  /\b(leadership|collaboration|communication|teamwork|problem.?solving|critical.?thinking|adaptability|creativity|innovation)\b/gi,
  /\b(time management|project management|stakeholder|cross.?functional|presentation|mentoring|coaching|strategic|initiative|ownership)\b/gi,
];

const QUALIFICATION_PATTERNS: RegExp[] = [
  /\b(\d+\+?\s*years?\s+(?:of\s+)?(?:experience|expertise))\b/gi,
  /\b(bachelor'?s?|master'?s?|phd|doctorate|degree|bs|ms|mba|btech|mtech)\b/gi,
  /\b(certified|certification|aws certified|google certified|cka|cks|ckad|cissp|pmp|itil)\b/gi,
];

// ─── Extraction helpers ────────────────────────────────────────────────────────

function extractKeywordsFromJd(jd: string): Omit<JobMatchKeyword, "found" | "resumeSection">[] {
  const results: Omit<JobMatchKeyword, "found" | "resumeSection">[] = [];
  const seen = new Set<string>();

  function addKeyword(raw: string, category: JobMatchKeyword["category"]) {
    const kw = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!kw || kw.length < 2 || seen.has(kw)) return;
    seen.add(kw);
    results.push({ keyword: kw, category });
  }

  // Technical keywords via patterns
  for (const pattern of TECH_PATTERNS) {
    const matches = Array.from(jd.matchAll(new RegExp(pattern.source, "gi")));
    for (const m of matches) {
      const raw = m[0].replace(/\s+/g, " ").toLowerCase();
      addKeyword(raw, "technical");
    }
  }

  // Soft skills
  for (const pattern of SOFT_SKILL_PATTERNS) {
    const matches = Array.from(jd.matchAll(new RegExp(pattern.source, "gi")));
    for (const m of matches) addKeyword(m[0], "soft");
  }

  // Qualifications
  for (const pattern of QUALIFICATION_PATTERNS) {
    const matches = Array.from(jd.matchAll(new RegExp(pattern.source, "gi")));
    for (const m of matches) addKeyword(m[0], "qualification");
  }

  // Domain keywords — capitalized noun phrases
  const domainPattern = /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){0,2})\b/g;
  const domainMatches = Array.from(jd.matchAll(domainPattern));
  for (const m of domainMatches) {
    const words = m[1].split(/\s+/);
    if (words.some((w) => STOP_WORDS.has(w.toLowerCase()))) continue;
    if (words.length === 1 && m[1].length < 4) continue;
    if (!seen.has(m[1].toLowerCase())) {
      addKeyword(m[1], "domain");
    }
  }

  return results;
}

/**
 * Build clean resume text from sections, using sourceText (raw LaTeX) stripped
 * of commands as fallback when line.text is empty. This handles the case where
 * the unified-latex parser doesn't auto-gobble arguments for custom commands.
 */
function buildResumeText(sections: ResumeSection[]): string {
  return sections
    .map((s) => {
      const lines = s.lines
        .map((l) => {
          // Prefer parsed text, fall back to stripped sourceText
          const text = l.text?.trim() || stripLatexCommands(l.sourceText ?? "");
          const right = l.rightText?.trim() || "";
          const secondary = l.secondaryText?.trim() || "";
          return [text, right, secondary].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join("\n");
      return `${s.title}\n${lines}`;
    })
    .join("\n\n");
}

function matchKeywordsInResume(
  keywords: Omit<JobMatchKeyword, "found" | "resumeSection">[],
  sections: ResumeSection[],
  resumeText: string
): JobMatchKeyword[] {
  return keywords.map((kw) => {
    const needle = kw.keyword.toLowerCase();
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");

    if (regex.test(resumeText)) {
      let foundSection: string | undefined;
      for (const section of sections) {
        const sectionText = section.lines
          .map((l) => {
            const t = l.text?.trim() || stripLatexCommands(l.sourceText ?? "");
            return [t, l.rightText, l.secondaryText].filter(Boolean).join(" ");
          })
          .join(" ");
        if (regex.test(sectionText)) {
          foundSection = section.title;
          break;
        }
      }
      return { ...kw, found: true, resumeSection: foundSection };
    }

    return { ...kw, found: false };
  });
}

// ─── ATS Score calculation ─────────────────────────────────────────────────────

function computeAtsScore(
  allKeywords: JobMatchKeyword[],
  resumeText: string,
): { score: number; breakdown: AtsScoreBreakdown } {
  const matched = allKeywords.filter((k) => k.found);
  const total = allKeywords.length || 1;

  // 1. Keyword match rate (40% weight)
  const keywordMatch = Math.round((matched.length / total) * 100);

  // 2. Skill alignment — technical + tool keywords (25% weight)
  const techTotal = allKeywords.filter((k) => k.category === "technical" || k.category === "tool").length || 1;
  const techMatched = matched.filter((k) => k.category === "technical" || k.category === "tool").length;
  const skillAlignment = Math.round((techMatched / techTotal) * 100);

  // 3. Formatting quality heuristics (15% weight)
  let formattingScore = 60;
  if (/experience|work/i.test(resumeText)) formattingScore += 10;
  if (/skills|technologies/i.test(resumeText)) formattingScore += 10;
  if (/education/i.test(resumeText)) formattingScore += 10;
  if (/projects/i.test(resumeText)) formattingScore += 10;
  formattingScore = Math.min(100, formattingScore);

  // 4. Action verbs (10% weight)
  const words = resumeText.toLowerCase().split(/\s+/);
  const actionVerbCount = words.filter((w) => ACTION_VERBS.has(w)).length;
  const actionVerbScore = Math.min(100, Math.round((actionVerbCount / Math.max(words.length / 30, 1)) * 100));

  // 5. Experience depth — numbers/metrics (10% weight)
  const metricCount = (resumeText.match(/\d+%|\d+x|\$\d+|\d+k|\d+m|\d+\+?\s*(users|customers|systems|services|projects|repos|ms|s\b)/gi) || []).length;
  const experienceDepth = Math.min(100, Math.round(metricCount * 12));

  const breakdown: AtsScoreBreakdown = {
    keywordMatch,
    skillAlignment,
    formattingQuality: formattingScore,
    actionVerbs: actionVerbScore,
    experienceDepth,
  };

  const score = Math.round(
    keywordMatch * 0.40 +
    skillAlignment * 0.25 +
    formattingScore * 0.15 +
    actionVerbScore * 0.10 +
    experienceDepth * 0.10
  );

  return { score: Math.min(100, score), breakdown };
}

// ─── Main public API ───────────────────────────────────────────────────────────

/**
 * Analyze resume against a job description.
 * @param sections - Resume sections from parseLatexResume (used for structure + section names)
 * @param jd - Raw job description text
 * @param latexCode - (Optional) raw LaTeX source; when provided, extracted text is used
 *                    for matching even if line.text is empty.
 */
export function analyzeJobMatch(
  sections: ResumeSection[],
  jd: string,
  latexCode?: string,
): JobMatchResult {
  // Build resume text — use latexCode-extracted text if sections produce empty content
  let resumeText = buildResumeText(sections);

  // Fallback: if sections produced little text, extract directly from raw LaTeX
  if (latexCode && resumeText.replace(/\s/g, "").length < 100) {
    const latexSections = extractLatexSections(latexCode);
    resumeText = latexSections.map((s) => `${s.title}\n${s.lines.join("\n")}`).join("\n\n");
  }

  const rawKeywords = extractKeywordsFromJd(jd);
  const allKeywords = matchKeywordsInResume(rawKeywords, sections, resumeText);

  const matchedKeywords = allKeywords.filter((k) => k.found);
  const missingKeywords = allKeywords.filter((k) => !k.found);

  const { score: atsScore, breakdown: atsBreakdown } = computeAtsScore(allKeywords, resumeText);
  const matchRate = allKeywords.length > 0
    ? Math.round((matchedKeywords.length / allKeywords.length) * 100)
    : 0;

  return {
    totalExtracted: allKeywords.length,
    matchedCount: matchedKeywords.length,
    matchRate,
    atsScore,
    atsBreakdown,
    matchedKeywords,
    missingKeywords,
    allKeywords,
    resumeText,
  };
}

/**
 * Highlight matched keywords inside a text string.
 * Returns an array of segments: `{ text, highlight }`.
 */
export function highlightKeywordsInText(
  text: string,
  keywords: string[],
): Array<{ text: string; highlight: boolean; keyword?: string }> {
  if (!keywords.length || !text) return [{ text, highlight: false }];

  const escaped = keywords
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const isHighlight = escaped.some((kw) =>
        new RegExp(`^${kw}$`, "i").test(part)
      );
      return {
        text: part,
        highlight: isHighlight,
        keyword: isHighlight ? part.toLowerCase() : undefined,
      };
    });
}
