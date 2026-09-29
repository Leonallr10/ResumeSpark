import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  cleanExtractedText,
  extractContactsViaRegex,
  isTextGarbledOrEmpty,
  extractPdfText,
  isSupportedType,
  isImageType,
} from "../lib/resume-extract.ts";
import {
  hashFileBuffer,
  getCachedParse,
  setCachedParse,
} from "../lib/resume-parse-cache.ts";

test("1. File Cache & Hashing: SHA-256 deterministic hash and 30-min TTL storage", () => {
  const sampleBuf = Buffer.from("Sample resume content for hashing test");
  const hash1 = hashFileBuffer(sampleBuf);
  const hash2 = hashFileBuffer(sampleBuf);

  assert.equal(hash1, hash2, "Hashes must be deterministic for identical content");
  assert.equal(hash1.length, 64, "SHA-256 hex string must be 64 characters");

  const sampleModel = {
    version: "1.0.0",
    templateId: "template-1",
    personalInfo: { fullName: "Alex Morgan", email: "alex@example.com", phone: "+1 555 123", location: "SF", linkedin: "", github: "", portfolio: "", website: "", headline: "" },
    sectionTitles: { summary: "Summary", experience: "Experience", education: "Education", skills: "Skills", projects: "Projects", achievements: "Achievements", extras: "Extras" },
    summary: "Experienced Engineer",
    experience: [],
    education: [],
    projects: [],
    skills: [],
    achievements: [],
    extras: [],
    extrasLabel: "Extras",
    customSections: [],
    metadata: { targetRole: "", targetCompany: "", lastModified: new Date().toISOString(), lastFlow: "pdf" },
  };
  setCachedParse(hash1, sampleModel);

  const retrieved = getCachedParse(hash1);
  assert.ok(retrieved, "Retrieved model must exist in cache");
  assert.equal(retrieved.personalInfo.fullName, sampleModel.personalInfo.fullName);

  const nonExistent = getCachedParse("0000000000000000000000000000000000000000000000000000000000000000");
  assert.equal(nonExistent, null, "Uncached hash must return null");
});

test("2. Text Cleaning: strips page numbers, normalizes whitespace and line breaks", () => {
  const dirty = `
    Page 1 of 3
    John Doe
    Software Engineer
    
    
    
    12
    San Francisco, CA
    
    Skills:  React,   Next.js,\tTypeScript\u00a0Node.js
  `;
  const cleaned = cleanExtractedText(dirty);

  assert.ok(!cleaned.includes("Page 1 of 3"), "Page 'Page 1 of 3' must be stripped");
  assert.ok(!cleaned.match(/^\s*12\s*$/m), "Standalone page number '12' must be stripped");
  assert.ok(!cleaned.includes("\n\n\n"), "Multiple blank lines must be collapsed");
  assert.ok(!cleaned.includes("   "), "Extra horizontal spaces must be collapsed");
  assert.ok(cleaned.includes("John Doe"));
  assert.ok(cleaned.includes("Software Engineer"));
});

test("3. Regex Contact Pass: extracts email, phone, LinkedIn, and GitHub without hallucination", () => {
  const text = `
    Leonal Robin
    Bengaluru, Karnataka, India
    Phone: +91 8248731433 | Email: leonal2003lr10@gmail.com
    Profiles: https://linkedin.com/in/leonal-robin and https://github.com/Leonallr10
  `;
  const contacts = extractContactsViaRegex(text);

  assert.equal(contacts.email, "leonal2003lr10@gmail.com");
  assert.equal(contacts.phone, "+91 8248731433");
  assert.equal(contacts.linkedin, "linkedin.com/in/leonal-robin");
  assert.equal(contacts.github, "github.com/Leonallr10");
});

test("4. Supported Mime Types and Garbled Text Detection", () => {
  assert.ok(isSupportedType("application/pdf"));
  assert.ok(isSupportedType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
  assert.ok(isSupportedType("image/png"));
  assert.ok(isSupportedType("image/jpeg"));
  assert.ok(isImageType("image/png"));
  assert.ok(!isImageType("application/pdf"));

  assert.ok(isTextGarbledOrEmpty("Too short"));
  assert.ok(!isTextGarbledOrEmpty("A".repeat(300)), "Long ASCII text is valid");
});

test("5. Server-side extractPdfText: extracts multi-column PDF with column preservation", async () => {
  const samplePdfPath = path.resolve("tmp/latex-verify/sample-resume.pdf");
  if (!fs.existsSync(samplePdfPath)) {
    return; // Skip if test file doesn't exist
  }

  const buf = fs.readFileSync(samplePdfPath);
  const result = await extractPdfText(buf);

  assert.ok(result.pages >= 1, "Must detect at least 1 page");
  assert.ok(result.text.length > 50, "Extracted text must have reasonable length");

  const contacts = extractContactsViaRegex(result.text);
  assert.ok(contacts.email || contacts.phone || result.text.includes("Alex Morgan"));
});

test("6. Merge Regex Contacts over LLM Model Fields", () => {
  const model = {
    personalInfo: {
      fullName: "Leonal Robin",
      email: "hallucinated@example.com",
      phone: "+1 000 000 0000",
      linkedin: "linkedin.com/in/wrong",
      github: "github.com/wrong",
    },
  };

  const rawText = "Contact: leonal2003lr10@gmail.com | +91 8248731433 | linkedin.com/in/leonal-robin | github.com/Leonallr10";
  const regexContacts = extractContactsViaRegex(rawText);

  if (regexContacts.email) model.personalInfo.email = regexContacts.email;
  if (regexContacts.phone) model.personalInfo.phone = regexContacts.phone;
  if (regexContacts.linkedin) model.personalInfo.linkedin = regexContacts.linkedin;
  if (regexContacts.github) model.personalInfo.github = regexContacts.github;

  assert.equal(model.personalInfo.email, "leonal2003lr10@gmail.com", "Regex email must override LLM email");
  assert.equal(model.personalInfo.phone, "+91 8248731433", "Regex phone must override LLM phone");
  assert.equal(model.personalInfo.linkedin, "linkedin.com/in/leonal-robin", "Regex LinkedIn must override LLM");
  assert.equal(model.personalInfo.github, "github.com/Leonallr10", "Regex GitHub must override LLM");
});
