import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { logger } from './logger.js';
import { get } from './database/index.js';
import { attachUser } from './middleware/auth.js';
import { verifyOrigin } from './middleware/csrf.js';
import { ApiError } from './utils/http.js';
import { authRoutes } from './auth/routes.js';
import { libraryRoutes } from './library/routes.js';
import { userRoutes } from './user/routes.js';
import { adminRoutes } from './admin/routes.js';
import { streamingRoutes } from './streaming/routes.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // Scripts stay same-origin; 'unsafe-inline' is required only for the style
  // attributes the UI uses for art gradients (PRD §121/§122).
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; '),
};

function errorEnvelope(code, message) {
  return { success: false, data: null, error: { code, message } };
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    exposeHeadRoutes: false,
    bodyLimit: 1024 * 1024,
    ignoreTrailingSlash: true,
  });

  await app.register(cookie, { secret: config.sessionSecret });

  // CSRF first (no session needed), then resolve the session (PRD §123/§124).
  app.addHook('onRequest', async (request) => verifyOrigin(request));
  app.addHook('preHandler', async (request) => attachUser(request));

  app.addHook('onSend', async (request, reply, payload) => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) reply.header(header, value);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const status = error.status || error.statusCode || 500;
    if (error instanceof ApiError || status < 500) {
      if (status === 429) logger.warn('rate limited', { url: request.url, ip: request.ip });
      return reply.code(status).send(errorEnvelope(error.code || 'BAD_REQUEST', error.message || 'Request failed'));
    }
    logger.error('unhandled api error', { url: request.url, method: request.method, error: error.message, stack: error.stack });
    return reply.code(500).send(errorEnvelope('INTERNAL_ERROR', 'Internal server error'));
  });

  app.get('/health', async (request, reply) => reply.send({ status: 'ok' }));
  app.get('/ready', async (request, reply) => {
    get('SELECT 1 AS ok');
    return reply.send({ status: 'ready' });
  });

  await app.register(authRoutes);
  await app.register(libraryRoutes);
  await app.register(userRoutes);
  await app.register(adminRoutes);
  await app.register(streamingRoutes);

  /** In production the built frontend is served from `dist/` with SPA fallback. */
  const distDir = path.join(config.root, 'dist');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: distDir,
      wildcard: false,
      index: false,
      // We set Cache-Control ourselves: Vite emits content-hashed asset names,
      // so they can be cached forever while index.html must not be (PRD §62).
      cacheControl: false,
      setHeaders(res, filePath) {
        res.setHeader('Cache-Control', filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
      },
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' || request.url.startsWith('/api') || request.url.startsWith('/health')) {
        return reply.code(404).send(errorEnvelope('NOT_FOUND', 'Not found'));
      }
      return reply.type('text/html').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((request, reply) => {
      if (request.url === '/' || request.url.startsWith('/api')) {
        return reply
          .code(request.url === '/' ? 200 : 404)
          .send(
            request.url === '/'
              ? { status: 'ok', message: 'JoyDM API is running. Build the frontend with `npm run build`, or use `npm run dev` for the Vite dev server.' }
              : errorEnvelope('NOT_FOUND', 'Not found'),
          );
      }
      return reply.code(404).send(errorEnvelope('NOT_FOUND', 'Not found'));
    });
  }

  return app;
}
