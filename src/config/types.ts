export type CanonicalColumnKey =
  | 'crm_projection.contact.first_name'
  | 'crm_projection.contact.last_name'
  | 'crm_projection.contact.company_name'
  | 'crm_projection.contact.website'
  | 'crm_projection.contact.email'
  | 'identity.linkedin_profile_url'
  | 'messages.connection'
  | 'classification.seniority_level'
  | 'classification.icp_cluster'
  | 'signal.recent_signal_type'
  | 'signal.signal_recency_bucket'
  | 'hook.hook_angle_type'
  | 'hook.hook_pillar'
  | 'hook.hook_score'
  | 'identity.title'
  | 'identity.headline'
  | 'sheet.ghl_upload_status';

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

export type CanonicalRow = Record<string, unknown>;

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
