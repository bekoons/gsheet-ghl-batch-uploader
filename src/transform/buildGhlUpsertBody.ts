import { AccountConfig } from '../config/types';
import { parseTags } from './normalize';
import { mapOptionValue } from './optionMap';
import { MappedRowPayload } from './mapRowToPayload';

export interface GhlUpsertBody {
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;
  website?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields: Array<{ id: string; value: string }>;
}

export function buildGhlUpsertBody(params: {
  config: AccountConfig;
  row: MappedRowPayload;
  prospectKey?: string;
  syntheticEmail?: string;
}): GhlUpsertBody {
  const { config, row, prospectKey, syntheticEmail } = params;
  const body: GhlUpsertBody = {
    locationId: config.ghlLocationId,
    customFields: []
  };

  const internalRecord: Record<string, string> = {
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
    company_name: row.company_name,
    website: row.website,
    email: syntheticEmail || row.email,
    phone: row.phone,
    source: row.source,
    tags: row.tags,
    linkedin_profile_url: row.linkedin_profile_url,
    icp_cluster: row.icp_cluster,
    seniority_level: row.seniority_level,
    recent_signal_summary: row.recent_signal_summary,
    hook_pillar: row.hook_pillar,
    outreach_engine: row.outreach_engine,
    prospect_key: prospectKey ?? ''
  };

  for (const [contactField, internalKey] of Object.entries(config.contactFieldMap)) {
    const value = internalRecord[internalKey];
    if (!value) continue;
    if (contactField === 'tags') {
      body.tags = parseTags(value);
      continue;
    }
    (body as Record<string, unknown>)[contactField] = value;
  }

  for (const [engineKey, customFieldId] of Object.entries(config.customFieldMap)) {
    let rawValue = '';
    if (engineKey === 'identity.prospect_key') {
      rawValue = prospectKey ?? '';
    } else {
      const shortKey = engineKey.split('.').slice(1).join('_');
      rawValue = internalRecord[shortKey] ?? '';
    }
    const mapped = mapOptionValue(engineKey, rawValue, config.optionValueMap);
    if (mapped !== '') {
      body.customFields.push({
        id: customFieldId,
        value: String(mapped)
      });
    }
  }

  return body;
}
