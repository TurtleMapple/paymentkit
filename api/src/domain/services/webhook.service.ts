import { PaymentService } from './payment.service';
import { PaymentGateway } from '../gateways/IPaymentGateway';
import { PaymentStatus } from '../entities/paymentStatus';
import { Payment } from '../entities/paymentEntity';

/**
 * WEBHOOK SERVICE (Application Service)
 * 
 * Tanggung Jawab:
 * - Mengordinasi validasi notifikasi dari gateway pembayaran.
 * - Memperbarui status pembayaran di sistem inti melalui PaymentService.
 * - Stateless dan terlepas dari framework HTTP (Hono).
 */
export class WebhookService {
  constructor(private readonly paymentService: PaymentService) { }

  /**
   * Use Case: Memproses notifikasi webhook dari gateway
   * 
   * @param gateway Instance adapter gateway yang sesuai (Midtrans, dll)
   * @param payload Body mentah dari notifikasi gateway
   * @param signature Signature untuk validasi keamanan
   */
  async processWebhook(
    gateway: PaymentGateway,
    payload: any,
    signature: string
  ): Promise<Payment> {
    
    // 1. Validasi Keaslian Webhook (Delegasi ke Gateway Adapter)
    const isValid = gateway.validateWebhook(payload, signature);
    if (!isValid) {
      throw new Error('Invalid webhook: missing required fields or invalid signature');
    }

    // 2. Parsing Data (Translasi dari format vendor ke format domain internal)
    const webhookResult = await gateway.processWebhook(payload);

    // 3. Update Status Pembayaran (Delegasi ke PaymentService / Entity logic)
    const payment = await this.paymentService.updatePaymentStatus(
      webhookResult.orderId,
      webhookResult.status as PaymentStatus,
      {
        type: webhookResult.paymentType,
        paidAt: webhookResult.paidAt,
        gatewayResponse: webhookResult.gatewayResponse,
      }
    );

    return payment;
  }
}
