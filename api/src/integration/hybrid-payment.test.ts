import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../app';
import { initDatabase, orm } from '../config/db';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { Payment } from '../domain/entities/paymentEntity';
import { PaymentStatus } from '../domain/entities/paymentStatus';
import { env } from '../config/env';

/**
 * STRATEGI: Hybrid (Sandwich) Integration Test
 * 
 * Filosofi: Tes ini menggunakan pendekatan "Sandwich", di mana kita menjepit logika bisnis aplikasi 
 * dari dua poros ekstrem sekaligus:
 * - Arah Atas (Eksternal)  : Menggunakan pemanggilan endpoint API (HTTP Request/Response).
 * - Arah Bawah (Internal)  : Menyelam langsung ke Database memverifikasi status Entity.
 * 
 * Tujuannya adalah untuk mendeteksi deviasi/ketidakcocokan antara data yang ditampilkan oleh API
 * dengan data state (keadaan) fisik sebenarnya yang tertanam di level persisten MySQL.
 */

// --- MOCK PAYMENT GATEWAY ---
// Mencegah tembakan asli ke API pihak ketiga (Midtrans) dan menjaga efisiensi execution time di pipeline CI/CD
vi.mock('../domain/gateways/PaymentGatewayFactory', () => ({
  PaymentGatewayFactory: {
    create: vi.fn(() => ({
      createPayment: vi.fn().mockImplementation(async (req) => ({
        orderId: req.orderId,
        paymentLink: 'https://mock.hybrid.midtrans.link/',
        paymentType: 'bank_transfer',
        expiredAt: new Date(Date.now() + 86400000), // Kedaluwarsa 24 jam ke depan
        gatewayResponse: { mocked: true }
      })),
      validateWebhook: vi.fn(() => true),
      processWebhook: vi.fn().mockImplementation(async (payload) => ({
        orderId: payload.order_id,
        status: payload.transaction_status || 'PAID',
        paymentType: payload.payment_type,
        gatewayResponse: payload
      }))
    }))
  }
}));


describe('Hybrid Integration Test: Payment Sandwich Validation', () => {
  // Berjalan 1x di awal untuk menyiapkan Database
  beforeAll(async () => {
    try {
      // 1. Inisialisasi Database
      await initDatabase();
      
      // 2. Refresh Schema (Membersihkan data lampau untuk isolasi pengujian)
      const generator = orm!.getSchemaGenerator();
      await generator.refreshDatabase();
      
    } catch (err) {
      console.error('Test Setup Failed:', err);
      throw err;
    }
  });

  // Berjalan di akhir untuk mematikan koneksi secara bersih
  afterAll(async () => {
    if (orm) await orm.close(); // Tutup database
    await closeRabbitMQConnection(); // Tutup RabbitMQ
  });

  // =========================================================================
  // SKENARIO SANDWICH 1: Pemicu Eksternal (API) ➔ Diverifikasi Internal (DB)
  // =========================================================================
  describe('Alur A: Top-Down Creation (Create API -> Cek DB Persistence)', () => {
    it('harus memproses pembayaran via API (Atas) dan tersimpan identik di Database (Bawah)', async () => {
      const orderId = 'hybrid-create-' + Date.now();
      const payload = {
        amount: 300000,
        customer: {
          customerName: 'Hybrid Tester',
          customerEmail: 'tester@hybrid.com',
          phone: '081122334455',
        },
      };

      // --- SISI ATAS (HTTP Request) ---
      // User memicu pembuatan pesanan melalu REST API
      const res = await app.request('/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY,
        },
        body: JSON.stringify(payload),
      });

      // API Harus menjawab OK dan terekam sistem
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.orderId).toBeDefined();

      // --- SISI BAWAH (Database Validation) ---
      // Kita meloncat ke "basement" sistem. Membaca langsung dari tabel / Entity
      const em = orm!.em.fork();
      const paymentInDb = await em.findOne(Payment, { orderId: body.data.orderId });

      // Fakta membuktikan API memberikan impact sampai ke MySQL
      expect(paymentInDb).not.toBeNull();
      expect(paymentInDb?.getStatus()).toBe(PaymentStatus.PENDING);
      expect(Number(paymentInDb?.getAmount())).toBe(payload.amount);
      expect(paymentInDb?.customerName).toBe(payload.customer.customerName);
    });
  });

  // =========================================================================
  // SKENARIO SANDWICH 2: Seeding Internal (DB) ➔ Diverifikasi Eksternal (API)
  // =========================================================================
  describe('Alur B: Bottom-Up Polling (Seeding DB -> Polling Data di API)', () => {
    it('harus mensinkronkan rupa data buatan (seeding) di DB agar utuh ketika dipanggil via API', async () => {
      // --- SISI BAWAH (Database Setup) ---
      // 1. Data disuntikkan secara keras via Static Factory ke dalam barisan tabel (MySQL)
      const em = orm!.em.fork();
      const orderId = 'hybrid-sync-' + Date.now();
      
      const payment = Payment.create(orderId, 55000, 'midtrans');
      payment.customerName = 'Silent Injector';
      
      await em.persistAndFlush(payment);

      // --- SISI ATAS (HTTP Request) ---
      // 2. Client me-*request* detail pesanan, menguji apakah API merender data baselayer dengan utuh
      const res = await app.request(`/v1/payments/${orderId}`, {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      // 3. Verifikasi Identitas
      expect(res.status).toBe(200);
      const responseBody = await res.json();

      // Memastikan Atas (API) me-reflect Bawah (DB) tanpa distorsi data
      expect(responseBody.data.orderId).toBe(orderId);
      expect(responseBody.data.amount).toBe(55000);
      expect(responseBody.data.status).toBe(PaymentStatus.PENDING);
    });
  });

  // =========================================================================
  // SKENARIO SANDWICH 3: Ekstraksi Skala Besar (Sistemik Metrics)
  // =========================================================================
  describe('Alur C: Bulk Integration Comparison (Metadata API vs Database Count)', () => {
    it('harus selaras secara jumlah antara perhitungan paginasi API dengan jumlah Record row DB', async () => {
      // --- SISI ATAS (Metadata API View) ---
      // Menarik semua riwayat pesanan
      const res = await app.request('/v1/payments', {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      const body = await res.json();
      const apiTotalCount = body.pagination.total;

      // --- SISI BAWAH (Query Metric View) ---
      // Menghitung raw data non-deleted (Count from DB)
      const em = orm!.em.fork();
      const dbRealCount = await em.count(Payment, { deletedAt: null });

      // --- VERIFIKASI AKAN KEKUATAN SANDWICH ---
      // Angka yang dilihat user di API Mutlak sama dengan angka di MySQL
      expect(apiTotalCount).toBe(dbRealCount);
    });
  });
});
