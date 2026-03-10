import { createMiddleware } from 'hono/factory';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { RabbitMQPaymentEventPublisher } from '../domain/services/rabbitmq/RabbitMQEventPublisher';
import { PaymentService } from '../domain/services/payment.service';
import { WebhookService } from '../domain/services/webhook.service';

export const serviceInjection = createMiddleware(async (c, next) => {
  const em = c.get('em');
  
  // Initialize repository with forked EM for request isolation
  const paymentRepo = new PaymentRepository(em.fork());
  
  // Initialize publisher
  const publisher = new RabbitMQPaymentEventPublisher();
  
  // Initialize services
  const paymentService = new PaymentService(paymentRepo, publisher);
  const webhookService = new WebhookService(paymentService);
  
  // Inject into context
  c.set('paymentService', paymentService);
  c.set('webhookService', webhookService);
  
  await next();
});
