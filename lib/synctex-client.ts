import { type SynctexMapping, parseSynctex } from "./synctex-parser";

export async function fetchSynctexMapping(
  previewId: string,
): Promise<{ mapping: SynctexMapping | null; lineOffset: number }> {
  try {
    const response = await fetch(`/api/resume/synctex/${previewId}`);

    if (!response.ok) {
      return { mapping: null, lineOffset: 0 };
    }

    const lineOffset = parseInt(response.headers.get("X-Line-Offset") ?? "0", 10);
    const compressedBuffer = await response.arrayBuffer();
    const raw = await decompressGzip(compressedBuffer);
    const mapping = parseSynctex(raw);

    return { mapping, lineOffset };
  } catch {
    return { mapping: null, lineOffset: 0 };
  }
}

export async function parseBase64Synctex(
  base64Gzip: string,
  lineOffset: number,
): Promise<{ mapping: SynctexMapping | null; lineOffset: number }> {
  try {
    const binary = atob(base64Gzip);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const raw = await decompressGzip(bytes.buffer);
    const mapping = parseSynctex(raw);
    return { mapping, lineOffset };
  } catch {
    return { mapping: null, lineOffset: 0 };
  }
}

async function decompressGzip(buffer: ArrayBuffer): Promise<string> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(merged);
}
