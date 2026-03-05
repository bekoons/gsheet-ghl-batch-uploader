import { setTimeout as wait } from 'node:timers/promises';
import { GhlUpsertBody } from '../transform/buildGhlUpsertBody';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_UPSERT_URL = `${GHL_BASE_URL}/contacts/upsert`;

export interface GhlClientOptions {
  accessToken: string;
  traceId: string;
}

export interface GhlUpsertOptions extends GhlClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
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

export class GhlUpsertError extends Error {
  status?: number;
  kind: '4XX' | '5XX' | 'TIMEOUT' | 'NETWORK';

  constructor(message: string, kind: '4XX' | '5XX' | 'TIMEOUT' | 'NETWORK', status?: number) {
    super(message);
    this.name = 'GhlUpsertError';
    this.kind = kind;
    this.status = status;
  }
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

export async function upsertContact(body: GhlUpsertBody, options: GhlUpsertOptions): Promise<{ id?: string }> {
  const maxAttempts = Math.max(1, (options.maxRetries ?? 2) + 1);
  const timeoutMs = options.timeoutMs ?? 30000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

    try {
      const response = await fetch(GHL_UPSERT_URL, {
        method: 'POST',
        headers: buildHeaders(options),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);

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

      const kind = response.status >= 500 ? '5XX' : '4XX';
      const error = new GhlUpsertError(`GHL upsert failed (${response.status}): ${text.slice(0, 500)}`, kind, response.status);
      const retriable = response.status === 429 || response.status >= 500;
      if (retriable && attempt < maxAttempts) {
        const delayMs = 500 * 2 ** (attempt - 1);
        await wait(delayMs);
        continue;
      }

      throw error;
    } catch (error) {
      clearTimeout(timeout);

      const isTimeout =
        error instanceof DOMException
          ? error.name === 'AbortError'
          : error instanceof Error && error.name === 'AbortError';

      if (isTimeout) {
        if (attempt < maxAttempts) {
          const delayMs = 500 * 2 ** (attempt - 1);
          await wait(delayMs);
          continue;
        }
        throw new GhlUpsertError(`GHL upsert timeout after ${timeoutMs}ms`, 'TIMEOUT');
      }

      if (error instanceof GhlUpsertError) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delayMs = 500 * 2 ** (attempt - 1);
        await wait(delayMs);
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new GhlUpsertError(`GHL network failure: ${message}`, 'NETWORK');
    }
  }

  throw new GhlUpsertError('Unexpected retry exhaustion', 'NETWORK');
}
