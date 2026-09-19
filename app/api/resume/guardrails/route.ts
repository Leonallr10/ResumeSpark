import { NextResponse } from "next/server";
import { getGuardrailAuditLogs, getSecurityViolationStats } from "@/server/guardrails/audit-logger";

export const runtime = "nodejs";

export async function GET() {
  const logs = getGuardrailAuditLogs(30);
  const stats = getSecurityViolationStats();
  return NextResponse.json({
    stats,
    logs,
  });
}
