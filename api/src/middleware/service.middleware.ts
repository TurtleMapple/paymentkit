import { createMiddleware } from 'hono/factory';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { RabbitMQPaymentEventPublisher } from '../domain/services/rabbitmq/RabbitMQEventPublisher';
import { PaymentService } from '../domain/services/payment.service';
import { WebhookService } from '../domain/services/webhook.service';

/**
 * SERVICE INJECTION MIDDLEWARE (Dependency Injection)
 * 
 * Kenapa kita butuh ini?
 * Agar Handler (Controller) tidak perlu repot-repot membuat instance Repository atau Service sendiri.
 * Semua kebutuhan objek sudah "disuntikkan" ke dalam context (c.set) sebelum sampai ke Handler.
 * 
 * Keuntungan:
 * 1. Request Isolation: Setiap request HTTP memiliki instance Repository-nya sendiri.
 * 2. Clean Code: Handler Anda tetap bersih, hanya fokus mengurus alur HTTP.
 * 3. Testability: Memudahkan kita untuk mengganti service asli dengan mock saat ditest.
 */
export const serviceInjection = createMiddleware(async (c, next) => {
  // 1. Ambil EntityManager (EM) dari context yang sudah diset oleh Database Middleware
  const em = c.get('em');
  
  /**
   * 2. Inisialisasi Repository
   * Kita melakukan em.fork() untuk memastikan setiap request punya "Unit of Work" sendiri.
   * Ini mencegah data antar-user tercampur di level memori ORM.
   */
  const paymentRepo = new PaymentRepository(em.fork());
  
  // 3. Inisialisasi Event Publisher (RabbitMQ)
  const publisher = new RabbitMQPaymentEventPublisher();
  
  // 4. Rakit Service (Dependency Injection manual)
  // PaymentService butuh Repo & Publisher
  const paymentService = new PaymentService(paymentRepo, publisher);
  
  // WebhookService butuh PaymentService
  const webhookService = new WebhookService(paymentService);
  
  /**
   * 5. Suntikkan (Inject) ke dalam Hono Context
   * Handler sekarang bisa mengambilnya via c.get('paymentService')
   */
  c.set('paymentService', paymentService);
  c.set('webhookService', webhookService);
  
  // Lanjut ke middleware berikutnya atau ke Handler utama
  await next();
});
