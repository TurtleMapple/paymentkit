import { env } from '../../../config/env'
import { getRabbitMQChannel } from './channel'
import { EXCHANGES, ROUTING_KEYS } from './topology'

/**
 * Publish message ke RabbitMQ Exchange
 * 
 * @param routingKey - Routing key untuk routing message
 * @param message - Message payload (akan di-serialize ke JSON)
 * 
 * @solid-principles
 * - SRP: Function ini hanya handle publishing
 * - OCP: Bisa extend dengan routing key baru tanpa ubah function
 * - DIP: Depend on channel abstraction
 * 
 * @architecture
 * Producer tidak tahu queue tujuan, hanya tahu exchange dan routing key.
 * Exchange yang akan routing message ke queue berdasarkan binding.
 */
export async function publishToExchange(routingKey: string, message: any): Promise<void> {
    if (!env.RABBITMQ_ENABLED) return
    // amazonq-ignore-next-line
    const channel = await getRabbitMQChannel()
    
    channel.publish(
        EXCHANGES.PAYMENT,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
    )

    console.log(`📤 Published to [${EXCHANGES.PAYMENT}] with key [${routingKey}]:`, message)
}

/**
 * Helper: Publish payment creation event
 * 
 * @solid-principles
 * - SRP: Dedicated function untuk payment creation
 * - ISP: Interface segregation - specific function untuk specific use case
 */
export async function publishPaymentCreated(orderId: string): Promise<void> {
    await publishToExchange(ROUTING_KEYS.PAYMENT_CREATED, { orderId })
}

/**
 * Helper: Publish payment update event
 */
export async function publishPaymentUpdated(orderId: string, status: string): Promise<void> {
    await publishToExchange(ROUTING_KEYS.PAYMENT_UPDATED, { orderId, status })
}

/**
 * Helper: Publish webhook received event
 */
export async function publishWebhookReceived(orderId: string, gateway: string): Promise<void> {
    await publishToExchange(ROUTING_KEYS.PAYMENT_WEBHOOK, { orderId, gateway })
}
