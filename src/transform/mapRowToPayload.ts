import { CanonicalRow } from '../config/types';
import { cleanValue } from './normalize';

export interface MappedRowPayload {
  linkedin_profile_url: string;
  first_name: string;
  last_name: string;
  full_name: string;
  company_name: string;
  website: string;
  email: string;
  phone: string;
  source: string;
  tags: string;
  icp_cluster: string;
  seniority_level: string;
  recent_signal_summary: string;
  hook_pillar: string;
  outreach_engine: string;
}

export function mapRowToPayload(canonical: CanonicalRow): MappedRowPayload {
  return {
    linkedin_profile_url: cleanValue(canonical.linkedin_profile_url),
    first_name: cleanValue(canonical.first_name),
    last_name: cleanValue(canonical.last_name),
    full_name: cleanValue(canonical.full_name),
    company_name: cleanValue(canonical.company_name),
    website: cleanValue(canonical.website),
    email: cleanValue(canonical.email),
    phone: cleanValue(canonical.phone),
    source: cleanValue(canonical.source),
    tags: cleanValue(canonical.tags),
    icp_cluster: cleanValue(canonical.icp_cluster),
    seniority_level: cleanValue(canonical.seniority_level),
    recent_signal_summary: cleanValue(canonical.recent_signal_summary),
    hook_pillar: cleanValue(canonical.hook_pillar),
    outreach_engine: cleanValue(canonical.outreach_engine)
  };
}
