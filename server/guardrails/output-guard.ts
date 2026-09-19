import { z, type ZodSchema } from "zod";
import { logGuardrailEvent } from "./audit-logger";

export interface OutputGuardResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  recovered?: boolean;
}

export function runOutputGuard<T>(
  rawText: string,
  schema: ZodSchema<T>,
  ipOrUser = "anonymous",
): OutputGuardResult<T> {
  if (!rawText || !rawText.trim()) {
    return { ok: false, error: "LLM returned empty response." };
  }

  // 1. JSON parsing & recovery
  let parsed: unknown;
  let wasRecovered = false;

  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    try {
      // Fix unescaped newlines/tabs inside JSON string values
      const fixed = cleaned.replace(
        /"(?:[^"\\]|\\.)*"/g,
        (match) => match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t"),
      );
      parsed = JSON.parse(fixed);
    } catch {
      try {
        const recovered = recoverTruncatedJson(cleaned);
        parsed = JSON.parse(recovered);
        wasRecovered = true;
        logGuardrailEvent({
          type: "json_recovered",
          severity: "info",
          reason: "Successfully recovered truncated LLM JSON response.",
          ipOrUser,
        });
      } catch (recoveryErr) {
        logGuardrailEvent({
          type: "output_schema_invalid",
          severity: "error",
          reason: `Unrecoverable JSON output: ${recoveryErr instanceof Error ? recoveryErr.message : "Malformed"}`,
          ipOrUser,
        });
        return { ok: false, error: "Failed to parse model JSON response." };
      }
    }
  }

  // 2. Schema Validation via Zod
  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    logGuardrailEvent({
      type: "output_schema_invalid",
      severity: "warning",
      reason: "LLM output failed Zod schema validation.",
      details: { errors: validation.error.flatten() },
      ipOrUser,
    });
    return {
      ok: false,
      error: "LLM response structure was invalid.",
    };
  }

  return {
    ok: true,
    data: validation.data,
    recovered: wasRecovered,
  };
}

function recoverTruncatedJson(text: string): string {
  let recovered = text;

  // Close unterminated string
  const quoteCount = (recovered.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    recovered += '"';
  }

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

  recovered = recovered.replace(/,\s*$/, "");
  const trailingIncomplete = recovered.match(/,?\s*"[^"]*"\s*:\s*$/);
  if (trailingIncomplete) {
    recovered += '""';
  }

  for (let i = 0; i < openBrackets; i++) recovered += "]";
  for (let i = 0; i < openBraces; i++) recovered += "}";

  return recovered;
}
