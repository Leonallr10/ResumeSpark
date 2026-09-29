import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const BULLET_RE = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u2013•\-*>●▸▷•]\s*/;
const DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b\d{1,2}\/\d{2,4}\b|\b(?:19|20)\d{2}\b|present|current/i;

function parseDateRange(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const rangeMatch = clean.match(
    /(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)\s*[-–—to]+\s*(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b|present|current)/i
  );
  if (rangeMatch) return { startDate: rangeMatch[1].trim(), endDate: rangeMatch[2].trim() };
  const singleDate = clean.match(/(\d{1,2}\/\d{2,4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*\d{2,4}|\b(?:19|20)\d{2}\b)/i);
  if (singleDate) return { startDate: singleDate[1].trim(), endDate: "" };
  if (/present|current/i.test(clean)) return { startDate: "", endDate: "Present" };
  return { startDate: "", endDate: "" };
}

console.log("Testing date parsing:");
console.log("08/2025 – 03/2026 ->", parseDateRange("Frontend & R&D Engineer Intern 08/2025 – 03/2026"));
console.log("09/2021 – 05/2025 ->", parseDateRange("09/2021 – 05/2025"));
console.log("(10/2024) ->", parseDateRange("NASA Space App Challenge (10/2024)"));
