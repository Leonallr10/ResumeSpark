import { randomUUID } from "node:crypto";

type CacheEntry = {
  pdf: Buffer;
  synctex: Buffer | null;
  lineOffset: number;
  createdAt: number;
};

const globalKey = "__pdf_preview_cache__" as const;
const globalStore = globalThis as unknown as Record<string, Map<string, CacheEntry>>;
if (!globalStore[globalKey]) {
  globalStore[globalKey] = new Map<string, CacheEntry>();
}
const cache = globalStore[globalKey];
const TTL_MS = 30 * 60 * 1000;

export function generatePreviewId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function storePdf(id: string, pdf: Buffer, synctex: Buffer | null = null, lineOffset = 0): void {
  evictExpired();
  cache.set(id, { pdf, synctex, lineOffset, createdAt: Date.now() });
}

export function getPdf(id: string): Buffer | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.pdf;
}

export function getSynctex(id: string): { data: Buffer; lineOffset: number } | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(id);
    return null;
  }
  if (!entry.synctex) return null;
  return { data: entry.synctex, lineOffset: entry.lineOffset };
}

function evictExpired() {
  const now = Date.now();
  for (const [id, entry] of cache) {
    if (now - entry.createdAt > TTL_MS) {
      cache.delete(id);
    }
  }
}
