/**
 * WEBHOOK ROUTES
 * 
 * Handles webhook notifications from payment gateways
 * Following SOLID principles for better maintainability
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { 
  WebhookGatewayParamSchema,
  WebhookRequestSchema,
  WebhookResponseSchema
} from '../schemas/webhook.schema';
import { ErrorResponseSchema } from '../schemas/payment.schema';
import { handleWebhook } from '../handler/webhook.handler';

const webhook = new OpenAPIHono();

// ===== ROUTE DEFINITION (SRP: Separate route config) =====

/**
 * POST /webhooks/:gateway route definition
 * Receives and processes webhook notifications from payment gateways
 * 
 * Supported gateways: midtrans
 */
const webhookRoute = createRoute({
  method: 'post',
  path: '/{gateway}',
  request: {
    params: WebhookGatewayParamSchema,
    body: {
      content: {
        'application/json': {
          schema: WebhookRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WebhookResponseSchema,
        },
      },
      description: 'Webhook processed successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid webhook data or status transition',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Missing or invalid signature',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Payment not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error during webhook processing',
    },
  },
});

// ===== ROUTE REGISTRATION (SRP: Separate registration logic) =====

/**
 * Register POST /webhooks/:gateway endpoint
 */
webhook.openapi(webhookRoute, async (c) => {
  const { gateway } = c.req.valid('param');
  const body = c.req.valid('json');
  
  return handleWebhook(c, gateway, body);
});

export default webhook;
