import { initDatabase } from '../config/db'
import { startPaymentConsumer } from './consumers/payment.consumer'
import 'reflect-metadata'

const startWorker = async () => {
  try {
    await initDatabase()
    console.log('✅ Database connected')

    await startPaymentConsumer()
    console.log('✅ Worker started and listening for messages')
  } catch (error) {
    console.error('❌ Failed to start worker:', error)
    process.exit(1)
  }
}

startWorker()
