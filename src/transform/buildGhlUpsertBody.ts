import { AccountConfig, CanonicalRow } from '../config/types';
import { parseTags } from './normalize';
import { mapOptionValue } from './optionMap';
import { getByPath } from './objectPath';

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
  row: CanonicalRow;
  prospectKey?: string;
  syntheticEmail?: string;
}): GhlUpsertBody {
  const { config, row, prospectKey, syntheticEmail } = params;
  const body: GhlUpsertBody = {
    locationId: config.ghlLocationId,
    customFields: []
  };

  for (const [contactField, path] of Object.entries(config.contactFieldMap)) {
    const value = contactField === 'email' && syntheticEmail ? syntheticEmail : getByPath(row, path);
    if (!value) continue;
    if (contactField === 'tags') {
      body.tags = parseTags(value);
      continue;
    }
    if (contactField === 'firstName') body.firstName = value;
    else if (contactField === 'lastName') body.lastName = value;
    else if (contactField === 'name') body.name = value;
    else if (contactField === 'companyName') body.companyName = value;
    else if (contactField === 'website') body.website = value;
    else if (contactField === 'email') body.email = value;
    else if (contactField === 'phone') body.phone = value;
    else if (contactField === 'source') body.source = value;
  }

  for (const [engineKey, customFieldId] of Object.entries(config.customFieldMap)) {
    const rawValue = engineKey === 'identity.prospect_key' ? (prospectKey ?? '') : getByPath(row, engineKey);
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
