export interface GuardrailAuditEntry {
  id: string;
  timestamp: string;
  type: "input_injection" | "input_length_exceeded" | "input_sanitized" | "output_schema_invalid" | "json_recovered" | "fact_hallucination_blocked" | "toxicity_blocked";
  severity: "info" | "warning" | "error";
  reason: string;
  details?: Record<string, unknown>;
  ipOrUser?: string;
}

// In-memory ring buffer of last 500 guardrail events
const MAX_AUDIT_LOGS = 500;
const auditLogs: GuardrailAuditEntry[] = [];
const userViolationCounts = new Map<string, { count: number; firstSeen: number }>();

export function logGuardrailEvent(entry: Omit<GuardrailAuditEntry, "id" | "timestamp">) {
  const id = `gr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();
  const fullEntry: GuardrailAuditEntry = { id, timestamp, ...entry };

  auditLogs.unshift(fullEntry);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.pop();
  }

  // Track violation counts for telemetry alerting
  if (entry.ipOrUser && (entry.type === "input_injection" || entry.type === "toxicity_blocked")) {
    const record = userViolationCounts.get(entry.ipOrUser) || { count: 0, firstSeen: Date.now() };
    record.count += 1;
    userViolationCounts.set(entry.ipOrUser, record);

    if (record.count >= 3) {
      console.warn(`[SECURITY ALERT] Repeated guardrail violations from ${entry.ipOrUser} (${record.count} attempts)`);
    }
  }

  return fullEntry;
}

export function getGuardrailAuditLogs(limit = 50): GuardrailAuditEntry[] {
  return auditLogs.slice(0, limit);
}

export function getSecurityViolationStats() {
  const stats = {
    totalEvents: auditLogs.length,
    injectionsBlocked: auditLogs.filter((l) => l.type === "input_injection").length,
    hallucinationsBlocked: auditLogs.filter((l) => l.type === "fact_hallucination_blocked").length,
    jsonRecoveries: auditLogs.filter((l) => l.type === "json_recovered").length,
    activeViolatorCount: Array.from(userViolationCounts.values()).filter((v) => v.count >= 3).length,
  };
  return stats;
}
