export * from "./audit-logger";
export * from "./input-guard";
export * from "./output-guard";
export * from "./fact-guard";

import { runInputGuard, type InputGuardResult } from "./input-guard";
import { runOutputGuard, type OutputGuardResult } from "./output-guard";
import { runFactGuard, type FactGuardResult } from "./fact-guard";
import type { ZodSchema } from "zod";
import type { AiSuggestion } from "@/types/resume";

export interface UnifiedGuardrailCheck {
  runInputGuard: (input: Parameters<typeof runInputGuard>[0], ip?: string) => InputGuardResult;
  runOutputGuard: <T>(rawText: string, schema: ZodSchema<T>, ip?: string) => OutputGuardResult<T>;
  runFactGuard: (suggestions: AiSuggestion[], sourceResumeText: string, extraProjectText: string, ip?: string) => FactGuardResult;
}

export const Guardrails: UnifiedGuardrailCheck = {
  runInputGuard,
  runOutputGuard,
  runFactGuard,
};
