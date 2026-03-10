import crypto from 'crypto';
import {
  PaymentGateway,
  CreatePaymentRequest,
  CreatePaymentResponse,
  CheckStatusRequest,
  CheckStatusResponse,
} from './IPaymentGateway';

/**
 * MIDTRANS PAYMENT GATEWAY
 * 
 * Integration dengan Midtrans Payment Link API
 * Docs: https://docs.midtrans.com/reference/create-payment-link
 */
export class MidtransPaymentGateway implements PaymentGateway {
  name = 'midtrans';
  
  private readonly baseUrl = process.env.MIDTRANS_BASE_URL || 'https://api.sandbox.midtrans.com';
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  private readonly serverKey = process.env.MIDTRANS_SERVER_KEY || '';

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const { orderId, amount, customerName, customerEmail } = request;
  
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
        duration: 24,
        unit: 'hours',
      },
    };
  
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    const response = await fetch(`${this.baseUrl}/v1/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Midtrans API error: ${error}`);
    }
  
    // amazonq-ignore-next-line
    const data = await response.json();
  
    // Calculate expiry time (24 hours from now)
    const expiredAt = data.expiry_time 
      ? new Date(data.expiry_time) 
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
  
    return {
      orderId,
      paymentLink: data.payment_url,
      expiredAt,
      paymentType: 'payment_link',
      gatewayResponse: data,
    };
  }

  async checkStatus(request: CheckStatusRequest): Promise<CheckStatusResponse> {
    const response = await fetch(
      // amazonq-ignore-next-line
      `${this.baseUrl}/v2/${request.orderId}/status`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.serverKey + ':').toString('base64')}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`);
    }

    // amazonq-ignore-next-line
    const data = await response.json();

    return {
      orderId: data.order_id,
      status: this.mapStatus(data.transaction_status),
      paymentType: data.payment_type,
      paidAt: data.settlement_time ? new Date(data.settlement_time) : undefined,
      gatewayResponse: data,
    };
  }

  validateWebhook(payload: any, signature?: string): boolean {
    if (!payload || !signature) return false;
    
    const { order_id, status_code, gross_amount } = payload;
    if (!order_id || !status_code || !gross_amount) return false;

    // Verify signature
    const signatureString = `${order_id}${status_code}${gross_amount}${this.serverKey}`;
    const hash = crypto.createHash('sha512').update(signatureString).digest('hex');
    
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    // amazonq-ignore-next-line
    return hash === signature;
  }

  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  async processWebhook(payload: any): Promise<CheckStatusResponse> {
    return {
      orderId: payload.order_id,
      status: this.mapStatus(payload.transaction_status),
      paymentType: payload.payment_type,
      paidAt: payload.settlement_time ? new Date(payload.settlement_time) : undefined,
      gatewayResponse: payload,
    };
  }

  private mapStatus(status: string): 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' {
    const map: Record<string, any> = {
      'pending': 'PENDING',
      'settlement': 'PAID',
      'capture': 'PAID',
      'deny': 'FAILED',
      'cancel': 'EXPIRED',
      'expire': 'EXPIRED',
      'failure': 'FAILED',
    };
    return map[status?.toLowerCase()] || 'PENDING';
  }
}
