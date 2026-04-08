import { connect, ChannelModel } from 'amqplib';
import { env } from '../../../config/env';
import { logger } from '../../../utils/logger';

/**
 * RABBITMQ CONNECTION MANAGER (Singleton)
 * 
 * @standarisasi
 * - Single TCP Connection: Satu koneksi per proses (efisiensi RAM & handshake).
 * - Singleton Pattern: Menjamin hanya satu koneksi fisik yang dikelola.
 * - Resiliensi: Auto-reconnect pada event 'error' dan 'close' dengan jeda waktu.
 * - Heartbeats: Menggunakan interval 60 detik untuk deteksi koneksi mati (Liveness).
 * - Lazy Initialization: Koneksi baru dibuat hanya saat benar-benar dibutuhkan pertama kali.
 */
export class RabbitMQConnection {
  private static instance: RabbitMQConnection;
  private connection: ChannelModel | null = null;
  private isConnecting: boolean = false;
  private retryCount: number = 0;
  private readonly maxRetries: number = 10;
  private readonly retryDelay: number = 5000; // 5 detik jeda antar retry

  private constructor() {}

  /**
   * Mendapatkan instance Singleton
   */
  public static getInstance(): RabbitMQConnection {
    if (!RabbitMQConnection.instance) {
      RabbitMQConnection.instance = new RabbitMQConnection();
    }
    return RabbitMQConnection.instance;
  }

  /**
   * Membuka koneksi ke RabbitMQ (Lazy Initialization)
   * Mengembalikan ChannelModel murni (yang menaungi koneksi aslinya di Promise API).
   */
  public async connect(): Promise<ChannelModel> {
    // 1. Return eksisting jika ada
    if (this.connection) {
      return this.connection;
    }

    // 2. Mencegah race conditions saat proses connecting berlangsung paralel
    if (this.isConnecting) {
      logger.debug('⏳ Connection attempt in progress, waiting for result...');
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          if (this.connection) {
            clearInterval(interval);
            resolve(this.connection);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          if (!this.connection) reject(new Error('Timeout: RabbitMQ connection taking too long'));
        }, 30000);
      });
    }

    this.isConnecting = true;
    
    try {
      logger.info(`🔌 Connecting to RabbitMQ at ${env.RABBITMQ_URL}...`);
      
      // Di Promise API, connect returns Promise<ChannelModel>
      const model = await connect(env.RABBITMQ_URL, {
        heartbeat: 60,
      });

      this.connection = model;
      this.retryCount = 0;
      this.isConnecting = false;

      // 3. Pasang Event Listeners (menggunakan ChannelModel sebagai EventEmitter)
      this.connection.on('error', (err: Error) => {
        logger.error('❌ RabbitMQ Connection Error:', err.message);
        this.connection = null;
        this.handleReconnect();
      });

      this.connection.on('close', () => {
        logger.warn('⚠️ RabbitMQ Connection Closed');
        this.connection = null;
        this.handleReconnect();
      });

      logger.success('✅ Connected to RabbitMQ (ChannelModel Ready)');
      return this.connection;
    } catch (error) {
      this.isConnecting = false;
      this.connection = null;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to connect to RabbitMQ:', errorMessage);
      
      // Jika error, coba melakukan pemulihan otomatis
      if (this.retryCount < this.maxRetries) {
        await this.handleReconnect();
        return this.connect();
      }
      
      throw new Error(`Critical: Could not connect to RabbitMQ after ${this.maxRetries} attempts`);
    }
  }

  /**
   * Strategi Pemulihan: Reconnect Otomatis
   */
  private async handleReconnect(): Promise<void> {
    if (this.isConnecting || this.connection) return;

    if (this.retryCount >= this.maxRetries) {
      logger.error('🛑 Max RabbitMQ reconnection retries reached. Stopping attempts.');
      return;
    }

    this.retryCount++;
    logger.info(`🔄 Reconnecting to RabbitMQ in ${this.retryDelay / 1000}s... (Attempt ${this.retryCount}/${this.maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    
    try {
        await this.connect();
    } catch (err) {
        // Logika retry akan ditangani oleh pemanggilan connect() secara rekursif
    }
  }

  /**
   * Graceful Shutdown: Menutup koneksi secara bersih
   */
  public async close(): Promise<void> {
    if (this.connection) {
      logger.info('🔌 Initiating graceful RabbitMQ connection close...');
      try {
        this.connection.removeAllListeners();
        await this.connection.close();
        logger.success('✅ RabbitMQ connection (ChannelModel) closed cleanly');
      } catch (error) {
        logger.error('❌ Error while closing RabbitMQ connection:', error);
      } finally {
        this.connection = null;
      }
    }
  }

  /**
   * Status pengecekan koneksi
   */
  public isConnected(): boolean {
    return this.connection !== null;
  }
}

/**
 * EXPORT HELPERS
 */
export const getRabbitMQConnection = () => RabbitMQConnection.getInstance().connect();
export const closeRabbitMQConnection = () => RabbitMQConnection.getInstance().close();
