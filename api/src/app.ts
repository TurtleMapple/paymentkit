import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import paymentRoutes from './routes/payment.routes'; 
import webhookRoutes from './routes/webhook.routes';
import { apiKeyAuth } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { getEntityManager } from './config/db';
import type { EntityManager } from '@mikro-orm/core';
import { serviceInjection } from './middleware/service.middleware';
import { PaymentService } from './domain/services/payment.service';
import { WebhookService } from './domain/services/webhook.service';
import { env } from './config/env';

/**
 * DEFINISI TYPE UNTUK HONO CONTEXT
 */
type Variables = {
  em: EntityManager;
  paymentService: PaymentService;
  webhookService: WebhookService;
};

/**
 * INISIALISASI APLIKASI UTAMA
 * 
 * File ini HANYA mendefinisikan aplikasi HTTP (routes, middleware, error handler).
 * Tidak ada side-effect (startup, shutdown, koneksi DB/MQ) di sini.
 * Lifecycle management ditangani oleh server.ts (entry point).
 */
const app = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }, 400);
    }
  }
});

// 1. GLOBAL MIDDLEWARES
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  if (c.req.method === "OPTIONS") return c.text("", 200);
  await next();
});

// Inject DB & Services ke semua rute
app.use('*', async (c, next) => {
  c.set('em', getEntityManager());
  await next();
});
app.use('*', serviceInjection);

/**
 * 2. HEALTH CHECK (Root Level)
 */
app.openapi(
  {
    method: 'get',
    path: '/health',
    responses: { 200: { description: 'Health check response' } },
  },
  (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

/**
 * 3. GRUP RUTE V1 (Base Path: /v1)
 */
const v1 = new OpenAPIHono<{ Variables: Variables }>();

v1.use('/payments/*', apiKeyAuth);
v1.use('/webhooks/*', apiKeyAuth);

v1.route('/payments', paymentRoutes);
v1.route('/webhooks', webhookRoutes);

app.route('/v1', v1);

/**
 * 4. DOKUMENTASI & OPENAPI
 */
// Registrasi Security Scheme (API Key) secara global di OpenAPI
app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
});

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Payment API',
    description: 'Payment Gateway API with RabbitMQ integration',
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: 'Development server' }],
  // Terapkan security secara global agar muncul di UI untuk semua rute
  security: [{ ApiKeyAuth: [] }],
});

app.get(
  '/reference',
  apiReference({
    theme: 'purple',
    spec: { url: '/doc' },
    authentication: {
      preferredSecurityScheme: 'ApiKeyAuth',
      apiKey: { token: env.API_KEY }, // Otomatis mengisi API Key dari .env Anda
    },
  })
);

// Global Error Handler
app.onError(errorHandler);

export default app;
