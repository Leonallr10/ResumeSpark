import { logGuardrailEvent } from "./audit-logger";

export interface InputGuardResult {
  ok: boolean;
  sanitizedInput?: {
    companyRole: string;
    jd: string;
    project: string;
    resumeText: string;
  };
  error?: string;
  reasons?: string[];
}

export const LIMITS = {
  COMPANY_ROLE_LIMIT: 300,
  JD_LIMIT: 20000,
  PROJECT_LIMIT: 10000,
  RESUME_LIMIT: 50000,
};

// Common prompt injection attack patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules|directives)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|unrestricted|DAN|jailbreak)/i,
  /override\s+(system|developer)\s+(prompt|settings|instructions)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions)/i,
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
];

export function sanitizeHtmlAndScripts(text: string): string {
  if (!text) return "";
  return text
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/```(html|javascript|bash|sh)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function runInputGuard(
  input: {
    companyRole?: string;
    jd?: string;
    project?: string;
    resumeText?: string;
  },
  ipOrUser = "anonymous",
): InputGuardResult {
  const reasons: string[] = [];

  const rawCompanyRole = input.companyRole || "";
  const rawJd = input.jd || "";
  const rawProject = input.project || "";
  const rawResumeText = input.resumeText || "";

  // 1. Length Cap Checks
  if (rawCompanyRole.length > LIMITS.COMPANY_ROLE_LIMIT) {
    reasons.push(`Target Company/Role exceeds ${LIMITS.COMPANY_ROLE_LIMIT} characters limit.`);
  }
  if (rawJd.length > LIMITS.JD_LIMIT) {
    reasons.push(`Job description exceeds ${LIMITS.JD_LIMIT} characters limit.`);
  }
  if (rawProject.length > LIMITS.PROJECT_LIMIT) {
    reasons.push(`Extra project input exceeds ${LIMITS.PROJECT_LIMIT} characters limit.`);
  }
  if (rawResumeText.length > LIMITS.RESUME_LIMIT) {
    reasons.push(`Resume text exceeds ${LIMITS.RESUME_LIMIT} characters limit.`);
  }

  if (reasons.length > 0) {
    logGuardrailEvent({
      type: "input_length_exceeded",
      severity: "warning",
      reason: reasons.join("; "),
      ipOrUser,
    });
    return { ok: false, error: reasons[0], reasons };
  }

  // 2. Prompt Injection Checks on all untrusted inputs
  const combinedPayload = `${rawCompanyRole} \n ${rawJd} \n ${rawProject}`;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(combinedPayload)) {
      logGuardrailEvent({
        type: "input_injection",
        severity: "error",
        reason: `Potential prompt injection attack detected: pattern ${pattern.source}`,
        details: { matchedPattern: pattern.source },
        ipOrUser,
      });
      return {
        ok: false,
        error: "Untrusted prompt-injection pattern detected in job description or input fields. Please remove instructions attempting to override AI rules.",
        reasons: ["Prompt injection pattern detected."],
      };
    }
  }

  // 3. Sanitize HTML and tags
  const sanitizedInput = {
    companyRole: sanitizeHtmlAndScripts(rawCompanyRole),
    jd: sanitizeHtmlAndScripts(rawJd),
    project: sanitizeHtmlAndScripts(rawProject),
    resumeText: sanitizeHtmlAndScripts(rawResumeText),
  };

  return {
    ok: true,
    sanitizedInput,
  };
}
