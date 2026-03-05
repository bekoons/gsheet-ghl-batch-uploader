import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENGINE_KEY_CUSTOM_FIELD_IDS } from '../src/ghl/engineKeyCustomFields';
import { listCustomFields, GhlCustomFieldOption } from '../src/ghl/ghlClient';

interface ExportArgs {
  account: string;
  out?: string;
  optionsFile?: string;
}

interface AccountConfigMinimal {
  ghlAccessToken: string;
  ghlLocationId: string;
}

function parseArgs(argv: string[]): ExportArgs {
  const args: ExportArgs = { account: 'default' };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--account') args.account = argv[++i] || 'default';
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--options-file') args.optionsFile = argv[++i];
  }

  return args;
}

function toTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toOptionLabels(options?: GhlCustomFieldOption[]): string[] {
  if (!options) return [];
  return options
    .map((option) => option.label.trim())
    .filter((label) => label.length > 0);
}

async function readOptionsFallback(
  filePath: string
): Promise<Record<string, { fieldName: string; dataType: string; options: string[] }>> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, { fieldName: string; dataType: string; options: string[] }>;
  return parsed;
}

async function loadAccount(account: string): Promise<AccountConfigMinimal> {
  const filePath = path.join(process.cwd(), 'config', 'accounts', `${account}.json`);
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as AccountConfigMinimal;
  if (!parsed.ghlAccessToken || !parsed.ghlLocationId) {
    throw new Error(`Account config missing ghlAccessToken/ghlLocationId: ${filePath}`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const accountConfig = await loadAccount(args.account);
  const traceId = randomUUID();
  const timestamp = toTimestamp();

  const outPath = args.out ?? path.join(process.cwd(), 'reports', `optionValueMap_${timestamp}.json`);
  const rawOptionsPath = path.join(path.dirname(outPath), `fieldOptions_${timestamp}.json`);
  await mkdir(path.dirname(outPath), { recursive: true });

  const customFields = await listCustomFields(accountConfig.ghlLocationId, {
    accessToken: accountConfig.ghlAccessToken,
    traceId
  });

  const byFieldId = new Map(customFields.map((field) => [field.id, field]));
  const targetDataTypes = new Set(['SINGLE_OPTIONS', 'MULTI_SELECT', 'CHECKBOX']);

  const fallbackOptions = args.optionsFile ? await readOptionsFallback(args.optionsFile) : undefined;

  const optionValueMap: Record<string, Record<string, string>> = {};
  const rawFieldOptions: Record<string, unknown> = {};

  for (const [engineKey, customFieldId] of Object.entries(ENGINE_KEY_CUSTOM_FIELD_IDS)) {
    const field = byFieldId.get(customFieldId);
    const dataType = field?.dataType ?? fallbackOptions?.[customFieldId]?.dataType ?? 'UNKNOWN';

    if (!targetDataTypes.has(dataType)) {
      continue;
    }

    let optionLabels = toOptionLabels(field?.options);
    if (optionLabels.length === 0 && fallbackOptions?.[customFieldId]?.options) {
      optionLabels = fallbackOptions[customFieldId].options;
    }

    rawFieldOptions[engineKey] = {
      customFieldId,
      fieldName: field?.name ?? fallbackOptions?.[customFieldId]?.fieldName ?? '',
      dataType,
      options: optionLabels
    };

    const map: Record<string, string> = {
      __fieldId: customFieldId,
      __fieldName: field?.name ?? fallbackOptions?.[customFieldId]?.fieldName ?? '',
      __dataType: dataType
    };

    for (const label of optionLabels) {
      map[label] = label;
      map[label.toLowerCase()] = label;
    }

    optionValueMap[engineKey] = map;
  }

  await writeFile(outPath, `${JSON.stringify(optionValueMap, null, 2)}\n`, 'utf8');
  await writeFile(rawOptionsPath, `${JSON.stringify(rawFieldOptions, null, 2)}\n`, 'utf8');

  console.log(`optionValueMap exported to: ${outPath}`);
  console.log(`field options exported to: ${rawOptionsPath}`);
  if (args.optionsFile) {
    console.log('Fallback options file format: { "<customFieldId>": { "fieldName": "...", "dataType": "SINGLE_OPTIONS", "options": ["Label A"] } }');
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
