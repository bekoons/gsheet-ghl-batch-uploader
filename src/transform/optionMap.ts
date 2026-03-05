export interface OptionMapResult {
  value: string;
  translated: boolean;
  missingMapping: boolean;
  normalizedInput: string;
}

export function mapOptionValue(
  fieldKey: string,
  rawValue: string,
  optionValueMap?: Record<string, Record<string, string>>
): OptionMapResult {
  if (!rawValue) {
    return {
      value: rawValue,
      translated: false,
      missingMapping: false,
      normalizedInput: ''
    };
  }

  const normalizedInput = String(rawValue).trim().toLowerCase();
  const map = optionValueMap?.[fieldKey];
  if (!map) {
    return {
      value: rawValue,
      translated: false,
      missingMapping: false,
      normalizedInput
    };
  }

  const translated = map[normalizedInput];
  if (translated) {
    return {
      value: translated,
      translated: true,
      missingMapping: false,
      normalizedInput
    };
  }

  return {
    value: rawValue,
    translated: false,
    missingMapping: true,
    normalizedInput
  };
}
