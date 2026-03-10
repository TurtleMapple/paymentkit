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

type Variables = {
  em: EntityManager;
  paymentService: PaymentService;
  webhookService: WebhookService;
};

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

// CORS middleware
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );

  if (c.req.method === "OPTIONS") {
    return c.text("", 200);
  }

  await next();
});

// EntityManager middleware - inject em ke context
app.use('*', async (c, next) => {
  c.set('em', getEntityManager());
  await next();
});

// Service Injection middleware
app.use('*', serviceInjection);

// Health check (tanpa auth)
app.openapi(
  {
    method: 'get',
    path: '/health',
    responses: {
      200: {
        description: 'Health check response',
      },
    },
  },
  (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  }
);

// API Key middleware untuk semua routes kecuali health & docs
app.use('/payments/*', apiKeyAuth);
app.use('/webhooks/*', apiKeyAuth);

// Routes
app.route('/payments', paymentRoutes);
app.route('/webhooks', webhookRoutes);

// OpenAPI JSON with security scheme
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Payment API',
    description: 'Payment Gateway API with RabbitMQ integration',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
});

// Scalar API Documentation UI with authentication
app.get(
  '/reference',
  apiReference({
    theme: 'purple',
    spec: {
      url: '/doc',
    },
    authentication: {
      preferredSecurityScheme: 'ApiKeyAuth',
      apiKey: {
        token: '',
      },
    },
  })
);

// Error handler
app.onError(errorHandler);

export default app;
