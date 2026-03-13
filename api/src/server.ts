import { serve } from '@hono/node-server'
import app from './app'
import { initDatabase } from './config/db'
import { setupTopology } from './domain/services/rabbitmq/topology'
import { env } from './config/env'
import { logger } from './utils/logger'
import 'reflect-metadata'

let isInitialized = false
const ensureInitialized = async () => {
  if (!isInitialized) {
    await initDatabase()
    logger.success("Database Connected")
    
    if (env.RABBITMQ_ENABLED) {
      await setupTopology()
      logger.success("RabbitMQ Topology Ready")
    } else {
      logger.info("⏭️ RabbitMQ disabled (RABBITMQ_ENABLED=false), skipping message broker")
    }
    
    isInitialized = true
  }
}

const startServer = async () => {
  try {
    await ensureInitialized()

    serve({
        fetch: app.fetch,
        port: env.PORT
    })

    logger.success(`Server running on port ${env.PORT}`)
    logger.info(`🔗 API Documentation: http://localhost:${env.PORT}/doc`)
    logger.info(`🔗 API Reference: http://localhost:${env.PORT}/reference`)
  } catch (error) {
    console.error('❌ Failed to start server:', error)
  }
}

startServer()