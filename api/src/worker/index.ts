import { initDatabase } from '../config/db';
import { RabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { RabbitMQChannelManager } from '../domain/services/rabbitmq/channel';
import { RabbitMQTopology } from '../domain/services/rabbitmq/topology';
import { startPaymentConsumer, stopPaymentConsumer } from './consumers/payment.consumer';
import { logger } from '../utils/logger';
import 'reflect-metadata';

/**
 * WORKER ENTRY POINT
 *
 * @standarisasi
 * - Shared Connection, Separate Channels: Koneksi TCP tunggal dibagikan ke semua consumer.
 * - Topology Setup: Memastikan Exchanges, Queues, dan Bindings sudah siap sebelum consume.
 * - Graceful Shutdown: Menangkap sinyal SIGINT/SIGTERM untuk menutup koneksi secara bersih.
 */
const startWorker = async (): Promise<void> => {
  try {
    // 1. Database
    await initDatabase();
    logger.success('✅ Database connected');

    // 2. RabbitMQ Infrastructure
    const channel = await RabbitMQChannelManager.getConsumerChannel();
    await RabbitMQTopology.setup(channel);
    logger.success('✅ RabbitMQ Topology ready');

    // 3. Start Consumers
    await startPaymentConsumer();
    logger.success('🎧 Worker started and listening for messages');
  } catch (error) {
    logger.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
};

/**
 * GRACEFUL SHUTDOWN
 */
const shutdown = async (signal: string): Promise<void> => {
  logger.warn(`👋 ${signal} received. Shutting down worker...`);

  try {
    await stopPaymentConsumer();
    await RabbitMQConnection.getInstance().close();
    logger.success('✅ Worker shutdown complete');
  } catch (error) {
    logger.error('❌ Error during worker shutdown:', error);
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startWorker();
