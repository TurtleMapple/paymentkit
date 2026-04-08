import { Channel, ConfirmChannel } from 'amqplib';
import { RabbitMQConnection } from './connection';
import { logger } from '../../../utils/logger';

/**
 * RABBITMQ CHANNEL MANAGER (Multiplexing)
 * 
 * @standarisasi
 * - Reusability: Lazy Initialization, channel dibuat sekali dan disimpan di memori.
 * - Isolasi Peran: Memisahkan channel Publisher dan Consumer agar flow control tidak saling ganggu.
 * - Publisher Confirms: Menggunakan ConfirmChannel untuk menjamin pesan sampai ke broker.
 * - QoS (Quality of Service): Mengatur prefetch pada channel consumer untuk proteksi beban.
 * - Penanganan Error: Otomatis membersihkan cache channel jika terjadi error/close.
 */
export class RabbitMQChannelManager {
  private static publisherChannel: ConfirmChannel | null = null;
  private static consumerChannel: Channel | null = null;
  private static readonly PREFETCH_COUNT = 10;

  /**
   * Mendapatkan Channel Khusus Publisher (ConfirmChannel)
   */
  public static async getPublisherChannel(): Promise<ConfirmChannel> {
    if (this.publisherChannel) return this.publisherChannel;

    try {
      logger.info('⚙️ Creating new RabbitMQ Publisher Channel (ConfirmMode)...');
      const connectionModel = await RabbitMQConnection.getInstance().connect();
      
      const ch = await connectionModel.createConfirmChannel();
      this.publisherChannel = ch;

      this.publisherChannel.on('error', (err) => {
        logger.error('❌ RabbitMQ Publisher Channel Error:', err);
        this.publisherChannel = null;
      });

      this.publisherChannel.on('close', () => {
        logger.warn('⚠️ RabbitMQ Publisher Channel Closed');
        this.publisherChannel = null;
      });

      logger.success('✅ RabbitMQ Publisher Channel Ready');
      return this.publisherChannel;
    } catch (error) {
      logger.error('❌ Failed to create RabbitMQ Publisher Channel:', error);
      throw error;
    }
  }

  /**
   * Mendapatkan Channel Khusus Consumer (Normal Channel with QoS)
   */
  public static async getConsumerChannel(): Promise<Channel> {
    if (this.consumerChannel) return this.consumerChannel;

    try {
      logger.info('⚙️ Creating new RabbitMQ Consumer Channel...');
      const connectionModel = await RabbitMQConnection.getInstance().connect();
      
      const ch = await connectionModel.createChannel();
      this.consumerChannel = ch;

      // Konfigurasi QoS: Jangan ambil pesan baru sebelum 10 pesan sebelumnya di-ack
      await this.consumerChannel.prefetch(this.PREFETCH_COUNT);

      this.consumerChannel.on('error', (err) => {
        logger.error('❌ RabbitMQ Consumer Channel Error:', err);
        this.consumerChannel = null;
      });

      this.consumerChannel.on('close', () => {
        logger.warn('⚠️ RabbitMQ Consumer Channel Closed');
        this.consumerChannel = null;
      });

      logger.success(`✅ RabbitMQ Consumer Channel Ready (Prefetch: ${this.PREFETCH_COUNT})`);
      return this.consumerChannel;
    } catch (error) {
      logger.error('❌ Failed to create RabbitMQ Consumer Channel:', error);
      throw error;
    }
  }

  /**
   * Reset cache channel (digunakan secara internal jika diperlukan)
   */
  public static reset(): void {
    this.publisherChannel = null;
    this.consumerChannel = null;
  }
}

/**
 * LEGACY EXPORT
 * Menjaga kompatibilitas dengan modul lama yang mengandalkan getRabbitMQChannel()
 */
export const getRabbitMQChannel = () => RabbitMQChannelManager.getPublisherChannel();
