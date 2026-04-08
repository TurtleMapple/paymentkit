import { v4 as uuidv4 } from 'uuid';
import { env } from '../../../config/env';
import { RabbitMQChannelManager } from './channel';
import { EXCHANGES, ROUTING_KEYS } from './topology';
import { logger } from '../../../utils/logger';

/**
 * RABBITMQ PUBLISHER STANDARDS
 * 
 * @standarisasi
 * - Base Abstract Class: Kerangka dasar untuk seluruh publisher di sistem.
 * - Auto-Serialization: Otomatis konversi JSON ke Buffer.
 * - Jaminan Pengiriman: Menggunakan persistent: true dan ConfirmChannel (waitForConfirms).
 * - Rich Metadata: Menambahkan messageId dan timestamp untuk pelacakan (Tracing).
 */
export abstract class BasePublisher<T> {
  protected abstract readonly exchange: string;
  protected abstract readonly routingKey: string;

  /**
   * Mengirim pesan ke RabbitMQ Exchange
   */
  public async publish(data: T): Promise<boolean> {
    if (!env.RABBITMQ_ENABLED) {
        logger.warn('⚠️ RabbitMQ is disabled. Message skipped.');
        return false;
    }

    try {
      const channel = await RabbitMQChannelManager.getPublisherChannel();
      
      const messageId = uuidv4();
      const payload = Buffer.from(JSON.stringify({
        ...data as any,
        metadata: {
            messageId,
            publishedAt: new Date().toISOString(),
        }
      }));

      logger.debug(`📤 Publishing to [${this.exchange}] with key [${this.routingKey}]...`, { messageId });

      // Publish dengan flag persistent agar pesan tidak hilang jika broker restart
      const isSent = channel.publish(this.exchange, this.routingKey, payload, {
        persistent: true,
        messageId: messageId,
        timestamp: Date.now(),
        contentType: 'application/json',
      });

      if (!isSent) {
        logger.error('❌ Failed to publish message: Channel buffer full');
        return false;
      }

      // Tunggu konfirmasi dari broker (Publisher Confirms)
      await channel.waitForConfirms();
      
      logger.success(`✅ Published to [${this.exchange}] with key [${this.routingKey}]`);
      return true;
    } catch (error) {
      logger.error(`❌ Error publishing to [${this.exchange}]:`, error);
      throw error;
    }
  }
}

/**
 * IMPLEMENTASI KONKRIT: Payment Publisher
 */
export class PaymentCreatedPublisher extends BasePublisher<{ orderId: string }> {
  protected exchange = EXCHANGES.PAYMENT;
  protected routingKey = ROUTING_KEYS.PAYMENT_CREATED;
}

export class PaymentUpdatedPublisher extends BasePublisher<{ orderId: string, status: string }> {
  protected exchange = EXCHANGES.PAYMENT;
  protected routingKey = ROUTING_KEYS.PAYMENT_UPDATED;
}

export class WebhookReceivedPublisher extends BasePublisher<{ orderId: string, gateway: string }> {
  protected exchange = EXCHANGES.PAYMENT;
  protected routingKey = ROUTING_KEYS.PAYMENT_WEBHOOK;
}

/**
 * LEGACY WRAPPERS
 * Membungkus class baru agar tidak merusak kode yang memanggil versi functional.
 */
export async function publishPaymentCreated(orderId: string): Promise<void> {
  await new PaymentCreatedPublisher().publish({ orderId });
}

export async function publishPaymentUpdated(orderId: string, status: string): Promise<void> {
  await new PaymentUpdatedPublisher().publish({ orderId, status });
}

export async function publishWebhookReceived(orderId: string, gateway: string): Promise<void> {
  await new WebhookReceivedPublisher().publish({ orderId, gateway });
}
