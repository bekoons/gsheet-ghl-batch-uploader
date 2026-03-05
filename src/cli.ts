import { randomUUID } from 'node:crypto';
import { loadAccountConfig } from './config/loadAccountConfig';
import { RowResult, RunSummary } from './config/types';
import { upsertContact } from './ghl/ghlClient';
import { writeReport } from './report/writeReport';
import { parseRows } from './sheets/parseRows';
import { readSheetValues, updateSheetValue } from './sheets/sheetsClient';
import { buildGhlUpsertBody } from './transform/buildGhlUpsertBody';
import { getByPath } from './transform/objectPath';
import { buildProspectKey, buildSyntheticEmail, isValidLinkedInProfileUrl } from './transform/prospectKey';

interface CliArgs {
  account: string;
  dryRun: boolean;
  limit?: number;
  offset: number;
  concurrency: number;
  stopOnError: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    account: '',
    dryRun: false,
    offset: 0,
    concurrency: 3,
    stopOnError: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--account') args.account = argv[++i];
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--limit') args.limit = Number(argv[++i]);
    else if (token === '--offset') args.offset = Number(argv[++i] ?? 0);
    else if (token === '--concurrency') args.concurrency = Math.max(1, Number(argv[++i] ?? 3));
    else if (token === '--stop-on-error') args.stopOnError = true;
  }

  if (!args.account) throw new Error('Missing --account <id>');
  return args;
}

async function processWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();
  const traceId = randomUUID();
  const args = parseArgs(process.argv.slice(2));
  const config = await loadAccountConfig(args.account);

  console.log(`[trace:${traceId}] Reading Google Sheet for account=${config.accountId}`);
  const values = await readSheetValues(config.sheet);
  const headers = ((values as string[][])[0] || []).map((h) => (h || '').trim());
  const statusHeader = Object.entries(config.columnMap).find(([, canonical]) => canonical === 'sheet.ghl_upload_status')?.[0];
  if (!statusHeader) {
    throw new Error('Missing columnMap entry for sheet.ghl_upload_status');
  }
  const statusColumnIndex = headers.findIndex((header) => header === statusHeader);
  if (statusColumnIndex < 0) {
    throw new Error(`Missing status column header: ${statusHeader}`);
  }
  const parsedRows = parseRows(values as string[][], config.columnMap);

  const slicedRows = parsedRows.slice(args.offset, args.limit ? args.offset + args.limit : undefined);

  const tasks = slicedRows.map(({ rowIndex, canonical }) => async (): Promise<RowResult> => {
    const uploadStatus = getByPath(canonical, 'sheet.ghl_upload_status');
    if (uploadStatus && uploadStatus.toUpperCase() !== 'PENDING') {
      return {
        rowIndex,
        linkedin_profile_url: getByPath(canonical, 'identity.linkedin_profile_url'),
        usedSyntheticEmail: false,
        status: 'skipped',
        error: `Status is ${uploadStatus}`
      };
    }

    const linkedin = getByPath(canonical, 'identity.linkedin_profile_url');

    if (!linkedin) {
      if (!args.dryRun) {
        await updateSheetValue({
          spreadsheetId: config.sheet.spreadsheetId,
          tabName: config.sheet.tabName,
          rowIndex,
          columnIndex: statusColumnIndex,
          value: 'SKIPPED_MISSING_LINKEDIN'
        });
      }
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        usedSyntheticEmail: false,
        status: 'skipped',
        error: 'Missing linkedin_profile_url'
      };
    }

    if (!isValidLinkedInProfileUrl(linkedin)) {
      if (!args.dryRun) {
        await updateSheetValue({
          spreadsheetId: config.sheet.spreadsheetId,
          tabName: config.sheet.tabName,
          rowIndex,
          columnIndex: statusColumnIndex,
          value: 'SKIPPED_MISSING_LINKEDIN'
        });
      }
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        usedSyntheticEmail: false,
        status: 'skipped',
        error: 'Invalid linkedin_profile_url format'
      };
    }

    const prospectKey = buildProspectKey(linkedin);
    const email = getByPath(canonical, 'crm_projection.contact.email');
    const phone = getByPath(canonical, 'crm_projection.contact.phone');
    const needsSyntheticEmail = !email && !phone;
    const syntheticEmail = needsSyntheticEmail ? buildSyntheticEmail(prospectKey) : undefined;

    const { body, translationLog } = buildGhlUpsertBody({
      config,
      row: canonical,
      prospectKey,
      syntheticEmail
    });

    console.log(`[trace:${traceId}] Prepared row=${rowIndex} dryRun=${args.dryRun}`);

    if (args.dryRun && translationLog.length > 0) {
      for (const item of translationLog) {
        if (item.translated) {
          console.log(`[trace:${traceId}] Row ${rowIndex} translated ${item.engineKey}: "${item.rawValue}" => "${item.mappedValue}"`);
        } else if (item.missingMapping) {
          console.log(`[trace:${traceId}] Row ${rowIndex} missing option map for ${item.engineKey}; using raw value "${item.rawValue}"`);
        }
      }
    }

    if (args.dryRun) {
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        prospect_key: prospectKey,
        usedSyntheticEmail: needsSyntheticEmail,
        status: 'success'
      };
    }

    try {
      const response = await upsertContact(body, {
        accessToken: config.ghlAccessToken,
        traceId
      });

      await updateSheetValue({
        spreadsheetId: config.sheet.spreadsheetId,
        tabName: config.sheet.tabName,
        rowIndex,
        columnIndex: statusColumnIndex,
        value: 'UPLOADED'
      });

      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        prospect_key: prospectKey,
        usedSyntheticEmail: needsSyntheticEmail,
        status: 'success',
        ghlContactId: response.id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[trace:${traceId}] Row ${rowIndex} failed: ${message}`);
      if (!args.dryRun) {
        await updateSheetValue({
          spreadsheetId: config.sheet.spreadsheetId,
          tabName: config.sheet.tabName,
          rowIndex,
          columnIndex: statusColumnIndex,
          value: `FAILED_${toFailureCode(message)}`
        });
      }
      if (args.stopOnError) throw error;
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        prospect_key: prospectKey,
        usedSyntheticEmail: needsSyntheticEmail,
        status: 'failed',
        error: message
      };
    }
  });

  const results = await processWithConcurrency(tasks, args.concurrency);

  const totals = {
    processed: results.length,
    success: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length
  };

  const summary: RunSummary = {
    traceId,
    accountId: config.accountId,
    startedAt,
    endedAt: new Date().toISOString(),
    totals,
    results
  };

  const report = await writeReport(summary);
  console.log(`[trace:${traceId}] Report JSON: ${report.jsonPath}`);
  console.log(`[trace:${traceId}] Report CSV: ${report.csvPath}`);
  console.log(`Totals => processed=${totals.processed} success=${totals.success} failed=${totals.failed} skipped=${totals.skipped}`);
}

function toFailureCode(message: string): string {
  const match = message.match(/\b(\d{3})\b/);
  if (match) return match[1];
  return message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'UNKNOWN';
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
