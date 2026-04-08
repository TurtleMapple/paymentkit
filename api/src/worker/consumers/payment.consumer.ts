import { ConsumeMessage } from 'amqplib';
import { getEntityManager } from '../../config/db';
import { Payment } from '../../domain/entities/paymentEntity';
import { PaymentStatus } from '../../domain/entities/paymentStatus';
import { PaymentGatewayFactory } from '../../domain/gateways/PaymentGatewayFactory';
import { BaseConsumer, ConsumerConfig } from '../../domain/services/rabbitmq/consumer';
import { QUEUES } from '../../domain/services/rabbitmq/topology';
import { logger } from '../../utils/logger';

/**
 * Tipe data payload yang diterima dari antrean payment.process_created
 */
interface PaymentCreatedPayload {
  orderId: string;
}

/**
 * PAYMENT CREATED CONSUMER
 *
 * @standarisasi
 * - Single Responsibility: Hanya menangani pesan dari antrean payment.process_created
 * - Idempotency: Mengecek apakah payment sudah memiliki paymentLink sebelum memanggil API gateway
 * - Manual ACK: Pesan hanya di-acknowledge setelah data berhasil disimpan ke database
 * - Exponential Backoff: Retry dengan jeda 5s → 10s → 20s sebelum masuk ke DLQ
 * - Correlation ID: Menggunakan messageId dari publisher untuk pelacakan end-to-end
 *
 * @architecture
 * payment.exchange → [payment.created] → payment.process_created → PaymentCreatedConsumer
 *                                                                         ↓ (handle)
 *                                                                   Database + Midtrans API
 */
export class PaymentCreatedConsumer extends BaseConsumer<PaymentCreatedPayload> {
  protected readonly queueName = QUEUES.PAYMENT_CREATED;

  protected readonly consumerConfig: ConsumerConfig = {
    maxRetries: 3,
    baseRetryDelay: 5000, // 5s → 10s → 20s (exponential)
    consumerTag: 'payment.created.consumer',
  };

  private readonly gateway = PaymentGatewayFactory.create('midtrans');

  /**
   * Pengecekan Idempotensi:
   * Jika payment sudah memiliki paymentLink, berarti sudah pernah diproses oleh gateway.
   * Kita skip agar tidak terjadi double-billing.
   */
  protected async isAlreadyProcessed(data: PaymentCreatedPayload): Promise<boolean> {
    const em = getEntityManager().fork();
    const payment = await em.findOne(Payment, { orderId: data.orderId });

    if (!payment) {
      // Payment belum ada di DB — ini bukan duplikasi, tapi data belum siap.
      // Biarkan handle() yang menangani kasus ini.
      return false;
    }

    // Jika sudah memiliki payment link, berarti sudah diproses
    if (payment.paymentLink) {
      logger.warn(`⚠️ [payment.created.consumer] Payment ${data.orderId} already has paymentLink. Skipping.`);
      return true;
    }

    return false;
  }

  /**
   * Logika bisnis utama:
   * 1. Ambil data payment dari database
   * 2. Panggil API Midtrans untuk membuat transaksi
   * 3. Simpan respons gateway ke database
   */
  protected async handle(data: PaymentCreatedPayload, msg: ConsumeMessage): Promise<void> {
    const { orderId } = data;
    const correlationId = msg.properties.messageId || 'unknown';
    const em = getEntityManager().fork();

    logger.info(`⚙️ [payment.created.consumer] Processing payment: ${orderId} (correlationId: ${correlationId})`);

    // 1. Ambil data payment
    const payment = await em.findOne(Payment, { orderId });
    if (!payment) {
      throw new PaymentNotFoundError(orderId);
    }

    // 2. Panggil API Gateway (Midtrans)
    logger.debug(`📡 [payment.created.consumer] Calling Midtrans API for: ${orderId}`);

    const result = await this.gateway.createPayment({
      orderId: payment.orderId,
      amount: payment.getAmount(),
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      idempotencyKey: payment.orderId,
    });

    // 3. Update payment entity dengan respons gateway
    payment.paymentLink = result.paymentLink;
    payment.expiredAt = result.expiredAt;
    payment.paymentType = result.paymentType;
    payment.bank = result.bank;
    payment.vaNumber = result.vaNumber;
    payment.gatewayResponse = result.gatewayResponse;
    payment.incrementAttempt();

    await em.persistAndFlush(payment);

    logger.success(`✅ [payment.created.consumer] Payment processed: ${orderId} → Link: ${result.paymentLink}`);
  }

  /**
   * Menentukan apakah error layak untuk di-retry:
   * - PaymentNotFoundError: TIDAK di-retry (error logis, data memang tidak ada)
   * - Error lainnya (network timeout, API error): DI-RETRY
   */
  protected isRetryableError(error: Error): boolean {
    if (error instanceof PaymentNotFoundError) {
      return false;
    }
    return true;
  }
}

/**
 * Custom Error: Payment tidak ditemukan di database.
 * Ditandai sebagai non-retryable karena merupakan error logis.
 */
class PaymentNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Payment not found in database: ${orderId}`);
    this.name = 'PaymentNotFoundError';
  }
}

/**
 * LEGACY EXPORTS
 * Menjaga kompatibilitas dengan worker/index.ts yang memanggil fungsi-fungsi ini.
 */
const consumerInstance = new PaymentCreatedConsumer();

export const startPaymentConsumer = async (): Promise<void> => {
  await consumerInstance.start();
};

export const stopPaymentConsumer = async (): Promise<void> => {
  await consumerInstance.stop();
};
