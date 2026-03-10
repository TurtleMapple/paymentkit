import { PaymentStatus } from '../entities/paymentStatus';

export interface IPaymentEventPublisher {
  publishPaymentCreated(orderId: string): Promise<void>;
  publishPaymentUpdated(orderId: string, status: PaymentStatus): Promise<void>;
}
