import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import fstatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Deps } from './services/engine.js';
import { publicRoutes } from './routes/public.js';
import { kommoRoutes } from './routes/kommo.js';
import { apiRoutes } from './routes/api.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(deps: Deps, opts: { publicUrl: string; cookieSecure: boolean; logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 15 * 1024 * 1024, trustProxy: true });
  await app.register(cookie);
  await app.register(formbody); // Kommo manda los webhooks como formulario
  // sendBeacon manda texto plano: lo parseamos en la ruta
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => done(null, body));

  publicRoutes(app, deps, opts.publicUrl);
  kommoRoutes(app, deps);
  apiRoutes(app, deps, opts);

  await app.register(fstatic, { root: path.resolve(here, '..', 'public'), prefix: '/' });
  return app;
}
