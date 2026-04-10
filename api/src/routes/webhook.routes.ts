import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { 
  WebhookGatewayParamSchema,
  WebhookRequestSchema,
  WebhookResponseSchema
} from '../schemas/webhook.schema';
import { ErrorResponseSchema } from '../schemas/shared.schema';
import { WebhookHandler } from '../handler/webhook.handler';

const webhook = new OpenAPIHono<{ Variables: { webhookService: any } }>({
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

/**
 * POST /webhooks/{gateway} route definition
 */
const webhookRoute = createRoute({
  method: 'post',
  path: '/{gateway}',
  tags: ['Webhooks'],
  summary: 'Menerima Notifikasi/Webhook dari Payment Gateway',
  description: `### 🚀 Endpoint untuk Vendor (Bukan untuk Frontend)
  Endpoint ini **WAJIB PUBLIK** dan digunakan oleh Payment Gateway (seperti Midtrans) untuk mengabarkan status pembayaran secara otomatis.

  ### 🛠️ Cara Testing (untuk Developer):
  1. Pilih **gateway** (misal: \`midtrans\`).
  2. Gunakan contoh payload di bawah.
  3. **PENTING**: Jika kamu mencoba endpoint ini manual, kirimkan header \`x-signature\` atau pastikan \`signature_key\` di body sesuai dengan perhitungan Midtrans, jika tidak, sistem akan menolak (401).

  ### 📝 Payload yang diharapkan:
  Sistem ini fleksibel (passthrough), namun Midtrans biasanya mengirimkan data seperti contoh di bawah.`,
  request: {
    params: WebhookGatewayParamSchema,
    body: {
      content: {
        'application/json': {
          schema: WebhookRequestSchema.openapi({
            example: {
              transaction_time: "2024-03-24 10:00:00",
              transaction_status: "settlement",
              status_message: "midtrans payment notification",
              status_code: "200",
              signature_key: "masukkan_signature_key_disini",
              payment_type: "bank_transfer",
              order_id: "ORD-12345",
              merchant_id: "G123456789",
              gross_amount: "50000.00",
              currency: "IDR"
            }
          }),
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
  const service = c.get('webhookService');
  const handler = new WebhookHandler(service);
  
  return handler.handleWebhook(c, { gateway }, body);
});

export default webhook;
