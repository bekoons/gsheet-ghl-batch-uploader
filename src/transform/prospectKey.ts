import { createHash } from 'node:crypto';

export function normalizeLinkedInUrl(url: string): string {
  const raw = url.trim();
  const parsed = new URL(raw);
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.search = '';
  parsed.hash = '';
  let normalized = parsed.toString();
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function isValidLinkedInProfileUrl(url: string): boolean {
  return /^https:\/\/www\.linkedin\.com\/in\//i.test(url.trim());
}

export function buildProspectKey(linkedinProfileUrl: string): string {
  const normalized = normalizeLinkedInUrl(linkedinProfileUrl);
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 14);
  return `li_${digest}`;
}

export function buildSyntheticEmail(prospectKey: string): string {
  return `oops+${prospectKey}@prospectif.ai`;
}
