import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AccountConfig } from './types';

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required config field: ${field}`);
  }
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Config field must be an object: ${field}`);
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

  if (parsed.optionValueMap) {
    assertRecord(parsed.optionValueMap, 'optionValueMap');
    for (const [engineKey, mapValue] of Object.entries(parsed.optionValueMap)) {
      assertRecord(mapValue, `optionValueMap.${engineKey}`);
    }
  }

  return parsed;
}
