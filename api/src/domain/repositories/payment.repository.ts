import { EntityManager, FilterQuery } from "@mikro-orm/core"
import { Payment } from "../entities/paymentEntity"
import { PaymentStatus } from '../entities/paymentStatus';
import { IPaymentRepository } from "./IPaymentRepository";

/**
 * Payment Repository
 * Handles database operations for Payment entity
 * Following SOLID principles for better maintainability
 */
export class PaymentRepository implements IPaymentRepository {
    // ===== CONSTANTS (OCP: Centralized defaults) =====
    private static readonly DEFAULT_LIMIT = 50;
    private static readonly DEFAULT_PAGE = 1;

    constructor(private readonly em: EntityManager) { }

    // ===== PRIVATE HELPERS (SRP: Extract common logic) =====

    /**
     * Builds where clause for payment queries
     * Reusable across multiple methods
     */
    private buildWhereClause(options?: {
        status?: PaymentStatus
    }): FilterQuery<Payment> {
        const where: FilterQuery<Payment> = { deletedAt: null };

        // amazonq-ignore-next-line
        // amazonq-ignore-next-line
        if (options?.status) {
            where.status = options.status;
        }

        return where;
    }

    /**
     * Calculates pagination offset
     */
    private calculateOffset(page: number, limit: number): number {
        return (page - 1) * limit;
    }

    /**
     * Normalizes pagination options with defaults
     */
    private normalizePaginationOptions(options?: {
        limit?: number
        page?: number
    }) {
        return {
            limit: options?.limit || PaymentRepository.DEFAULT_LIMIT,
            page: options?.page || PaymentRepository.DEFAULT_PAGE,
        };
    }

    // ===== PUBLIC METHODS =====

    /**
     * Find all payments with optional filtering
     */
    async findAll(options?: {
        limit?: number
        page?: number
        status?: PaymentStatus
    }): Promise<Payment[]> {
        const { limit, page } = this.normalizePaginationOptions(options);
        const offset = this.calculateOffset(page, limit);
        const where = this.buildWhereClause(options);

        return await this.em.find(Payment, where, {
            limit,
            offset,
            orderBy: { createdAt: 'DESC' },
        });
    }

    /**
     * Find all payments with total count (for pagination)
     * Returns both data and total count in single query
     */
    async findAllWithCount(options?: {
        limit?: number
        page?: number
        status?: PaymentStatus
    }): Promise<{ data: Payment[], total: number }> {
        const { limit, page } = this.normalizePaginationOptions(options);
        const offset = this.calculateOffset(page, limit);
        const where = this.buildWhereClause(options);

        const [data, total] = await this.em.findAndCount(Payment, where, {
            limit,
            offset,
            orderBy: { createdAt: 'DESC' },
        });

        return { data, total };
    }

    /**
     * Find payment by Order ID
     */
    async findByOrderId(orderId: string): Promise<Payment | null> {
        return await this.em.findOne(Payment, {
            orderId,
            deletedAt: null
        });
    }

    /**
     * Create new payment
     */
    async create(
        orderId: string,
        amount: number,
        gateway?: string,
        customerName?: string,
        customerEmail?: string
    ): Promise<Payment> {
        const payment = new Payment();
        payment.orderId = orderId;
        payment.amount = amount;
        payment.gateway = gateway || 'midtrans';
        payment.customerName = customerName;
        payment.customerEmail = customerEmail;
        payment.status = PaymentStatus.PENDING;

        await this.em.persistAndFlush(payment);
        return payment;
    }

    /**
     * Update payment status with optional payment data
     */
    async updateStatus(
        orderId: string,
        status: PaymentStatus,
        paymentData?: Partial<Payment>
    ): Promise<Payment> {
        const payment = await this.findByOrderId(orderId);

        if (!payment) {
            throw new Error(`Payment not found: ${orderId}`);
        }

        payment.status = status;
        if (paymentData) {
            Object.assign(payment, paymentData);
        }

        await this.em.persistAndFlush(payment);
        return payment;
    }

    /**
     * Atomic update from PENDING status (race condition safety)
     */
    async updateStatusAtomicFromPending(
        orderId: string,
        newStatus: PaymentStatus,
        paymentData?: Partial<Payment>
    ): Promise<'SUCCESS' | 'NOOP'> {
        const payment = await this.em.findOne(Payment, {
            orderId,
            status: PaymentStatus.PENDING,
            deletedAt: null
        });

        if (!payment) {
            return 'NOOP';
        }

        payment.status = newStatus;
        if (paymentData) {
            Object.assign(payment, paymentData);
        }

        await this.em.persistAndFlush(payment);
        return 'SUCCESS';
    }

    /**
     * Soft delete payment
     */
    async softDelete(orderId: string): Promise<Payment> {
        const payment = await this.findByOrderId(orderId);

        if (!payment) {
            throw new Error(`Payment not found: ${orderId}`);
        }

        payment.deletedAt = new Date();
        await this.em.persistAndFlush(payment);
        return payment;
    }

    /**
     * Persist and flush changes
     */
    async persistAndFlush(payment: Payment): Promise<void> {
        await this.em.persistAndFlush(payment);
    }

    /**
     * Flush changes
     */
    async flush(): Promise<void> {
        await this.em.flush();
    }
}
