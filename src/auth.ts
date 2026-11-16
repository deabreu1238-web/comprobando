import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db.js';
import { randomToken, sha256Hex, verifyPassword } from './crypto.js';

export const SESSION_COOKIE = 'cp_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  role: 'owner' | 'member';
  is_superadmin: boolean;
  account_id: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export async function login(db: Db, email: string, password: string): Promise<{ token: string; user: SessionUser } | null> {
  const r = await db.query<SessionUser & { password_hash: string }>(
    'select id, email, role, is_superadmin, account_id, password_hash from users where lower(email) = lower($1)',
    [email.trim()],
  );
  const u = r.rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  const token = randomToken();
  await db.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    sha256Hex(token), u.id,
  ]);
  const { password_hash: _ignored, ...user } = u;
  return { token, user };
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.query('delete from sessions where token_hash = $1', [sha256Hex(token)]);
}

export async function userFromToken(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const r = await db.query<SessionUser>(
    `select u.id, u.email, u.role, u.is_superadmin, u.account_id from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256Hex(token)],
  );
  return r.rows[0] ?? null;
}

export function requireUser(db: Db) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await userFromToken(db, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'Iniciá sesión para continuar' });
    req.user = user;
  };
}

export function sessionCookie(secure: boolean) {
  return { path: '/', httpOnly: true, sameSite: 'lax' as const, secure, maxAge: SESSION_DAYS * 86400 };
}
