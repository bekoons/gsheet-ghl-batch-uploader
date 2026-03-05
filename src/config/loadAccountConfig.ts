import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AccountConfig } from './types';

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required config field: ${field}`);
  }
}

export async function loadAccountConfig(accountId: string): Promise<AccountConfig> {
  const filePath = path.join(process.cwd(), 'config', 'accounts', `${accountId}.json`);
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as AccountConfig;

  assertNonEmpty(parsed.accountId, 'accountId');
  assertNonEmpty(parsed.ghlAccessToken, 'ghlAccessToken');
  assertNonEmpty(parsed.ghlLocationId, 'ghlLocationId');
  assertNonEmpty(parsed.sheet?.spreadsheetId, 'sheet.spreadsheetId');
  assertNonEmpty(parsed.sheet?.tabName, 'sheet.tabName');
  assertNonEmpty(parsed.sheet?.range, 'sheet.range');

  if (!parsed.columnMap || !parsed.contactFieldMap || !parsed.customFieldMap) {
    throw new Error('Config must contain columnMap, contactFieldMap, and customFieldMap');
  }

  return parsed;
}
