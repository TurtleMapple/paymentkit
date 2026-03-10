/**
 * WEBHOOK HANDLER
 * 
 * Menangani notifikasi webhook dari payment gateway
 * Mengikuti prinsip SOLID dengan pemisahan tanggung jawab yang jelas
 * 
 * SOLID Principles Applied:
 * - (S)RP: Single Responsibility - Handler hanya orchestrate, logic di service
 * - (O)CP: Open/Closed - Mudah extend gateway baru tanpa ubah handler
 * - (L)SP: Liskov Substitution - Semua gateway implement interface yang sama
 * - (I)SP: Interface Segregation - Service punya interface yang focused
 * - (D)IP: Dependency Inversion - Depend on abstraction (PaymentGateway interface)
 */

import { Context } from 'hono';
import { Payment } from '../domain/entities/paymentEntity';
import { PaymentGatewayFactory } from '../domain/gateways/PaymentGatewayFactory';

// ===== TYPES =====

/**
 * Gateway yang didukung sistem
 */
type SupportedGateway = 'midtrans';

/**
 * Response sukses webhook
 */
interface WebhookSuccessResponse {
  success: true;
  message: string;
  payment: {
    orderId: string;
    status: string;
  };
  processedAt: string;
}

/**
 * Response error webhook
 */
interface WebhookErrorResponse {
  success: false;
  error: string;
  details?: string;
}

// ===== RESPONSE BUILDERS (SRP: Separate response formatting) =====

/**
 * Membuat response sukses webhook
 */
function buildSuccessResponse(payment: Payment): WebhookSuccessResponse {
  return {
    success: true,
    message: `Webhook berhasil diproses untuk order ${payment.orderId}`,
    payment: {
      orderId: payment.orderId,
      status: payment.status,
    },
    processedAt: new Date().toISOString(),
  };
}

/**
 * Membuat response error webhook
 */
function buildErrorResponse(error: string, details?: string): WebhookErrorResponse {
  return {
    success: false,
    error,
    ...(details && { details }),
  };
}

// ===== ERROR CLASSIFIER (SRP: Separate error handling logic) =====

/**
 * Klasifikasi error dan tentukan HTTP status code
 */
function classifyError(error: any): { statusCode: number; message: string; details?: string } {
  const errorMessage = error.message || 'Unknown error';

  if (errorMessage.includes('Payment not found') || errorMessage.includes('not found')) {
    return {
      statusCode: 404,
      message: 'Payment tidak ditemukan',
      details: errorMessage,
    };
  }

  if (errorMessage.includes('Invalid signature') || errorMessage.includes('signature')) {
    return {
      statusCode: 401,
      message: 'Signature webhook tidak valid',
      details: errorMessage,
    };
  }

  if (errorMessage.includes('Invalid transition') || errorMessage.includes('transition')) {
    return {
      statusCode: 400,
      message: 'Transisi status tidak valid',
      details: errorMessage,
    };
  }

  if (errorMessage.includes('not supported') || errorMessage.includes('Unknown gateway')) {
    return {
      statusCode: 400,
      message: 'Gateway tidak didukung',
      details: errorMessage,
    };
  }

  if (errorMessage.includes('Invalid webhook') || errorMessage.includes('required')) {
    return {
      statusCode: 400,
      message: 'Payload webhook tidak valid',
      details: errorMessage,
    };
  }

  return {
    statusCode: 500,
    message: 'Gagal memproses webhook',
    details: errorMessage,
  };
}

// ===== SIGNATURE EXTRACTOR (SRP: Separate signature extraction) =====

/**
 * Extract signature dari request headers
 * Mendukung berbagai format header dari gateway berbeda
 */
function extractSignature(c: Context): string | null {
  const headers = [
    'x-signature',
    'x-midtrans-signature',
    'x-callback-token',
    'x-hub-signature',
  ];

  for (const header of headers) {
    const signature = c.req.header(header);
    if (signature) {
      return signature;
    }
  }

  return null;
}

// ===== MAIN HANDLER (OCP: Open for extension via services) =====

/**
 * Handler utama untuk webhook endpoint
 * 
 * Endpoint: POST /webhooks/:gateway
 * 
 * Flow:
 * 1. Extract signature dari headers
 * 2. Validasi signature ada
 * 3. Get gateway instance dari factory
 * 4. Process webhook via service (validasi + update)
 * 5. Return response
 */
export async function handleWebhook(
  c: Context,
  gateway: SupportedGateway,
  body: any
) {
  const webhookService = c.get('webhookService');

  try {
    const signature = extractSignature(c);
    if (!signature) {
      return c.json(
        buildErrorResponse(
          'Signature header tidak ditemukan',
          'Header x-signature atau x-midtrans-signature diperlukan'
        ),
        401
      );
    }

    const gatewayInstance = PaymentGatewayFactory.create(gateway);

    const payment = await webhookService.processWebhook(
      gatewayInstance,
      body,
      signature
    );

    return c.json(buildSuccessResponse(payment), 200);

  } catch (error: any) {
    const { statusCode, message, details } = classifyError(error);

    console.error('[Webhook Handler] Error:', {
      gateway,
      orderId: body?.orderId || body?.order_id,
      error: error.message,
      stack: error.stack,
    });

    // Fix: Cast statusCode ke type yang Hono expect
    return c.json(
      buildErrorResponse(message, details),
      statusCode as 400 | 401 | 404 | 500
    );
  }
}

// ===== TESTABILITY EXPORTS =====

/**
 * Export helper functions untuk testing
 */
export const WebhookHandlerHelpers = {
  buildSuccessResponse,
  buildErrorResponse,
  classifyError,
  extractSignature,
};
