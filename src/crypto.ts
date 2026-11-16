import crypto from 'node:crypto';

// Alfabeto de los códigos: sin 0/O ni 1/I/L, para que nadie los confunda al dictarlos.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = new RegExp(`[${CODE_ALPHABET}]{8}`);

export function newCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// --- contraseñas (scrypt, sin dependencias nativas) ---
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, got);
}

// --- cifrado de tokens guardados (AES-256-GCM) ---
function key(encryptionKey: string): Buffer {
  const k = Buffer.from(encryptionKey, 'base64');
  if (k.length !== 32) throw new Error('APP_ENCRYPTION_KEY tiene que ser 32 bytes en base64 (openssl rand -base64 32)');
  return k;
}

export function encrypt(plain: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(encryptionKey), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}

export function decrypt(payload: string, encryptionKey: string): string {
  const [iv, tag, enc] = payload.split('.').map(p => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(encryptionKey), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

/** Normaliza un teléfono argentino a 549 + área + número, para el hash que pide Meta. */
export function normalizePhoneAR(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (!d) return d;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  // quita el "15" de celulares escritos a la antigua (ej. 11 15 5555 5555)
  if (d.length === 12 && /^(\d{2,4})15/.test(d)) {
    const m = d.match(/^(\d{2})15(\d{8})$/) ?? d.match(/^(\d{3})15(\d{7})$/) ?? d.match(/^(\d{4})15(\d{6})$/);
    if (m) d = m[1] + m[2];
  }
  return d.length === 10 ? `549${d}` : raw.replace(/\D/g, '');
}
