import { normalizePhoneAR, sha256Hex } from '../crypto.js';

export interface PurchaseEvent {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  apiVersion: string;
  eventId: string;
  eventTime: Date;
  value: number;
  currency: string;
  lead: {
    fbc?: string | null;
    fbp?: string | null;
    client_ip?: string | null;
    user_agent?: string | null;
    landing_url?: string | null;
    customer_phone?: string | null;
    customer_name?: string | null;
    code?: string | null;
  };
}

export interface CapiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

function hashed(v: string | null | undefined): string[] | undefined {
  if (!v) return undefined;
  const n = v.trim().toLowerCase();
  return n ? [sha256Hex(n)] : undefined;
}

/** Arma el cuerpo del evento Purchase según la API de conversiones de Meta. */
export function buildPurchasePayload(e: PurchaseEvent): Record<string, unknown> {
  const firstName = e.lead.customer_name?.trim().split(/\s+/)[0];
  const phone = e.lead.customer_phone ? normalizePhoneAR(e.lead.customer_phone) : null;
  const user_data: Record<string, unknown> = {
    fbc: e.lead.fbc || undefined,
    fbp: e.lead.fbp || undefined,
    client_ip_address: e.lead.client_ip || undefined,
    client_user_agent: e.lead.user_agent || undefined,
    ph: phone ? [sha256Hex(phone)] : undefined,
    fn: hashed(firstName),
    external_id: hashed(e.lead.code),
  };
  for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(e.eventTime.getTime() / 1000),
        event_id: e.eventId,
        action_source: 'website',
        event_source_url: e.lead.landing_url || undefined,
        user_data,
        custom_data: { currency: e.currency, value: Math.round(e.value * 100) / 100 },
      },
    ],
  };
  if (e.testEventCode) payload.test_event_code = e.testEventCode;
  return payload;
}

export async function sendPurchase(e: PurchaseEvent, fetchImpl: typeof fetch = fetch): Promise<CapiResult> {
  const url = `https://graph.facebook.com/${e.apiVersion}/${encodeURIComponent(e.pixelId)}/events?access_token=${encodeURIComponent(e.accessToken)}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildPurchasePayload(e)),
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}
