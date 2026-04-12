import crypto from 'crypto';
import {
  PaymentGateway,
  CreatePaymentRequest,
  CreatePaymentResponse,
  CheckStatusRequest,
  CheckStatusResponse,
  RefundRequest,
  RefundResponse
} from './IPaymentGateway';
import { PaymentStatus } from '../entities/paymentStatus';
import {
  BaseGatewayException,
  GatewayTimeoutException,
  GatewayAuthException,
  GatewayValidationException
} from '../exceptions/gateway.exception';
import { logger } from '../../utils/logger';
import { maskSensitiveData } from '../../utils/masking.util';

/**
 * MIDTRANS PAYMENT GATEWAY
 * 
 * Integration dengan Midtrans API
 * Docs: https://docs.midtrans.com/
 */
export class MidtransPaymentGateway implements PaymentGateway {
  name = 'midtrans';

  private readonly baseUrl = process.env.MIDTRANS_BASE_URL || 'https://api.sandbox.midtrans.com';
  // amazonq-ignore-next-line
  private readonly serverKey = process.env.MIDTRANS_SERVER_KEY || '';

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { orderId, amount, customerName, customerEmail, idempotencyKey } = request;

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: customerName || 'Customer',
        email: customerEmail || 'customer@example.com',
      },
      usage_limit: 1,
      expiry: {
        duration: 15,
        unit: 'minutes',
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
      'Accept': 'application/json',
    };

    // Implemen IDEMPOTENCY
    const idempotency = idempotencyKey || orderId;
    headers['X-Idempotency-Key'] = idempotency;

    logger.debug(`[Midtrans] Creating payment request: ${orderId}`, maskSensitiveData(payload));

    try {
      const response = await fetch(`${this.baseUrl}/v1/payment-links`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, 'CreatePayment');
      }

      const data = await response.json();
      logger.debug(`[Midtrans] Create payment response: ${orderId}`, maskSensitiveData(data));

      const expiredAt = data.expiry_time 
        ? new Date(data.expiry_time) 
        : new Date(Date.now() + 15 * 60 * 1000);

      return {
        orderId,
        paymentLink: data.payment_url,
        expiredAt,
        paymentType: 'payment_link',
        gatewayResponse: data,
      };
    } catch (error) {
      this.handleNetworkError(error);
    }
  }

  async checkStatus(request: CheckStatusRequest): Promise<CheckStatusResponse> {
    logger.debug(`[Midtrans] Checking status: ${request.orderId}`);
    try {
      const response = await fetch(`${this.baseUrl}/v2/${request.orderId}/status`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
           return {
             orderId: request.orderId,
             status: PaymentStatus.PENDING,
             gatewayResponse: null
           };
        }
        await this.handleErrorResponse(response, 'CheckStatus');
      }

      const data = await response.json();
      logger.debug(`[Midtrans] Check status response: ${request.orderId}`, maskSensitiveData(data));

      return {
        orderId: this.extractOriginalOrderId(data.order_id),
        status: this.mapStatus(data.transaction_status),
        paymentType: data.payment_type,
        paidAt: data.settlement_time ? new Date(data.settlement_time) : undefined,
        gatewayResponse: data,
      };
    } catch (error) {
      if (error instanceof BaseGatewayException) throw error;
      this.handleNetworkError(error);
    }
  }

  validateWebhook(payload: any, signature?: string): boolean {
    if (!payload || !signature) return false;

    const { order_id, status_code, gross_amount } = payload;
    if (!order_id || !status_code || !gross_amount) return false;

    const signatureString = `${order_id}${status_code}${gross_amount}${this.serverKey}`;
    const hash = crypto.createHash('sha512').update(signatureString).digest('hex');

    return hash === signature;
  }

  async processWebhook(payload: any): Promise<CheckStatusResponse> {
    logger.debug(`[Midtrans] Processing webhook for: ${payload.order_id}`, maskSensitiveData(payload));
    return {
      orderId: this.extractOriginalOrderId(payload.order_id),
      status: this.mapStatus(payload.transaction_status),
      paymentType: payload.payment_type,
      paidAt: payload.settlement_time ? new Date(payload.settlement_time) : undefined,
      gatewayResponse: payload,
    };
  }

  async cancel(orderId: string): Promise<boolean> {
    logger.debug(`[Midtrans] Cancelling order: ${orderId}`);
    try {
      const response = await fetch(`${this.baseUrl}/v2/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 412 || response.status === 404) {
            return true;
        }
        await this.handleErrorResponse(response, 'CancelPayment');
      }

      const data = await response.json();
      logger.debug(`[Midtrans] Cancel response: ${orderId}`, maskSensitiveData(data));
      
      return data.status_code === '200' || data.status_code === '412';
    } catch (error) {
      this.handleNetworkError(error);
    }
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    logger.debug(`[Midtrans] Refunding order: ${request.orderId}`);
    try {
      const response = await fetch(`${this.baseUrl}/v2/${request.orderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
          'Accept': 'application/json',
          'X-Idempotency-Key': `refund-${request.orderId}`
        },
        body: JSON.stringify({
          refund_key: `refund-${request.orderId}-${Date.now()}`,
          reason: request.reason || 'Requested by customer'
        })
      });

      if (!response.ok) {
        await this.handleErrorResponse(response, 'RefundPayment');
      }

      const data = await response.json();
      logger.debug(`[Midtrans] Refund response: ${request.orderId}`, maskSensitiveData(data));

      return {
        orderId: request.orderId,
        refundId: data.refund_key || `midtrans-refund-${Date.now()}`,
        status: PaymentStatus.REFUNDED,
        gatewayResponse: data
      };
    } catch (error) {
       this.handleNetworkError(error);
    }
  }

  private mapStatus(status: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      'pending': PaymentStatus.PENDING,
      'settlement': PaymentStatus.PAID,
      'capture': PaymentStatus.PAID,
      'deny': PaymentStatus.FAILED,
      'cancel': PaymentStatus.CANCELLED,
      'expire': PaymentStatus.EXPIRED,
      'failure': PaymentStatus.FAILED,
      'refund': PaymentStatus.REFUNDED
    };
    return map[status?.toLowerCase()] || PaymentStatus.PENDING;
  }

  /**
   * Helper: Midtrans Payment Links appends a timestamp (e.g. -1775792567579) to the order_id 
   * to ensure uniqueness internally on their side.
   * This method robustly extracts our original order_id using regex.
   */
  private extractOriginalOrderId(rawOrderId: string): string {
    if (!rawOrderId) return rawOrderId;
    
    // Pattern: Mencari tanda hubung '-' diikuti oleh 10-15 digit angka di akhir string.
    // Ini adalah pola standar timestamp yang ditambahkan Midtrans Paylink.
    const timestampPattern = /-(\d{10,15})$/;
    
    if (timestampPattern.test(rawOrderId)) {
      return rawOrderId.replace(timestampPattern, '');
    }
    
    return rawOrderId;
  }

  // --- CENTRALIZED ERROR HANDLING --- //

  private async handleErrorResponse(response: Response, action: string): Promise<never> {
     let errorBody;
     try {
         errorBody = await response.json();
     } catch (e) {
         try {
             errorBody = await response.text();
         } catch {
             errorBody = 'Unknown error body';
         }
     }
     
     logger.error(`[Midtrans] Error in ${action}`, maskSensitiveData(errorBody));

     const status = response.status;
     if (status === 401 || status === 403) {
         throw new GatewayAuthException(`Autentikasi Midtrans ditolak (${status})`, errorBody);
     }
     if (status === 400 || (status > 400 && status < 500)) {
         throw new GatewayValidationException(`Validasi Midtrans gagal (${status})`, errorBody);
     }
     
     throw new BaseGatewayException(`Kesalahan Server Midtrans (${status})`, errorBody);
  }

  private handleNetworkError(error: any): never {
      if (error instanceof BaseGatewayException) {
          throw error;
      }
      
      logger.error(`[Midtrans] Network Error`, error);

      if (error.name === 'AbortError' || error.name === 'FetchError' || error.message?.includes('timeout')) {
          throw new GatewayTimeoutException(`Koneksi ke Midtrans terputus: ${error.message}`, error);
      }

      throw new BaseGatewayException(`Kesalahan tak terduga dengan Midtrans: ${error.message}`, error);
  }
}
