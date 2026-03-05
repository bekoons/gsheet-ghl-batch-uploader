import { CanonicalRow } from '../config/types';
import { setByPath } from '../transform/objectPath';

export function parseRows(values: string[][], columnMap: Record<string, string>): Array<{ rowIndex: number; canonical: CanonicalRow }> {
  if (values.length === 0) {
    return [];
  }

  const headers = values[0].map((h) => (h || '').trim());
  const headerToIndex = new Map(headers.map((h, i) => [h, i]));

  return values.slice(1).map((row, idx) => {
    const canonical: CanonicalRow = {};
    for (const [headerName, canonicalKey] of Object.entries(columnMap)) {
      const columnIndex = headerToIndex.get(headerName);
      const value = columnIndex === undefined ? '' : String(row[columnIndex] ?? '').trim();
      setByPath(canonical, canonicalKey, value);
    }
    return { rowIndex: idx + 2, canonical };
  });
}
