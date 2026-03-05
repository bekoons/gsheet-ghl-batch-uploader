import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RunSummary } from '../config/types';

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function writeReport(summary: RunSummary): Promise<{ jsonPath: string; csvPath: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportsDir = path.join(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });

  const jsonPath = path.join(reportsDir, `run_${timestamp}.json`);
  const csvPath = path.join(reportsDir, `run_${timestamp}.csv`);

  await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  const header = [
    'rowIndex',
    'linkedin_profile_url',
    'prospect_key',
    'usedSyntheticEmail',
    'status',
    'uploadStatus',
    'httpStatus',
    'error',
    'errorMessage',
    'ghlContactId'
  ];

  const lines = [header.join(',')];
  for (const row of summary.results) {
    lines.push(
      [
        row.rowIndex,
        row.linkedin_profile_url ?? '',
        row.prospect_key ?? '',
        row.usedSyntheticEmail,
        row.status,
        row.uploadStatus ?? '',
        row.httpStatus ?? '',
        row.error ?? '',
        row.errorMessage ?? '',
        row.ghlContactId ?? ''
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  await writeFile(csvPath, `${lines.join('\n')}\n`, 'utf8');
  return { jsonPath, csvPath };
}
