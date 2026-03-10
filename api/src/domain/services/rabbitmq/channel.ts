import { count } from 'node:console'
import { getRabbitMQConnection } from './connection'

let channel: any = null

export async function getRabbitMQChannel() {
    if (channel) return channel

    // Pastikan exchange ada
    const connection = await getRabbitMQConnection()
    const ch = await connection.createChannel()

    ch.on('error', (err: any) => {
        console.error('RabbitMQ channel error:', err)
        channel = null
    })

    ch.on('close', () => {
        console.log('RabbitMQ channel closed')
        channel = null
    })

    channel = ch
    return channel
}
