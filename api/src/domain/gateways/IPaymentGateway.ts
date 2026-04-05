import { PaymentStatus } from '../entities/paymentStatus';

/**
 * PAYMENT GATEWAY INTERFACE
 * 
 * Interface abstrak untuk payment gateway
 * Memungkinkan support multiple gateway (Midtrans, Xendit, dll)
 * tanpa mengubah business logic
 */

/**
 * Request untuk membuat payment
 */
export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  idempotencyKey?: string; // Mencegah pembuatan ganda pada vendor
}

/**
 * Response setelah membuat payment
 */
export interface CreatePaymentResponse {
  orderId: string;
  paymentLink: string;
  expiredAt?: Date;
  paymentType?: string;
  bank?: string;
  vaNumber?: string;
  gatewayResponse: any;
}

/**
 * Request untuk cek status payment
 */
export interface CheckStatusRequest {
  orderId: string;
}

/**
 * Response status payment
 */
export interface CheckStatusResponse {
  orderId: string;
  status: PaymentStatus;
  paymentType?: string;
  paidAt?: Date;
  gatewayResponse: any;
}

/**
 * Request untuk Refund
 */
export interface RefundRequest {
  orderId: string;
  reason?: string;
}

/**
 * Response dari Refund
 */
export interface RefundResponse {
  orderId: string;
  refundId: string;
  status: PaymentStatus;
  gatewayResponse: any; // Raw response untuk audit
}

/**
 * Interface PaymentGateway
 * Semua payment gateway harus implement interface ini
 */
export interface PaymentGateway {
  /**
   * Nama gateway (midtrans, xendit, dll)
   */
  name: string;

  /**
   * Membuat payment baru
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  /**
   * Cek status payment
   */
  checkStatus(request: CheckStatusRequest): Promise<CheckStatusResponse>;

  /**
   * Validasi signature webhook
   */
  validateWebhook(payload: any, signature?: string): boolean;

  /**
   * Proses webhook dari gateway
   */
  processWebhook(payload: any): Promise<CheckStatusResponse>;

  /**
   * Membatalkan transaksi yang belum dibayar
   */
  cancel(orderId: string): Promise<boolean>;

  /**
   * Mengajukan pengembalian dana penuh
   */
  refund(request: RefundRequest): Promise<RefundResponse>;
}