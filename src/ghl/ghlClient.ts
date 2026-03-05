import { setTimeout as wait } from 'node:timers/promises';
import { GhlUpsertBody } from '../transform/buildGhlUpsertBody';

const GHL_UPSERT_URL = 'https://services.leadconnectorhq.com/contacts/upsert';

export interface GhlClientOptions {
  accessToken: string;
  traceId: string;
}

export async function upsertContact(body: GhlUpsertBody, options: GhlClientOptions): Promise<{ id?: string }> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(GHL_UPSERT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        'X-Trace-Id': options.traceId
      },
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
