import * as amqp from 'amqplib';
import { getEntityManager } from '../../config/db';
import { Payment } from '../../domain/entities/paymentEntity';
import { PaymentStatus } from '../../domain/entities/paymentStatus';
import { env } from '../../config/env';
import { PaymentGatewayFactory } from '../../domain/gateways/PaymentGatewayFactory';
import { EXCHANGES, QUEUES, ROUTING_KEYS } from '../../domain/services/rabbitmq/topology';
import { getRabbitMQConnection, closeRabbitMQConnection } from '../../domain/services/rabbitmq/connection';
import { getRabbitMQChannel } from '../../domain/services/rabbitmq/channel';

// Constants
const PREFETCH_COUNT = 1;
const MAX_RETRIES = 3;
const RETRY_HEADER = 'x-retry-count';

// Gateway instance
const gateway = PaymentGatewayFactory.create('midtrans');

// Connection state
let channel: any = null;
let connection: any = null;

// Types
interface PaymentQueueMessage {
  orderId: string;
}

export const startPaymentConsumer = async (): Promise<void> => {
  try {
    connection = await getRabbitMQConnection();
    channel = await getRabbitMQChannel();

    if (!channel) throw new Error('Failed to create channel');

    // 1. Declare exchange
    await channel.assertExchange(EXCHANGES.PAYMENT, 'topic', {
      durable: true,
    });

    // 2. Declare queue
    await channel.assertQueue(QUEUES.PAYMENT_CREATED, {
      durable: true,
      deadLetterExchange: EXCHANGES.PAYMENT_DLX,
    });

    // 3. Bind queue to exchange
    await channel.bindQueue(
      QUEUES.PAYMENT_CREATED,
      EXCHANGES.PAYMENT,
      ROUTING_KEYS.PAYMENT_CREATED
    );

    channel.prefetch(PREFETCH_COUNT);

    console.log(`[Consumer] Bound [${QUEUES.PAYMENT_CREATED}] to [${EXCHANGES.PAYMENT}] with key [${ROUTING_KEYS.PAYMENT_CREATED}]`);
    console.log(`[Consumer] Waiting for messages...`);

    channel.consume(QUEUES.PAYMENT_CREATED, async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const data = parseMessage(msg);
        await processPayment(data);
        channel?.ack(msg);
      } catch (error) {
        await handleError(error, msg);
      }
    });
  } catch (error) {
    console.error('[Consumer] Failed to start:', error);
    throw error;
  }
};

const parseMessage = (msg: amqp.ConsumeMessage): PaymentQueueMessage => {
  try {
    return JSON.parse(msg.content.toString());
  } catch (error) {
    throw new Error('Invalid message format');
  }
};

const processPayment = async (data: PaymentQueueMessage): Promise<void> => {
  const em = getEntityManager().fork();
  const { orderId } = data;

  console.log(`[Consumer] Processing payment: ${orderId}`);

  const payment = await em.findOne(Payment, { orderId });
  if (!payment) {
    throw new Error(`Payment not found: ${orderId}`);
  }

  console.log(`[Consumer] Calling Midtrans API for: ${orderId}`);

  const result = await gateway.createPayment({
    orderId: payment.orderId,
    amount: payment.getAmount(),
    customerName: payment.customerName,
    customerEmail: payment.customerEmail,
    idempotencyKey: payment.orderId, // Mencegah double-billing
  });

  console.log(`[Consumer] Midtrans response:`, result);

  payment.paymentLink = result.paymentLink;
  payment.expiredAt = result.expiredAt;
  payment.paymentType = result.paymentType;
  payment.bank = result.bank;
  payment.vaNumber = result.vaNumber;
  payment.gatewayResponse = result.gatewayResponse;

  await em.persistAndFlush(payment);

  console.log(`[Consumer] Payment processed successfully: ${orderId}`);
};

const handleError = async (error: unknown, msg: amqp.ConsumeMessage): Promise<void> => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const orderId = parseMessage(msg).orderId;
  
  console.error(`[Consumer] Error processing message for ${orderId}:`, errorMessage);

  // Get current retry count from headers
  const headers = msg.properties.headers || {};
  const retryCount = (headers[RETRY_HEADER] as number) || 0;

  // Don't retry if payment is not found (logical error, not transient)
  const isRetryable = !errorMessage.includes('Payment not found');

  if (isRetryable && retryCount < MAX_RETRIES) {
    const nextRetryCount = retryCount + 1;
    console.log(`[Consumer] Retrying ${orderId} (${nextRetryCount}/${MAX_RETRIES})...`);
    
    // Re-publish to the same exchange/routing key with incremented retry count
    // Use a small delay for the next retry (simplified approach)
    await new Promise(resolve => setTimeout(resolve, 1000 * nextRetryCount));

    channel?.publish(
      EXCHANGES.PAYMENT,
      ROUTING_KEYS.PAYMENT_CREATED,
      msg.content,
      {
        headers: {
          ...headers,
          [RETRY_HEADER]: nextRetryCount,
        },
        persistent: true,
      }
    );
    
    // Ack original message so it doesn't stay in queue
    channel?.ack(msg);
  } else {
    console.error(`[Consumer] Max retries reached or non-retryable error for ${orderId}. Sending to DLX.`);
    // NACK without re-queueing to send to DLX (configured on queue assertion)
    channel?.nack(msg, false, false);
  }
};

export const stopPaymentConsumer = async (): Promise<void> => {
  try {
    await closeRabbitMQConnection();
    console.log('[Consumer] Stopped gracefully');
  } catch (error) {
    console.error('[Consumer] Error during shutdown:', error);
  }
};
