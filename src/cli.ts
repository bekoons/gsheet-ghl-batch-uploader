import { randomUUID } from 'node:crypto';
import { loadAccountConfig } from './config/loadAccountConfig';
import { RowResult, RunSummary } from './config/types';
import { upsertContact } from './ghl/ghlClient';
import { writeReport } from './report/writeReport';
import { parseRows } from './sheets/parseRows';
import { readSheetValues } from './sheets/sheetsClient';
import { buildGhlUpsertBody } from './transform/buildGhlUpsertBody';
import { mapRowToPayload } from './transform/mapRowToPayload';
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
  const parsedRows = parseRows(values as string[][], config.columnMap);

  const slicedRows = parsedRows.slice(args.offset, args.limit ? args.offset + args.limit : undefined);

  const tasks = slicedRows.map(({ rowIndex, canonical }) => async (): Promise<RowResult> => {
    const mapped = mapRowToPayload(canonical);
    const linkedin = mapped.linkedin_profile_url;

    if (!linkedin) {
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        usedSyntheticEmail: false,
        status: 'skipped',
        error: 'Missing linkedin_profile_url'
      };
    }

    if (!isValidLinkedInProfileUrl(linkedin)) {
      return {
        rowIndex,
        linkedin_profile_url: linkedin,
        usedSyntheticEmail: false,
        status: 'skipped',
        error: 'Invalid linkedin_profile_url format'
      };
    }

    const prospectKey = buildProspectKey(linkedin);
    const needsSyntheticEmail = !mapped.email && !mapped.phone;
    const syntheticEmail = needsSyntheticEmail ? buildSyntheticEmail(prospectKey) : undefined;

    const body = buildGhlUpsertBody({
      config,
      row: mapped,
      prospectKey,
      syntheticEmail
    });

    console.log(`[trace:${traceId}] Prepared row=${rowIndex} dryRun=${args.dryRun}`);

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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
