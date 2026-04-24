export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(packed: string): Uint8Array {
  const normalized = packed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return fromBase64(normalized + pad);
}

export function toBase64UrlFromJson(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function parseBase64UrlJson<T>(packed: string): T {
  const bytes = fromBase64Url(packed);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

export async function toCompressedBase64UrlFromJson(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(compressed);
}

export async function parseCompressedBase64UrlJson<T>(packed: string): Promise<T> {
  const bytes = fromBase64Url(packed);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return JSON.parse(json) as T;
}

export function escapeXml(value: string): string {
  return String(value).replace(/[&<>\"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch] || ch));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function parseInteger(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : fallback;
}

export function limitText(value: unknown, fallback: string, maxLength: number): string {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, maxLength);
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}
