import { Context } from 'hono';
import { PaymentGatewayFactory } from '../domain/gateways/PaymentGatewayFactory';
import { buildSuccessResponse } from '../utils/api-response.util';
import { HttpStatus } from '../utils/http-status.util';
import { WebhookGatewayParam } from '../schemas/webhook.schema';

/**
 * WEBHOOK HANDLER (Class-Based)
 * 
 * Fungsi:
 * Menangani notifikasi webhook dari berbagai payment gateway terpusat.
 * 
 * Clean Code & SOLID:
 * - Tidak ada routing error / classify error lagi (pindah ke Middleware).
 * - Tidak ada helper lokal (pindah ke utils).
 * - Menyuntikkan webhookService demi modularity testing.
 */
export class WebhookHandler {

  constructor(private readonly webhookService: any) {}

  /**
   * Mengekstrak signature webhook dari Headers HTTP Hono
   * @private
   */
  private extractSignature(c: Context): string | null {
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

  /**
   * Handler utama untuk endpoint Webhook
   * Endpoint: POST /webhooks/:gateway
   */
  handleWebhook = async (c: Context, gatewayParam: WebhookGatewayParam, body: any) => {
    // 1. Dapatkan signature dari Header
    let signature = this.extractSignature(c);
    
    // 2. Jika tidak ada di header, coba cari di dalam Body (Khusus Midtrans signature_key)
    if (!signature && body && body.signature_key) {
      signature = body.signature_key;
    }

    // 3. Fail Fast jika tetap tidak ditemukan
    if (!signature) {
      throw new Error('Signature tidak ditemukan di header maupun di body payload');
    }

    // 2. Tentukan gateway dari URL parameter
    const gatewayInstance = PaymentGatewayFactory.create(gatewayParam.gateway);

    // 3. Proses di service utama
    const payment = await this.webhookService.processWebhook(
      gatewayInstance,
      body,
      signature
    );

    // 4. Return respon sukses seragam
    const payloadInfo = {
      orderId: payment.orderId,
      status: payment.getStatus()
    };

    return c.json(
      buildSuccessResponse(payloadInfo, `Webhook berhasil diproses untuk pesanan ${payment.orderId}`),
      HttpStatus.OK
    );
  }
}
