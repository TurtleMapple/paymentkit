import { Payment } from '../entities/paymentEntity';
import { PaymentStatus } from '../entities/paymentStatus';

export interface IPaymentRepository {
  findByOrderId(orderId: string): Promise<Payment | null>;
  create(
    orderId: string,
    amount: number,
    gateway: string,
    customerName?: string,
    customerEmail?: string
  ): Promise<Payment>;
  updateStatus(
    orderId: string,
    status: PaymentStatus,
    paymentData?: Partial<Payment>
  ): Promise<Payment>;
  findAllWithCount(options?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }): Promise<{ data: Payment[]; total: number }>;
}
