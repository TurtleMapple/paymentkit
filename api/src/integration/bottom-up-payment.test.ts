import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, orm } from '../config/db';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { PaymentService } from '../domain/services/payment.service';
import { RabbitMQPaymentEventPublisher } from '../domain/services/rabbitmq/RabbitMQEventPublisher';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { PaymentStatus } from '../domain/entities/paymentStatus';
import { Payment } from '../domain/entities/paymentEntity';
import { env } from '../config/env';

/**
 * STRATEGI: Bottom-Up Integration Test
 * 
 * Cara baca: Tes ini mulai dari "bawah" (Database & Repository) lalu naik ke "tengah" (Service).
 * Kita tidak menggunakan API/Route di sini. Kita ingin memastikan pondasi
 * datanya kuat dulu sebelum dipakai oleh Handler API.
 */
describe('Bottom-Up Integration Test: Payment Module', () => {
  let repository: PaymentRepository;
  let service: PaymentService;
  let publisher: RabbitMQPaymentEventPublisher;

  beforeAll(async () => {
    // 1. Inisialisasi Database
    await initDatabase();
    
    // 2. Bersihkan Database (Isolated State)
    const generator = orm!.getSchemaGenerator();
    await generator.refreshDatabase();

    // 3. Siapkan komponen Bottom-Level
    // Kita buat instance manual (sebagai 'Driver') untuk mengetes modul bawah
    repository = new PaymentRepository(orm!.em.fork());
    publisher = new RabbitMQPaymentEventPublisher();
    service = new PaymentService(repository, publisher);
  });

  afterAll(async () => {
    if (orm) {
      await orm.close();
    }
    await closeRabbitMQConnection();
  });

  // ============================================================
  // TAHAP 1: Uji Lapisan Paling Bawah (Repository)
  // ============================================================
  describe('Lapisan 1: PaymentRepository (Database Access)', () => {
    it('harus bisa menyimpan data pembayaran ke database asli', async () => {
      const orderId = 'repo-test-' + Date.now();
      
      // Gunakan Entity Factory
      const payment = Payment.create(orderId, 25000, 'midtrans');
      payment.customerName = 'Repository User';
      payment.customerEmail = 'repo@example.com';

      // Simpan via repository
      await repository.save(payment);

      expect(payment.orderId).toBe(orderId);
      expect(payment.getId()).toBeDefined();

      // Pastikan benar-benar ada di tabel
      const found = await repository.findByOrderId(orderId);
      expect(found).not.toBeNull();
      expect(found?.customerName).toBe('Repository User');
    });

    it('harus bisa mengupdate status pembayaran secara atomik', async () => {
      const orderId = 'repo-update-' + Date.now();
      const payment = Payment.create(orderId, 10000);
      await repository.save(payment);

      // Tes pindah status dari PENDING ke PAID via Entity Method
      payment.complete();

      // Terakhir simpan perubahan
      await repository.save(payment);
      
      const updated = await repository.findByOrderId(orderId);
      expect(updated?.getStatus()).toBe(PaymentStatus.PAID);
    });
  });

  // ============================================================
  // TAHAP 2: Uji Lapisan Menengah (Service + Repository)
  // ============================================================
  describe('Lapisan 2: PaymentService (Logic + Integration)', () => {
    it('harus menjalankan logika bisnis dan memicu Event Publisher', async () => {
      const orderId = 'service-test-' + Date.now();
      
      const payment = await service.createPayment(
        orderId,
        50000,
        'midtrans',
        'Service User',
        'service@example.com'
      );

      expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
      
      // Verifikasi Service berhasil menggunakan Repository di bawahnya
      const checkInDb = await repository.findByOrderId(orderId);
      expect(checkInDb).not.toBeNull();
      expect(Number(checkInDb?.getAmount())).toBe(50000);
    });

    it('harus menolak transisi status yang tidak valid (Business Rules)', async () => {
      const orderId = 'service-logic-' + Date.now();
      await service.createPayment(orderId, 15000, 'midtrans');

      // Set dulu ke FAILED
      await service.updatePaymentStatus(orderId, PaymentStatus.FAILED);

      // Coba pindah dari FAILED ke PAID (Harus dilarang oleh aturan bisnis di Service)
      await expect(
        service.updatePaymentStatus(orderId, PaymentStatus.PAID)
      ).rejects.toThrow('Invalid transition');
    });
  });
});
