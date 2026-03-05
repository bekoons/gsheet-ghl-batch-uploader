export function cleanValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseTags(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
