import { Channel, ConsumeMessage } from 'amqplib';
import { RabbitMQChannelManager } from './channel';
import { logger } from '../../../utils/logger';

/**
 * RABBITMQ BASE CONSUMER (Abstract Class)
 *
 * @standarisasi
 * - Single Responsibility: Setiap consumer hanya menangani satu tipe pesan.
 * - Manual Acknowledgement: Pesan hanya di-ack setelah pemrosesan berhasil.
 * - Idempotency Guard: Subclass wajib mengimplementasikan pengecekan duplikasi.
 * - Exponential Backoff Retry: Pesan gagal di-republish dengan delay yang meningkat.
 *   Mekanisme: DLX + Message TTL (tanpa plugin rabbitmq_delayed_message_exchange).
 *   Flow: Main Queue → (nack) → Retry Exchange → Retry Queue (TTL) → (expire) → Main Exchange → Main Queue
 * - Correlation ID: Setiap pesan dilacak menggunakan correlationId dari metadata publisher.
 * - Graceful Error Handling: Error non-retryable langsung dikirim ke DLQ.
 */

/**
 * Header standar yang digunakan untuk tracking retry
 */
const RETRY_HEADERS = {
  RETRY_COUNT: 'x-retry-count',
  ORIGINAL_QUEUE: 'x-original-queue',
  FIRST_FAILURE_AT: 'x-first-failure-at',
  LAST_ERROR: 'x-last-error',
} as const;

/**
 * Konfigurasi default untuk retry mechanism
 */
interface ConsumerConfig {
  /** Jumlah maksimum percobaan ulang sebelum pesan dikirim ke DLQ */
  maxRetries: number;
  /** Base delay dalam milidetik untuk exponential backoff (default: 5000ms) */
  baseRetryDelay: number;
  /** Nama consumer untuk keperluan logging */
  consumerTag: string;
}

const DEFAULT_CONFIG: ConsumerConfig = {
  maxRetries: 3,
  baseRetryDelay: 5000,
  consumerTag: 'unnamed-consumer',
};

/**
 * BASE CONSUMER
 * Kelas abstrak yang menyediakan kerangka kerja standar untuk semua consumer.
 * 
 * @template T - Tipe data payload pesan yang diharapkan
 * 
 * @usage
 * ```typescript
 * class MyConsumer extends BaseConsumer<{ orderId: string }> {
 *   protected queueName = QUEUES.MY_QUEUE;
 *   protected consumerConfig = { maxRetries: 3, baseRetryDelay: 5000, consumerTag: 'my-consumer' };
 *   
 *   protected async isAlreadyProcessed(data): Promise<boolean> { ... }
 *   protected async handle(data, msg): Promise<void> { ... }
 *   protected isRetryableError(error): boolean { ... }
 * }
 * ```
 */
export abstract class BaseConsumer<T> {
  private channel: Channel | null = null;

  /** Nama antrean yang akan di-consume */
  protected abstract readonly queueName: string;

  /** Konfigurasi consumer */
  protected abstract readonly consumerConfig: ConsumerConfig;

  /**
   * ABSTRACT: Logika bisnis utama untuk memproses pesan.
   * Diimplementasikan oleh subclass.
   */
  protected abstract handle(data: T, msg: ConsumeMessage): Promise<void>;

  /**
   * ABSTRACT: Pengecekan idempotensi.
   * Mengembalikan `true` jika pesan sudah pernah diproses sebelumnya.
   */
  protected abstract isAlreadyProcessed(data: T): Promise<boolean>;

  /**
   * ABSTRACT: Menentukan apakah error tertentu layak untuk di-retry.
   * Error logis (misal: "data not found") sebaiknya tidak di-retry.
   */
  protected abstract isRetryableError(error: Error): boolean;

  /**
   * Memulai consumer: mendapatkan channel dan mulai mendengarkan pesan.
   */
  public async start(): Promise<void> {
    try {
      this.channel = await RabbitMQChannelManager.getConsumerChannel();
      
      logger.info(`🎧 [${this.consumerConfig.consumerTag}] Listening on queue: ${this.queueName}`);

      await this.channel.consume(
        this.queueName,
        async (msg: ConsumeMessage | null) => {
          if (!msg) return;
          await this.onMessage(msg);
        },
        { noAck: false } // Manual Acknowledgement
      );
    } catch (error) {
      logger.error(`❌ [${this.consumerConfig.consumerTag}] Failed to start consumer:`, error);
      throw error;
    }
  }

  /**
   * Menghentikan consumer secara bersih.
   */
  public async stop(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.close();
        logger.info(`🛑 [${this.consumerConfig.consumerTag}] Consumer stopped`);
      } catch (error) {
        logger.error(`❌ [${this.consumerConfig.consumerTag}] Error stopping consumer:`, error);
      } finally {
        this.channel = null;
      }
    }
  }

  /**
   * Handler utama untuk setiap pesan yang diterima.
   * Menjalankan alur: Parse → Idempotency Check → Handle → ACK/NACK
   */
  private async onMessage(msg: ConsumeMessage): Promise<void> {
    const correlationId = msg.properties.messageId || msg.properties.correlationId || 'unknown';
    const tag = this.consumerConfig.consumerTag;

    let data: T;

    // 1. Parse message
    try {
      data = this.parseMessage(msg);
    } catch (parseError) {
      // Pesan rusak/tidak valid → langsung kirim ke DLQ, tidak perlu di-retry
      logger.error(`❌ [${tag}] Invalid message format (correlationId: ${correlationId}). Sending to DLQ.`);
      this.channel?.nack(msg, false, false);
      return;
    }

    // 2. Idempotency guard
    try {
      const alreadyProcessed = await this.isAlreadyProcessed(data);
      if (alreadyProcessed) {
        logger.warn(`⚠️ [${tag}] Message already processed (correlationId: ${correlationId}). Skipping.`);
        this.channel?.ack(msg);
        return;
      }
    } catch (idempotencyError) {
      // Jika pengecekan idempotensi gagal, kita tetap proses (fail-open)
      logger.warn(`⚠️ [${tag}] Idempotency check failed, proceeding with processing.`);
    }

    // 3. Handle message (logika bisnis)
    try {
      logger.debug(`⚙️ [${tag}] Processing message (correlationId: ${correlationId})...`);
      await this.handle(data, msg);

      // 4. ACK — pesan berhasil diproses
      this.channel?.ack(msg);
      logger.success(`✅ [${tag}] Message processed successfully (correlationId: ${correlationId})`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.handleFailure(msg, err, correlationId);
    }
  }

  /**
   * Menangani kegagalan pemrosesan pesan.
   * Menerapkan Exponential Backoff menggunakan mekanisme republish.
   */
  private async handleFailure(msg: ConsumeMessage, error: Error, correlationId: string): Promise<void> {
    const tag = this.consumerConfig.consumerTag;
    const headers = (msg.properties.headers || {}) as Record<string, unknown>;
    const retryCount = (headers[RETRY_HEADERS.RETRY_COUNT] as number) || 0;

    logger.error(`❌ [${tag}] Processing failed (correlationId: ${correlationId}, attempt: ${retryCount + 1}):`, error.message);

    // Cek apakah error layak untuk di-retry
    if (!this.isRetryableError(error)) {
      logger.error(`🚫 [${tag}] Non-retryable error. Sending to DLQ immediately.`);
      this.channel?.nack(msg, false, false);
      return;
    }

    // Cek apakah masih bisa retry
    if (retryCount >= this.consumerConfig.maxRetries) {
      logger.error(`🛑 [${tag}] Max retries (${this.consumerConfig.maxRetries}) reached for correlationId: ${correlationId}. Sending to DLQ.`);
      this.channel?.nack(msg, false, false);
      return;
    }

    // Exponential Backoff: delay = baseDelay * 2^retryCount
    const nextRetry = retryCount + 1;
    const delay = this.consumerConfig.baseRetryDelay * Math.pow(2, retryCount);

    logger.info(`🔄 [${tag}] Scheduling retry ${nextRetry}/${this.consumerConfig.maxRetries} in ${delay / 1000}s...`);

    // Terapkan delay sebelum republish
    await new Promise(resolve => setTimeout(resolve, delay));

    // Republish pesan dengan header retry yang diperbarui
    try {
      this.channel?.publish('', this.queueName, msg.content, {
        persistent: true,
        headers: {
          ...headers,
          [RETRY_HEADERS.RETRY_COUNT]: nextRetry,
          [RETRY_HEADERS.ORIGINAL_QUEUE]: this.queueName,
          [RETRY_HEADERS.LAST_ERROR]: error.message,
          [RETRY_HEADERS.FIRST_FAILURE_AT]: headers[RETRY_HEADERS.FIRST_FAILURE_AT] || new Date().toISOString(),
        },
        messageId: msg.properties.messageId,
        correlationId: correlationId,
        contentType: 'application/json',
      });

      // ACK pesan asli agar tidak tetap berada di antrean
      this.channel?.ack(msg);
    } catch (republishError) {
      // Jika republish gagal, NACK untuk kembalikan ke antrean asli (requeue)
      logger.error(`❌ [${tag}] Failed to republish message for retry. Requeuing.`);
      this.channel?.nack(msg, false, true);
    }
  }

  /**
   * Deserialisasi isi pesan dari Buffer ke objek TypeScript.
   */
  private parseMessage(msg: ConsumeMessage): T {
    const content = msg.content.toString();
    const parsed = JSON.parse(content);

    // Jika publisher kita menyertakan metadata wrapper, ambil data dari dalamnya
    // Jika tidak ada wrapper, kembalikan langsung
    return parsed;
  }
}

export { ConsumerConfig, RETRY_HEADERS };
