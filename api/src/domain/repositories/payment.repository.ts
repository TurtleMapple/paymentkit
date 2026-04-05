import { EntityManager, FilterQuery } from "@mikro-orm/core"
import { Payment } from "../entities/paymentEntity"
import { PaymentStatus } from '../entities/paymentStatus';
import { IPaymentRepository } from "./IPaymentRepository";

/**
 * Payment Repository
 * Implementasi persistensi data untuk entitas Payment menggunakan MikroORM.
 */
export class PaymentRepository implements IPaymentRepository {
    private static readonly DEFAULT_LIMIT = 50;
    private static readonly DEFAULT_PAGE = 1;

    constructor(private readonly em: EntityManager) { }

    /**
     * Mengambil satu data pembayaran berdasarkan Order ID
     */
    async findByOrderId(orderId: string): Promise<Payment | null> {
        return await this.em.findOne(Payment, {
            orderId,
            deletedAt: null
        });
    }

    /**
     * Menyimpan (Insert/Update) Entitas ke Database
     */
    async save(payment: Payment): Promise<void> {
        await this.em.persistAndFlush(payment);
    }

    /**
     * Menghapus Entitas (Soft Delete via Domain Method)
     */
    async delete(payment: Payment): Promise<void> {
        payment.softDelete();
        await this.em.persistAndFlush(payment);
    }

    /**
     * Mengambil daftar pembayaran dengan pagination dan filter status
     */
    async findAllWithCount(options?: {
        limit?: number
        page?: number
        status?: PaymentStatus
    }): Promise<{ data: Payment[], total: number }> {
        const limit = options?.limit || PaymentRepository.DEFAULT_LIMIT;
        const page = options?.page || PaymentRepository.DEFAULT_PAGE;
        const offset = (page - 1) * limit;

        const where: any = { deletedAt: null };
        if (options?.status) {
            where.status = options.status;
        }

        const [data, total] = await this.em.findAndCount(Payment, where, {
            limit,
            offset,
            orderBy: { createdAt: 'DESC' },
        });

        return { data, total };
    }
}

