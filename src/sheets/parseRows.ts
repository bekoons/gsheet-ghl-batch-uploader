import { CanonicalRow } from '../config/types';

export function parseRows(values: string[][], columnMap: Record<string, string>): Array<{ rowIndex: number; canonical: CanonicalRow }> {
  if (values.length === 0) {
    return [];
  }

  const headers = values[0].map((h) => (h || '').trim());
  const headerToIndex = new Map(headers.map((h, i) => [h, i]));

  return values.slice(1).map((row, idx) => {
    const canonical: CanonicalRow = {};
    for (const [canonicalKey, headerName] of Object.entries(columnMap)) {
      const columnIndex = headerToIndex.get(headerName);
      canonical[canonicalKey] = columnIndex === undefined ? '' : String(row[columnIndex] ?? '').trim();
    }
    return { rowIndex: idx + 2, canonical };
  });
}
