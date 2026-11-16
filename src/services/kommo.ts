// Integración con Kommo: lectura de webhooks (formulario con claves tipo leads[status][0][id])
// y llamadas a su API v4 con un token de larga duración.

type Nested = { [k: string]: Nested | string };

/** Convierte {"a[b][0][c]": "x"} en {a: {b: {"0": {c: "x"}}}}. */
export function unflatten(flat: Record<string, unknown>): Nested {
  const root: Nested = {};
  for (const [rawKey, rawVal] of Object.entries(flat)) {
    const val = Array.isArray(rawVal) ? String(rawVal[rawVal.length - 1]) : String(rawVal ?? '');
    const parts = rawKey.replace(/\]/g, '').split('[');
    let node = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) node[p] = val;
      else {
        if (typeof node[p] !== 'object') node[p] = {};
        node = node[p] as Nested;
      }
    });
  }
  return root;
}

function list(n: Nested | string | undefined): Nested[] {
  if (!n || typeof n === 'string') return [];
  return Object.keys(n)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => n[k])
    .filter((x): x is Nested => typeof x === 'object');
}
const s = (n: Nested | string | undefined): string | undefined => (typeof n === 'string' && n !== '' ? n : undefined);
const num = (n: Nested | string | undefined): number | undefined => {
  const v = s(n);
  return v && /^\d+$/.test(v) ? Number(v) : undefined;
};

export interface KommoMessage {
  id?: string;
  text: string;
  incoming: boolean;
  leadId?: number;
  contactId?: number;
  attachment?: { type?: string; link: string; fileName?: string };
  authorName?: string;
}

export interface KommoStatusChange {
  leadId: number;
  statusId: number;
  pipelineId?: number;
  price?: number;
}

export function parseWebhook(flat: Record<string, unknown>): { messages: KommoMessage[]; statusChanges: KommoStatusChange[] } {
  const p = unflatten(flat);
  const messages: KommoMessage[] = [];
  const msgRoot = p.message as Nested | undefined;
  for (const m of list(msgRoot?.add)) {
    const entityType = s(m.entity_type) ?? s(m.element_type);
    const att = m.attachment as Nested | undefined;
    const author = m.author as Nested | undefined;
    messages.push({
      id: s(m.id),
      text: s(m.text) ?? '',
      // los mensajes salientes (del vendedor) no traen códigos ni comprobantes de clientes
      incoming: (s(m.type) ?? 'incoming') !== 'outgoing',
      leadId: entityType === 'lead' || entityType === '2' ? num(m.entity_id) ?? num(m.element_id) : num(m.entity_id),
      contactId: num(m.contact_id),
      attachment: att && s(att.link) ? { type: s(att.type), link: s(att.link)!, fileName: s(att.file_name) } : undefined,
      authorName: author ? s(author.name) : undefined,
    });
  }
  const statusChanges: KommoStatusChange[] = [];
  const leadsRoot = p.leads as Nested | undefined;
  for (const key of ['status', 'update']) {
    for (const l of list(leadsRoot?.[key])) {
      const leadId = num(l.id);
      const statusId = num(l.status_id);
      if (leadId && statusId) {
        statusChanges.push({ leadId, statusId, pipelineId: num(l.pipeline_id), price: num(l.price) });
      }
    }
  }
  return { messages, statusChanges };
}

/** Kommo marca "Logrado con éxito" con el id 142 en todos los embudos. */
export const KOMMO_WON_STATUS_ID = 142;

export interface KommoPipelineStatus { id: number; name: string; pipelineId: number }

export class KommoClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`Kommo ${path} respondió ${res.status}`);
    return (await res.json()) as T;
  }

  async statuses(): Promise<KommoPipelineStatus[]> {
    type R = { _embedded: { pipelines: { id: number; _embedded: { statuses: { id: number; name: string }[] } }[] } };
    const r = await this.get<R>('/api/v4/leads/pipelines');
    return r._embedded.pipelines.flatMap(p => p._embedded.statuses.map(st => ({ id: st.id, name: st.name, pipelineId: p.id })));
  }

  async lead(id: number): Promise<{ id: number; price: number; name?: string }> {
    return this.get(`/api/v4/leads/${id}`);
  }

  async contact(id: number): Promise<{ name?: string; phone?: string }> {
    type R = { name?: string; custom_fields_values?: { field_code?: string; values: { value: string }[] }[] | null };
    const r = await this.get<R>(`/api/v4/contacts/${id}`);
    const phone = r.custom_fields_values?.find(f => f.field_code === 'PHONE')?.values[0]?.value;
    return { name: r.name, phone };
  }

  /** Descarga un adjunto. Los links de Kommo suelen ser públicos y firmados; si piden autenticación, se reintenta con el token. */
  async download(link: string): Promise<{ data: Buffer; contentType: string | null }> {
    let res = await this.fetchImpl(link);
    if (res.status === 401 || res.status === 403) res = await this.fetchImpl(link, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`No se pudo descargar el adjunto (${res.status})`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > 10 * 1024 * 1024) throw new Error('El adjunto pesa más de 10 MB');
    return { data, contentType: res.headers.get('content-type') };
  }
}

export function isWonStatus(statusId: number, statusName: string | undefined, keywords: string[]): boolean {
  if (statusId === KOMMO_WON_STATUS_ID) return true;
  if (!statusName) return false;
  const n = statusName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return keywords.some(k => n.includes(k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')));
}
