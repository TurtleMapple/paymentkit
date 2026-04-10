import { serve } from '@hono/node-server'
import app from './app'
import { initDatabase } from './config/db'
import { RabbitMQTopology } from './domain/services/rabbitmq/topology'
import { RabbitMQChannelManager } from './domain/services/rabbitmq/channel'
import { RabbitMQConnection } from './domain/services/rabbitmq/connection'
import { env } from './config/env'
import { logger } from './utils/logger'
import 'reflect-metadata'

/**
 * SERVER ENTRY POINT
 * 
 * Bertanggung jawab atas seluruh lifecycle aplikasi:
 * 1. Inisialisasi infrastruktur (Database, RabbitMQ)
 * 2. Start HTTP server
 * 3. Graceful Shutdown (SIGINT/SIGTERM)
 */

let isInitialized = false

const ensureInitialized = async () => {
  if (!isInitialized) {
    // 1. Database
    await initDatabase()
    logger.success('✅ Database Connected')
    
    // 2. RabbitMQ
    if (env.RABBITMQ_ENABLED) {
      const channel = await RabbitMQChannelManager.getPublisherChannel();
      await RabbitMQTopology.setup(channel);
      logger.success('✅ RabbitMQ Topology Ready')
    } else {
      logger.info('⏭️ RabbitMQ disabled (RABBITMQ_ENABLED=false), skipping message broker')
    }
    
    isInitialized = true
  }
}

const startServer = async () => {
  try {
    await ensureInitialized()

    serve({
        fetch: app.fetch,
        port: env.PORT,
        hostname: '0.0.0.0'
    })

    logger.success(`🚀 Server running on port ${env.PORT}`)
    logger.info(`🔗 API Documentation: http://localhost:${env.PORT}/doc`)
    logger.info(`🔗 API Reference: http://localhost:${env.PORT}/reference`)
  } catch (error) {
    logger.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

/**
 * GRACEFUL SHUTDOWN
 * Menutup koneksi database dan messaging saat aplikasi dimatikan
 */
const shutdown = async (signal: string) => {
  logger.warn(`👋 ${signal} received. Shutting down server...`)

  try {
    await RabbitMQConnection.getInstance().close()
    logger.success('✅ Server shutdown complete')
  } catch (error) {
    logger.error('❌ Error during server shutdown:', error)
  }

  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

startServer()