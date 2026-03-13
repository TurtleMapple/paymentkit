import { serve } from '@hono/node-server'
import app from './app'
import { initDatabase } from './config/db'
import { setupTopology } from './domain/services/rabbitmq/topology'
import { env } from './config/env'
import 'reflect-metadata'

let isInitialized = false
const ensureInitialized = async () => {
  if (!isInitialized) {
    await initDatabase()
    console.log("✅ Database Connected")
    
    if (env.RABBITMQ_ENABLED) {
      await setupTopology()
      console.log("✅ RabbitMQ Topology Ready")
    } else {
      console.log("⏭️ RabbitMQ disabled (RABBITMQ_ENABLED=false), skipping message broker")
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

    console.log(`✅ Server running on port ${env.PORT}`)
    console.log(`🔗 API Documentation: http://localhost:${env.PORT}/doc`)
    console.log(`🔗 API Reference: http://localhost:${env.PORT}/reference`)
  } catch (error) {
    console.error('❌ Failed to start server:', error)
  }
}

startServer()