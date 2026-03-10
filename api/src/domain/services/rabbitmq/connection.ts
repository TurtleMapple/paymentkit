import amqp from 'amqplib'

let connection: any = null

export async function getRabbitMQConnection() {
    if (connection) return connection

    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672'
    // amazonq-ignore-next-line
    const conn = await amqp.connect(url)

    conn.on('error', (err) => {
        // amazonq-ignore-next-line
        console.error('RabbitMQ connection error:', err)
        connection = null
    })
    
    conn.on('close', () => {
        console.log('RabbitMQ connection closed')
        connection = null
    })
    
    connection = conn
    console.log('✅ Connected to RabbitMQ')
    return connection
}

export async function closeRabbitMQConnection(): Promise<void> {
    if (connection) {
        await connection.close()
        connection = null
    }
}
