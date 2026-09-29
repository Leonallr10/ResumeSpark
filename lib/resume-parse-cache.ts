import { createHash } from "node:crypto";
import type { ResumeDocumentModel } from "@/server/documents/resume-document-model";

type CacheEntry = {
  model: ResumeDocumentModel;
  createdAt: number;
};

const globalKey = "__resume_parse_cache__" as const;
const globalStore = globalThis as unknown as Record<string, Map<string, CacheEntry>>;
if (!globalStore[globalKey]) {
  globalStore[globalKey] = new Map<string, CacheEntry>();
}
const cache = globalStore[globalKey];
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export function hashFileBuffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function getCachedParse(hash: string): ResumeDocumentModel | null {
  const entry = cache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(hash);
    return null;
  }
  return entry.model;
}

export function setCachedParse(hash: string, model: ResumeDocumentModel): void {
  evictExpired();
  cache.set(hash, { model, createdAt: Date.now() });
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > TTL_MS) {
      cache.delete(key);
    }
  }
}
