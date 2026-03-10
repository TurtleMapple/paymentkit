/**
 * WEBHOOK SERVICE
 * 
 * Business logic for webhook processing
 * Orchestrates gateway validation and payment updates
 */

import { Context } from 'hono';
import { PaymentService } from './payment.service';
import { PaymentGateway } from '../gateways/IPaymentGateway';
import { PaymentStatus } from '../entities/paymentStatus';
import { Payment } from '../entities/paymentEntity';

// ===== CONSTANTS =====

const SIGNATURE_HEADERS = ['x-signature', 'x-midtrans-signature', 'x-callback-token'] as const;

// ===== SERVICE =====

export class WebhookService {
  constructor(private readonly paymentService: PaymentService) { }

  /**
   * Extract signature from request headers
   */
  extractSignature(c: Context): string | undefined {
    for (const header of SIGNATURE_HEADERS) {
      const signature = c.req.header(header);
      if (signature) return signature;
    }
    return undefined;
  }

  /**
   * Process webhook with validation and state machine
   */
  async processWebhook(
    gateway: PaymentGateway,
    payload: any,
    signature: string
  ): Promise<Payment> {
    // 1. Validate webhook (gateway handles signature + required fields)
    const isValid = gateway.validateWebhook(payload, signature);
    if (!isValid) {
      throw new Error('Invalid webhook: missing required fields or invalid signature');
    }

    // 2. Process webhook payload (gateway handles parsing)
    const webhookResult = await gateway.processWebhook(payload);

    // 3. Update payment (PaymentService handles state machine + idempotency)
    const payment = await this.paymentService.updatePaymentStatus(
      webhookResult.orderId,
      // amazonq-ignore-next-line
      // amazonq-ignore-next-line
      // amazonq-ignore-next-line
      webhookResult.status as PaymentStatus,
      {
        paymentType: webhookResult.paymentType,
        paidAt: webhookResult.paidAt,
        gatewayResponse: webhookResult.gatewayResponse,
      }
    );

    return payment;
  }
}
