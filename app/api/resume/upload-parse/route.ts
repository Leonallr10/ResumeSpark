import { NextResponse } from "next/server";
import {
  isSupportedType,
  isImageType,
  extractDocxText,
  extractPdfText,
  cleanExtractedText,
  extractContactsViaRegex,
  isTextGarbledOrEmpty,
} from "@/lib/resume-extract";
import {
  hashFileBuffer,
  getCachedParse,
  setCachedParse,
} from "@/lib/resume-parse-cache";
import {
  resumeDocumentModelSchema,
  type ResumeDocumentModel,
} from "@/server/documents/resume-document-model";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5 MB maximum limit." },
        { status: 400 },
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const fileName = "name" in file ? (file as File).name : "resume";
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";

    // Determine type by MIME or extension
    const isPdf = mimeType === "application/pdf" || fileExt === "pdf";
    const isDocx =
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword" ||
      fileExt === "docx" ||
      fileExt === "doc";
    const isImg = isImageType(mimeType) || ["jpg", "jpeg", "png", "webp"].includes(fileExt);

    if (!isPdf && !isDocx && !isImg && !isSupportedType(mimeType)) {
      return NextResponse.json(
        {
          error: "Unsupported file format. Please upload a PDF (.pdf), Word document (.docx), or image (.png, .jpg, .webp).",
        },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 0: Check Cache by SHA-256 hash
    const fileHash = hashFileBuffer(buffer);
    const cachedModel = getCachedParse(fileHash);
    if (cachedModel) {
      return NextResponse.json({
        model: cachedModel,
        cached: true,
        hash: fileHash,
        confidence: 0.9,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "LLM API key is not configured on the server." }, { status: 500 });
    }

    let sourceText = "";
    let imageParts: Array<{ mimeType: string; data: string }> = [];

    // Step 1: Text extraction
    if (isImg) {
      const imgMime = mimeType.startsWith("image/") ? mimeType : `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;
      imageParts.push({
        mimeType: imgMime,
        data: buffer.toString("base64"),
      });
    } else if (isDocx) {
      sourceText = await extractDocxText(buffer);
    } else if (isPdf) {
      try {
        const extracted = await extractPdfText(buffer);
        sourceText = extracted.text;
      } catch (err) {
        console.error("Server PDF text extraction failed:", err);
        return NextResponse.json(
          { error: "Server PDF text extraction failed: " + (err instanceof Error ? err.stack || err.message : String(err)) },
          { status: 500 },
        );
      }
    }

    // Step 2: Clean the text
    const cleanedText = cleanExtractedText(sourceText);

    // Fallback: If text is empty or garbled and we don't have images
    const isGarbled = !isImg && isTextGarbledOrEmpty(cleanedText);
    if (isGarbled && !isImg) {
      return NextResponse.json(
        {
          error: "Could not extract readable text from this document. If this is a scanned PDF, please upload it as an image or use our client-side OCR scan.",
        },
        { status: 422 },
      );
    }

    // Step 3: Regex pass for contact info
    const regexContacts = extractContactsViaRegex(cleanedText);

    // Step 4: LLM extraction call with structured output
    const model = await extractWithLlmAndRetry({
      sourceText: cleanedText,
      imageParts,
      apiKey,
    });

    // Step 6: Merge regex fields over LLM fields (regex is ground truth for contacts)
    if (regexContacts.email) model.personalInfo.email = regexContacts.email;
    if (regexContacts.phone) model.personalInfo.phone = regexContacts.phone;
    if (regexContacts.linkedin) model.personalInfo.linkedin = regexContacts.linkedin;
    if (regexContacts.github) model.personalInfo.github = regexContacts.github;
    if (regexContacts.portfolio && !model.personalInfo.portfolio) {
      model.personalInfo.portfolio = regexContacts.portfolio;
    }

    // Save to Cache
    setCachedParse(fileHash, model);

    return NextResponse.json({
      model,
      cached: false,
      hash: fileHash,
      confidence: 0.9,
      usedLlm: true,
    });
  } catch (error) {
    console.error("Upload parse error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to parse resume file.",
      },
      { status: 500 },
    );
  }
}

/* ─────────────────────────── LLM Helpers with Retry ──────────────────────────── */

type ExtractLlmOptions = {
  sourceText: string;
  imageParts: Array<{ mimeType: string; data: string }>;
  apiKey: string;
};

async function extractWithLlmAndRetry({
  sourceText,
  imageParts,
  apiKey,
}: ExtractLlmOptions): Promise<ResumeDocumentModel> {
  const basePrompt = buildUploadParsePrompt(sourceText);

  // Attempt 1
  const result1 = await callGeminiJson(basePrompt, imageParts, apiKey);
  const parseResult1 = resumeDocumentModelSchema.safeParse(result1);

  if (parseResult1.success) {
    return parseResult1.data;
  }

  // Attempt 2 (Retry with validation feedback)
  console.warn("First LLM extraction attempt failed schema validation. Retrying with error details...");
  const errors = JSON.stringify(parseResult1.error.flatten());
  const retryPrompt = `${basePrompt}\n\nCRITICAL FIX: Your previous response failed Zod schema validation with the following errors:\n${errors}\n\nYou must return a valid JSON object matching the ResumeDocumentModel schema exactly. Fix every listed error.`;

  const result2 = await callGeminiJson(retryPrompt, imageParts, apiKey);
  const parseResult2 = resumeDocumentModelSchema.safeParse(result2);

  if (parseResult2.success) {
    return parseResult2.data;
  }

  throw new Error(`LLM output failed validation after retry: ${JSON.stringify(parseResult2.error.flatten().fieldErrors)}`);
}

async function callGeminiJson(
  prompt: string,
  imageParts: Array<{ mimeType: string; data: string }>,
  apiKey: string,
): Promise<unknown> {
  type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
  const parts: GeminiPart[] = [{ text: prompt }];

  for (const img of imageParts) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(55000),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleanedJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  return JSON.parse(cleanedJson);
}

function buildUploadParsePrompt(sourceText: string): string {
  return `You are an expert resume parser. Extract structured information from the provided resume into the exact JSON schema below.

CRITICAL RULES:
1. NEVER hallucinate or invent data. If an item or field is not present in the document, use empty string "" or empty array [].
2. Keep dates in original format (e.g., "08/2025 - 03/2026", "May 2022 - Present", "2024").
3. For bullet points, extract individual bullet items cleanly without leading symbols (no dashes or bullets in the string).
4. Categorize skills into logical groups (e.g. "Languages & Frameworks", "Tools & Platforms", "Databases").
5. Output ONLY the JSON object. Do not wrap in markdown or include conversational text.

SCHEMA:
{
  "version": "1.0.0",
  "templateId": "template-1",
  "personalInfo": {
    "fullName": "string",
    "headline": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "github": "string",
    "portfolio": "string",
    "website": "string"
  },
  "sectionTitles": {
    "summary": "Professional Summary",
    "experience": "Work Experience",
    "education": "Education",
    "skills": "Skills",
    "projects": "Projects",
    "achievements": "Achievements and Activities",
    "extras": "Achievements and Activities"
  },
  "summary": "string",
  "experience": [
    {
      "id": "exp-1",
      "company": "string",
      "role": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "bullets": ["string"],
      "technologies": ["string"]
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "institution": "string",
      "degree": "string",
      "field": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "gpa": "string",
      "bullets": ["string"]
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "title": "string",
      "subtitle": "string",
      "startDate": "string",
      "endDate": "string",
      "link": "string",
      "technologies": ["string"],
      "bullets": ["string"]
    }
  ],
  "skills": [
    {
      "id": "skill-1",
      "category": "string",
      "skills": ["string"]
    }
  ],
  "achievements": [
    {
      "id": "ach-1",
      "title": "string",
      "subtitle": "string",
      "date": "string",
      "description": "string",
      "bullets": ["string"]
    }
  ],
  "extras": [],
  "extrasLabel": "Achievements and Activities",
  "customSections": [],
  "metadata": {
    "targetRole": "",
    "targetCompany": "",
    "lastModified": "${new Date().toISOString()}",
    "lastFlow": "pdf"
  }
}

${
  sourceText
    ? `RESUME TEXT CONTENT:
---
${sourceText.slice(0, 18000)}
---`
    : ""
}`;
}
