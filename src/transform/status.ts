import { UploadStatus } from '../config/types';

export interface GhlFailureInfo {
  ok: false;
  status?: number;
  kind: '4XX' | '5XX' | 'TIMEOUT' | 'NETWORK';
  message: string;
}

export function classifyValidationResult(params: {
  linkedinProfileUrl?: string;
  isLinkedinValid: boolean;
}): UploadStatus | undefined {
  if (!params.linkedinProfileUrl || !params.isLinkedinValid) {
    return 'SKIPPED_MISSING_LINKEDIN';
  }
  return undefined;
}

export function classifyGhlFailure(error: GhlFailureInfo): UploadStatus {
  if (error.kind === 'TIMEOUT') return 'FAILED_TIMEOUT';
  if (error.kind === '5XX') return 'FAILED_GHL_5XX';
  if (error.kind === '4XX') return 'FAILED_GHL_4XX';
  return 'FAILED_VALIDATION';
}
