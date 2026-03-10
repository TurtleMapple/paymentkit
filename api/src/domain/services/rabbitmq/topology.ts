import { getRabbitMQChannel } from './channel'

/**
 * ============================================
 * RABBITMQ TOPOLOGY CONSTANTS
 * ============================================
 * Centralized configuration untuk exchanges, queues, dan routing keys
 */

export const EXCHANGES = {
    PAYMENT: 'payment.exchange',
    PAYMENT_DLX: 'payment.dlx',
} as const

export const QUEUES = {
    PAYMENT_CREATED: 'payment.created.queue',
    PAYMENT_UPDATED: 'payment.updated.queue',
    PAYMENT_WEBHOOK: 'payment.webhook.queue',
    PAYMENT_DLQ: 'payment.dlq',
} as const

export const ROUTING_KEYS = {
    PAYMENT_CREATED: 'payment.created',
    PAYMENT_UPDATED: 'payment.updated',
    PAYMENT_WEBHOOK: 'payment.webhook',
} as const

/**
 * ============================================
 * SETUP RABBITMQ TOPOLOGY
 * ============================================
 * 
 * Function ini akan:
 * 1. DECLARE EXCHANGES (payment.exchange & payment.dlx)
 * 2. DECLARE QUEUES (payment.created.queue, dll)
 * 3. BIND QUEUES TO EXCHANGES (routing message dari exchange ke queue)
 * 
 * @architecture
 * Publisher → Exchange → Routing Key → Queue → Consumer
 *                                        ↓ (on error)
 *                                       DLQ
 */
export async function setupTopology() {
    const channel = await getRabbitMQChannel()
    
    console.log('🔧 Setting up RabbitMQ topology...')
    
    // ============================================
    // STEP 1: DECLARE MAIN EXCHANGE
    // ============================================
    // Exchange ini akan menerima message dari publisher
    // dan routing ke queue berdasarkan routing key
    await channel.assertExchange(EXCHANGES.PAYMENT, 'topic', {
        durable: true, // Survive RabbitMQ restart
    })
    
    // ============================================
    // STEP 2: DECLARE DLX EXCHANGE
    // ============================================
    // Dead Letter Exchange untuk handle failed messages
    console.log(`📢 Declaring DLX exchange: ${EXCHANGES.PAYMENT_DLX} (type: fanout)`)
    await channel.assertExchange(EXCHANGES.PAYMENT_DLX, 'fanout', {
        durable: true,
    })
    
    // ============================================
    // STEP 3: DECLARE DEAD LETTER QUEUE
    // ============================================
    console.log(`📦 Declaring DLQ: ${QUEUES.PAYMENT_DLQ}`)
    await channel.assertQueue(QUEUES.PAYMENT_DLQ, {
        durable: true,
    })
    
    // ============================================
    // STEP 4: BIND DLQ TO DLX
    // ============================================
    console.log(`🔗 Binding ${QUEUES.PAYMENT_DLQ} to ${EXCHANGES.PAYMENT_DLX}`)
    await channel.bindQueue(QUEUES.PAYMENT_DLQ, EXCHANGES.PAYMENT_DLX, '')
    
    // ============================================
    // STEP 5: DECLARE MAIN QUEUES
    // ============================================
    const queueOptions = {
        durable: true,
        deadLetterExchange: EXCHANGES.PAYMENT_DLX, // Failed messages → DLX
    }
    
    console.log(`📦 Declaring queue: ${QUEUES.PAYMENT_CREATED}`)
    await channel.assertQueue(QUEUES.PAYMENT_CREATED, queueOptions)
    
    console.log(`📦 Declaring queue: ${QUEUES.PAYMENT_UPDATED}`)
    await channel.assertQueue(QUEUES.PAYMENT_UPDATED, queueOptions)
    
    console.log(`📦 Declaring queue: ${QUEUES.PAYMENT_WEBHOOK}`)
    await channel.assertQueue(QUEUES.PAYMENT_WEBHOOK, queueOptions)
    
    // ============================================
    // STEP 6: BIND QUEUES TO MAIN EXCHANGE
    // ============================================
    // Binding ini yang menghubungkan exchange dengan queue
    // Message dengan routing key 'payment.created' akan masuk ke PAYMENT_CREATED queue
    
    await channel.bindQueue(
        QUEUES.PAYMENT_CREATED,
        EXCHANGES.PAYMENT,
        ROUTING_KEYS.PAYMENT_CREATED
    )
    
    await channel.bindQueue(
        QUEUES.PAYMENT_UPDATED,
        EXCHANGES.PAYMENT,
        ROUTING_KEYS.PAYMENT_UPDATED
    )
    
    await channel.bindQueue(
        QUEUES.PAYMENT_WEBHOOK,
        EXCHANGES.PAYMENT,
        ROUTING_KEYS.PAYMENT_WEBHOOK
    )

    console.log('✅ RabbitMQ topology setup complete!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`   Main Exchange: ${EXCHANGES.PAYMENT} (topic)`)
    console.log(`   DLX Exchange: ${EXCHANGES.PAYMENT_DLX} (fanout)`)
    console.log(`   Queues: ${Object.values(QUEUES).join(', ')}`)
    console.log(`   Routing Keys: ${Object.values(ROUTING_KEYS).join(', ')}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}
