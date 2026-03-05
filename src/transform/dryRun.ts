import { TranslationLogEntry } from './buildGhlUpsertBody';

export interface DryRunRowOutput {
  sheetRowNumber: number;
  linkedin_profile_url?: string;
  upsertBody: unknown;
  usedSyntheticEmail: boolean;
  optionTranslations: TranslationLogEntry[];
}

export function buildDryRunRowOutput(params: DryRunRowOutput): DryRunRowOutput {
  return {
    sheetRowNumber: params.sheetRowNumber,
    linkedin_profile_url: params.linkedin_profile_url,
    upsertBody: params.upsertBody,
    usedSyntheticEmail: params.usedSyntheticEmail,
    optionTranslations: params.optionTranslations
  };
}
