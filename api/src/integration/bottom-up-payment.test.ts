import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
 * Filosofi: Menyusun sistem layaknya merakit fondasi gedung dari yang paling dasar.
 * Kita mulai dari pondasi terdalam (Entity & Database MySQL), memastikan tidak ada keropos data, 
 * lalu secara bertahap naik ke tingkat di atasnya (Repository/ORM layer), 
 * dan dipuncaki oleh pemeriksaan Logika Bisnis Terpusat (Application Service).
 * 
 * Titik fokusnya adalah membuktikan "ketahanan struktur sistem internal" 
 * dari manipulasi data atau cacat bisnis, TANPA menyentuh API (HTTP Route).
 */

// --- MOCK EXTERNAL SYSTEM (Gateway Lokal & Infrastruktur Asinkron) ---
vi.mock('../domain/gateways/PaymentGatewayFactory', () => ({
  PaymentGatewayFactory: {
    create: vi.fn(() => ({
      createPayment: vi.fn().mockResolvedValue({
        orderId: 'bottom-up-order',
        paymentLink: 'https://mock.bottom-up.link',
        paymentType: 'bank_transfer',
        expiredAt: new Date(Date.now() + 864000),
        gatewayResponse: {}
      })
    }))
  }
}));

// Mock Message Broker (RabbitMQ) agar logic Service tidak nge-hang karena tidak ada koneksi message broker nyata
vi.mock('../domain/services/rabbitmq/RabbitMQEventPublisher', () => {
  return {
    RabbitMQPaymentEventPublisher: class {
      publishPaymentCreated = async () => true;
      publishPaymentCompleted = async () => true;
      publishPaymentUpdated = async () => true;
    }
  };
});

describe('Bottom-Up Integration Test: Pondasi Sistem Pembayaran', () => {
  let repository: PaymentRepository;
  let service: PaymentService;
  let publisher: RabbitMQPaymentEventPublisher;

  // --- PERSIAPAN PERAKITAN BOTTOM-UP ---
  beforeAll(async () => {
    try {
      await initDatabase();
      const generator = orm!.getSchemaGenerator();
      await generator.refreshDatabase();

      // Membangun instansiasi sistem manual (Tindakan meniru IoC Container)
      repository = new PaymentRepository(orm!.em.fork());
      publisher = new RabbitMQPaymentEventPublisher();
      vi.spyOn(publisher, 'publishPaymentCreated');
      service = new PaymentService(repository, publisher);
    } catch (error) {
      console.error('Koneksi DB Test Gagal:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (orm) await orm.close();
    await closeRabbitMQConnection();
  });

  // ========================================================
  // RANGKAIAN EVENT (TEST FLOW BOTTOM-UP)
  // ========================================================

  describe('TAHAP 1: Validitas Kelas Entitas Murni (Domain Model Core)', () => {
    it('harus mengamankan operasi awal instansiasi pembayaran secara internal', () => {
      // Entity adalah blok material bangunan terkecil. Kita menguji fungsional object-oriented murninya.
      const orderId = 'entity-test-1';
      const payment = Payment.create(orderId, 15000, 'midtrans');
      
      expect(payment.getStatus()).toBe(PaymentStatus.PENDING);
      expect(payment.getId()).toBeDefined();

      // Menguji mutasi metode khusus (Domain Behaviors)
      payment.complete();
      expect(payment.getStatus()).toBe(PaymentStatus.PAID);
    });
  });

  describe('TAHAP 2: Ketangguhan Repositori (Akses Data MySQL & Sistem ORM Mikro)', () => {
    it('harus mampu merekam Entity Murni ke MySQL dan mempertahankan struktur bentuk dasarnya (Persist)', async () => {
      const orderId = 'repo-test-' + Date.now();
      const payment = Payment.create(orderId, 75000, 'midtrans');
      payment.customerName = 'Bapak Repositori';
      payment.customerEmail = 'repo@bottomup.test';

      // Uji kemampuan penginjeksian data Repositori
      await repository.save(payment);

      // Menarik ulang dari ketiadaan dan mencocokkan kemiripan data
      const retrievedPayment = await repository.findByOrderId(orderId);
      expect(retrievedPayment).not.toBeNull();
      expect(retrievedPayment?.customerName).toBe('Bapak Repositori');
      expect(Number(retrievedPayment?.getAmount())).toBe(75000);
    });

    it('harus mendukung pembaruan field secara atomik untuk mencegah status tergandaan data', async () => {
      const orderId = 'repo-update-' + Date.now();
      const payment = Payment.create(orderId, 100000);
      await repository.save(payment); // Disimpan sebagai PENDING terlebih dahulu

      // Ambil kembali (Fetch), ubah nilai state lewat Behaviour Domain, dan Simpan Perubahannya (Commit)
      const paymentToUpdate = await repository.findByOrderId(orderId);
      paymentToUpdate!.expire(); // Membunuh payment karena waktu habis
      await repository.save(paymentToUpdate!);

      const finalCheck = await repository.findByOrderId(orderId);
      expect(finalCheck?.getStatus()).toBe(PaymentStatus.EXPIRED);
    });
  });

  describe('TAHAP 3: Mahkota Logika Bisnis (Application Service Orchestration)', () => {
    it('harus memadukan integrasi kokoh antara PaymentGateway, Database (Repositori), dan Notifikasi Antrian (Event Publisher)', async () => {
      const orderId = 'service-flow-' + Date.now();
      
      // Kita panggil jantung logika aplikasi, ini akan membedah operasi multi-lapis di belakang layar
      const newPayment = await service.createPayment(
        orderId,
        185000,
        'midtrans',
        'Kakak Service Orchestrator',
        'service@bottomup.test' // Parameter Email
      );

      // Verifikasi output balikan awal Servis
      expect(newPayment.getStatus()).toBe(PaymentStatus.PENDING);
      expect(Number(newPayment.getAmount())).toBe(185000);

      // Uji Penetrasi 1: Apakah Service bertugas menitipkan data dengan baik ke Repository TAHAP 2?
      const dbProof = await repository.findByOrderId(orderId);
      expect(dbProof).not.toBeNull();

      // Uji Penetrasi 2: Apakah Service terbukti telah mencetuskan alarm ke modul Event Publisher Eksternal (RabbitMQ)?
      expect(publisher.publishPaymentCreated).toHaveBeenCalled();
    });

    it('harus bertindak pro-aktif sebagai Satpam Kebijakan Bisnis penolak mutasi State yang janggal', async () => {
      const orderId = 'service-logic-' + Date.now();
      await service.createPayment(orderId, 15000, 'midtrans');

      // Simulasi kegagalan status (Mungkin koneksi Gateway terhenti, dibatalkan via aplikasi, dll)
      await service.updatePaymentStatus(orderId, PaymentStatus.FAILED);

      // ATURAN BISNIS MUTLAK: Pembayaran yang GAGAL/FAILED tidak dapat dilegalkan instan menjadi PAID.
      // Jika di sini throws error Exception, Service divalidasi bekerja dengan benar mencegah "kebocoran" sistem!
      await expect(
        service.updatePaymentStatus(orderId, PaymentStatus.PAID)
      ).rejects.toThrow('Invalid transition');
      
      // Bukti Konkrit: Database harus tetap aman berlindung di status aslinya
      const finalCheck = await repository.findByOrderId(orderId);
      expect(finalCheck?.getStatus()).toBe(PaymentStatus.FAILED);
    });
  });
});
