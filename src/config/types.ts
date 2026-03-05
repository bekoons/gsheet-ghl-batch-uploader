export type CanonicalColumnKey =
  | 'linkedin_profile_url'
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'company_name'
  | 'website'
  | 'email'
  | 'phone'
  | 'source'
  | 'tags'
  | 'icp_cluster'
  | 'seniority_level'
  | 'recent_signal_summary'
  | 'hook_pillar'
  | 'outreach_engine';

export type ContactFieldName =
  | 'firstName'
  | 'lastName'
  | 'name'
  | 'companyName'
  | 'website'
  | 'email'
  | 'phone'
  | 'source'
  | 'tags';

export interface AccountConfig {
  accountId: string;
  ghlAccessToken: string;
  ghlLocationId: string;
  sheet: {
    spreadsheetId: string;
    tabName: string;
    range: string;
  };
  columnMap: Record<string, string>;
  contactFieldMap: Partial<Record<ContactFieldName, string>>;
  customFieldMap: Record<string, string>;
  optionValueMap?: Record<string, Record<string, string>>;
}

export type CanonicalRow = Record<string, string>;

export interface RowResult {
  rowIndex: number;
  linkedin_profile_url?: string;
  prospect_key?: string;
  usedSyntheticEmail: boolean;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  ghlContactId?: string;
}

export interface RunSummary {
  traceId: string;
  accountId: string;
  startedAt: string;
  endedAt: string;
  totals: {
    processed: number;
    success: number;
    failed: number;
    skipped: number;
  };
  results: RowResult[];
}
