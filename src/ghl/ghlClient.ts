import { setTimeout as wait } from 'node:timers/promises';
import { GhlUpsertBody } from '../transform/buildGhlUpsertBody';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_UPSERT_URL = `${GHL_BASE_URL}/contacts/upsert`;

export interface GhlClientOptions {
  accessToken: string;
  traceId: string;
}

export interface GhlCustomFieldOption {
  label: string;
  value?: string;
}

export interface GhlCustomField {
  id: string;
  name: string;
  dataType: string;
  options?: GhlCustomFieldOption[];
}

function buildHeaders(options: GhlClientOptions): Record<string, string> {
  return {
    Authorization: `Bearer ${options.accessToken}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    'X-Trace-Id': options.traceId
  };
}

export async function listCustomFields(
  locationId: string,
  options: GhlClientOptions
): Promise<GhlCustomField[]> {
  const response = await fetch(`${GHL_BASE_URL}/locations/${locationId}/customFields`, {
    method: 'GET',
    headers: buildHeaders(options)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GHL list custom fields failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  const customFields =
    (Array.isArray(parsed.customFields) && parsed.customFields) ||
    (Array.isArray(parsed.fields) && parsed.fields) ||
    (Array.isArray(parsed.data) && parsed.data) ||
    [];

  return customFields.map((field) => {
    const typed = field as Record<string, unknown>;
    const optionsRaw = typed.options;
    const optionsList = Array.isArray(optionsRaw)
      ? optionsRaw.map((option) => {
          const typedOption = option as Record<string, unknown>;
          return {
            label: String(typedOption.label ?? typedOption.name ?? typedOption.value ?? ''),
            value: typedOption.value ? String(typedOption.value) : undefined
          };
        })
      : undefined;

    return {
      id: String(typed.id ?? typed._id ?? ''),
      name: String(typed.name ?? typed.fieldName ?? ''),
      dataType: String(typed.dataType ?? typed.type ?? ''),
      options: optionsList
    };
  });
}

export async function upsertContact(body: GhlUpsertBody, options: GhlClientOptions): Promise<{ id?: string }> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(GHL_UPSERT_URL, {
      method: 'POST',
      headers: buildHeaders(options),
      body: JSON.stringify(body)
    });

    const text = await response.text();
    console.log(`[trace:${options.traceId}] GHL upsert status=${response.status} attempt=${attempt}`);

    if (response.ok) {
      let parsed: any = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }
      return { id: parsed?.contact?.id || parsed?.id };
    }

    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < maxAttempts) {
      const delayMs = 500 * 2 ** (attempt - 1);
      await wait(delayMs);
      continue;
    }

    throw new Error(`GHL upsert failed (${response.status}): ${text.slice(0, 500)}`);
  }

  throw new Error('Unexpected retry exhaustion');
}
