/**
 * PAYMENT SERVICE
 * 
 * Business logic layer for payment operations
 * Handles state transitions, validations, and orchestration
 */

import { PaymentStatus } from '../entities/paymentStatus';
import { Payment } from '../entities/paymentEntity';
import { IPaymentRepository } from '../repositories/IPaymentRepository';
import { IPaymentEventPublisher } from './IPaymentEventPublisher';

// ===== STATE MACHINE =====

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.EXPIRED],
  [PaymentStatus.PAID]: [],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.EXPIRED]: [],
};

/**
 * Validates if a status transition is allowed
 * Exported for testing purposes
 */
export function validateTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (current === next) return;

  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Invalid transition: ${current} → ${next}. Allowed: [${allowed.join(', ')}]`
    );
  }
}

// ===== SERVICE CLASS =====

export class PaymentService {
  constructor(
    private readonly repo: IPaymentRepository,
    private readonly publisher: IPaymentEventPublisher
  ) { }

  /**
   * Create new payment
   */
  async createPayment(
    orderId: string,
    amount: number,
    gateway: string,
    customerName?: string,
    customerEmail?: string
  ): Promise<Payment> {
    const existing = await this.repo.findByOrderId(orderId);
    if (existing) {
      throw new Error('Order ID already exists');
    }

    const payment = await this.repo.create(
      orderId,
      amount,
      gateway,
      customerName,
      customerEmail
    );

    // ✅ DIP: Menggunakan publisher yang disuntikkan via constructora
    await this.publisher.publishPaymentCreated(orderId);

    return payment;
  }

  /**
   * Update payment status with validation
   */
  async updatePaymentStatus(
    orderId: string,
    newStatus: PaymentStatus,
    paymentData?: Partial<Payment>
  ): Promise<Payment> {
    const payment = await this.repo.findByOrderId(orderId);

    if (!payment) {
      throw new Error(`Payment not found: ${orderId}`);
    }

    // ✅ Validate state transition
    validateTransition(payment.status, newStatus);

    // ✅ Idempotency: Skip if already in final state or same status
    const finalStates = [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.EXPIRED];
    if (payment.status === newStatus || finalStates.includes(payment.status)) {
      return payment;
    }

    const updated = await this.repo.updateStatus(orderId, newStatus, paymentData);

    // ✅ DIP: Menggunakan publisher yang disuntikkan via constructor
    await this.publisher.publishPaymentUpdated(orderId, newStatus);

    return updated;
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    return await this.repo.findByOrderId(orderId);
  }

  /**
   * Get all payments with pagination
   */
  async getAllPayments(options?: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
  }) {
    return await this.repo.findAllWithCount(options);
  }
}
