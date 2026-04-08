import { Channel } from 'amqplib';
import { logger } from '../../../utils/logger';

/**
 * RABBITMQ REGISTRY (Constants)
 *
 * @standarisasi
 * - Naming Convention: lowercase + dot separator (${service}.${purpose})
 * - Registry Pattern: Sentralisasi nama Exchange, Queue, dan Routing Key.
 * - Idempotensi: Menggunakan assert agar infrastruktur dibuat otomatis jika belum ada.
 */

// ─── EXCHANGES ───────────────────────────────────────────────
export const EXCHANGES = {
  /** Main exchange untuk routing pesan payment (topic) */
  PAYMENT: 'payment.exchange',
  /** Dead Letter Exchange — menampung pesan yang gagal diproses setelah max retry */
  PAYMENT_DLX: 'payment.dlx',
} as const;

// ─── QUEUES ──────────────────────────────────────────────────
export const QUEUES = {
  /** Antrean untuk memproses pembuatan payment baru (consumer utama) */
  PAYMENT_CREATED: 'payment.process_created',
  /** Antrean untuk memproses update status payment */
  PAYMENT_UPDATED: 'payment.process_updated',
  /** Antrean untuk memproses webhook yang diterima */
  PAYMENT_WEBHOOK: 'payment.process_webhook',
  /** Dead Letter Queue — pesan yang sudah tidak bisa di-retry */
  PAYMENT_DLQ: 'payment.dead_letter',
} as const;

// ─── ROUTING KEYS ────────────────────────────────────────────
export const ROUTING_KEYS = {
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_UPDATED: 'payment.updated',
  PAYMENT_WEBHOOK: 'payment.webhook',
} as const;

/**
 * RABBITMQ TOPOLOGY SETUP
 *
 * @standarisasi
 * - Durability: durable: true — survive broker restart.
 * - Dead Letter Exchange (DLX): Mengarahkan pesan gagal ke DLQ.
 * - Persistent Messages: Pesan disimpan ke disk oleh broker.
 *
 * @architecture
 * Publisher → payment.exchange → [routing key] → payment.process_* → Consumer
 *                                                      ↓ (nack, max retry)
 *                                                 payment.dlx → payment.dead_letter
 */
export class RabbitMQTopology {
  /**
   * Mendeklarasikan seluruh infrastruktur RabbitMQ (idempotent).
   * Aman dipanggil berulang kali — assert tidak menimpa konfigurasi yang sudah ada.
   */
  public static async setup(channel: Channel): Promise<void> {
    logger.info('🚀 Setting up RabbitMQ Topology (Exchanges, Queues, Bindings)...');

    try {
      // ── 1. Dead Letter Infrastructure ──────────────────────
      await channel.assertExchange(EXCHANGES.PAYMENT_DLX, 'fanout', { durable: true });
      await channel.assertQueue(QUEUES.PAYMENT_DLQ, { durable: true });
      await channel.bindQueue(QUEUES.PAYMENT_DLQ, EXCHANGES.PAYMENT_DLX, '');

      // ── 2. Main Exchange ───────────────────────────────────
      await channel.assertExchange(EXCHANGES.PAYMENT, 'topic', { durable: true });

      // ── 3. Main Queues ─────────────────────────────────────
      const queueOptions = {
        durable: true,
        deadLetterExchange: EXCHANGES.PAYMENT_DLX,
      };

      await channel.assertQueue(QUEUES.PAYMENT_CREATED, queueOptions);
      await channel.assertQueue(QUEUES.PAYMENT_UPDATED, queueOptions);
      await channel.assertQueue(QUEUES.PAYMENT_WEBHOOK, queueOptions);

      // ── 4. Bindings ────────────────────────────────────────
      await channel.bindQueue(QUEUES.PAYMENT_CREATED, EXCHANGES.PAYMENT, ROUTING_KEYS.PAYMENT_CREATED);
      await channel.bindQueue(QUEUES.PAYMENT_UPDATED, EXCHANGES.PAYMENT, ROUTING_KEYS.PAYMENT_UPDATED);
      await channel.bindQueue(QUEUES.PAYMENT_WEBHOOK, EXCHANGES.PAYMENT, ROUTING_KEYS.PAYMENT_WEBHOOK);

      logger.success('✅ RabbitMQ Topology setup complete');
      logger.debug(`   Exchanges: ${Object.values(EXCHANGES).join(', ')}`);
      logger.debug(`   Queues: ${Object.values(QUEUES).join(', ')}`);
      logger.debug(`   Routing Keys: ${Object.values(ROUTING_KEYS).join(', ')}`);
    } catch (error) {
      logger.error('❌ Failed to setup RabbitMQ Topology:', error);
      throw error;
    }
  }
}
