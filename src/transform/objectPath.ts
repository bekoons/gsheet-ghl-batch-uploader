export function setByPath(target: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[keys[keys.length - 1]] = value;
}

export function getByPath(target: Record<string, unknown>, path: string): string {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) return '';

  let cursor: unknown = target;
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return '';
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }

  return typeof cursor === 'string' ? cursor.trim() : '';
}
