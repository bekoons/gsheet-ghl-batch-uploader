export function mapOptionValue(
  fieldKey: string,
  value: string,
  optionValueMap?: Record<string, Record<string, string>>
): string {
  if (!value) return value;
  const map = optionValueMap?.[fieldKey];
  if (!map) return value;
  return map[value] ?? value;
}
