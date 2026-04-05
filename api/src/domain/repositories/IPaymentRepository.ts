import { Payment } from '../entities/paymentEntity';
import { PaymentStatus } from '../entities/paymentStatus';

export interface IPaymentRepository {
  /**
   * Mendapatkan data pembayaran berdasarkan Order ID
   */
  findByOrderId(orderId: string): Promise<Payment | null>;

  /**
   * Menyimpan (insert or update) pembayaran ke database
   */
  save(payment: Payment): Promise<void>;

  /**
   * Mendapatkan daftar pembayaran dengan pagination dan filter
   */
  findAllWithCount(options?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }): Promise<{ data: Payment[]; total: number }>;

  /**
   * Menghapus pembayaran (biasanya soft delete)
   */
  delete(payment: Payment): Promise<void>;
}
