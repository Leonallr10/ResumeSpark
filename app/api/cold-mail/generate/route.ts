import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { LlmProvider } from "@/types/resume";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  provider: z.enum(["gemini", "groq", "claude"]),
  model: z.string().min(1).max(120),
  apiKey: z.string().optional(),
  formData: z.object({
    receiverName: z.string().optional(),
    companyName: z.string().optional(),
    role: z.string().optional(),
    skill: z.string().optional(),
    experience: z.string().optional(),
    achievement: z.string().optional(),
    portfolioLink: z.string().optional(),
    linkedinLink: z.string().optional(),
    githubLink: z.string().optional(),
    resumeLink: z.string().optional(),
  }),
  jd: z.string().optional(),
});

const ENV_KEY_MAP: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload." },
        { status: 400 },
      );
    }

    const { provider, model, formData, jd } = parsed.data;
    const apiKey = (parsed.data.apiKey || "").trim() || process.env[ENV_KEY_MAP[provider]];

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: `No ${provider} API key provided. Please configure it in settings.` },
        { status: 400 },
      );
    }

    const systemPrompt = `You are an expert career coach and cold email writer. Your task is to write a highly effective cold email for the user based on the provided Job Description (JD) and the user's profile details.
    
CRITICAL RULES FOR COLD EMAILS:
1. The Core Idea: A good cold email is not begging. It is a short, specific message that makes it easy for someone to help you.
2. Structure (The 5-part formula):
   - Context: Why you are reaching out. (e.g., I recently applied for the [Role] at [Company].)
   - Personalisation: Why this company/person. Do not use fake flattery like "I admire your company". Be specific.
   - Fit: Why your profile makes sense.
   - Proof: Proof of work (links to resume, project, portfolio, etc.). Adjectives like "hardworking" are not proof.
   - Clear ask: What you want them to do. (e.g., Would you be open to referring me if my profile looks relevant?)
3. Keep it concise, under 150-180 words. People are busy and will not read a long emotional story.
4. Do not say "I am passionate" or "I am hardworking". Show proof of work instead.
5. Provide a strong subject line that is specific, slightly different, and relevant to the receiver (e.g., "[Role] candidate with proof, not just CV" or "Interested in [Team] after working on [related area]"). Place the subject line at the very top, formatted as "Subject: [Your Subject Line]".
6. Do not include placeholders like "[Link]" if the user has provided the actual link. Use the user's provided links. If a link is missing, omit that part gracefully.

USER DETAILS:
- Receiver Name: ${formData.receiverName || "Hiring Manager"}
- Company Name: ${formData.companyName || "[Company]"}
- Target Role: ${formData.role || "[Role]"}
- Key Skills: ${formData.skill || "Not provided"}
- Experience: ${formData.experience || "Not provided"}
- Key Achievement: ${formData.achievement || "Not provided"}
- Portfolio: ${formData.portfolioLink || "Not provided"}
- LinkedIn: ${formData.linkedinLink || "Not provided"}
- GitHub: ${formData.githubLink || "Not provided"}
- Resume: ${formData.resumeLink || "Not provided"}

JOB DESCRIPTION (JD):
${jd || "No specific job description provided."}

Please generate the cold email now. Output ONLY the email text (starting with the Subject line). No other conversational filler.`;

    let generatedText = "";

    if (provider === "gemini") {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model,
        contents: systemPrompt,
        config: { temperature: 0.7, maxOutputTokens: 500 },
      });
      generatedText = result.text ?? "";
    } else if (provider === "groq") {
      const groq = new Groq({ apiKey });
      const result = await groq.chat.completions.create({
        model,
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 500,
      });
      generatedText = result.choices[0]?.message?.content ?? "";
    } else if (provider === "claude") {
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model,
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 500,
      });
      const textBlock = result.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );
      generatedText = textBlock?.text ?? "";
    } else {
      return NextResponse.json({ ok: false, error: "Unknown provider." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, email: generatedText.trim() });

  } catch (error) {
    console.error("Cold Mail API Error:", error);
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("401") || message.includes("Unauthorized") || message.includes("invalid")) {
      return NextResponse.json({ ok: false, error: "Invalid API key." }, { status: 401 });
    }

    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota")) {
      return NextResponse.json({ ok: false, error: "Quota exceeded. Try another provider or later." }, { status: 429 });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
