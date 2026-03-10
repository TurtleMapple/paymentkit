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
    status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
    paymentType?: string;
    paidAt?: Date;
    gatewayResponse: any;
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
  }
  