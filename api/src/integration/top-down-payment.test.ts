import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../app';
import { initDatabase, orm } from '../config/db';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { Payment } from '../domain/entities/paymentEntity';
import { env } from '../config/env';

/**
 * STRATEGI: Top-Down Integration Test (Full Flow)
 * 
 * Cara baca: Tes ini mensimulasikan aliran data secara utuh dari urutan paling atas (API Route)
 * terus turun ke bawah sampai ke Database asli, hingga simulasi Webhook dikirim oleh payment gateway.
 * Fokusnya adalah memastikan siklus penuh transaksi (Buat -> Cek -> Bayar) berjalan sukses tanpa error.
 */

// --- 1. Mock Eksternal Payment Gateway ---
// Sangat penting di Integration Test agar kita TIDAK menembak API vendor (Midtrans) asli yang butuh koneksi internet
vi.mock('../domain/gateways/PaymentGatewayFactory', () => ({
  PaymentGatewayFactory: {
    create: vi.fn(() => ({
      // Simulasi Create Payment API
      createPayment: vi.fn().mockImplementation(async (req) => ({
        orderId: req.orderId,
        paymentLink: 'https://mock.midtrans.link/snap',
        paymentType: 'bank_transfer',
        expiredAt: new Date(Date.now() + 86400000), // Besok
        gatewayResponse: { status_code: '201' }
      })),
      // Simulasi Pemeriksaan Signature (Otomatis sukses)
      validateWebhook: vi.fn(() => true), 
      // Simulasi Translasi Payload Webhook
      processWebhook: vi.fn().mockImplementation(async (payload) => ({
        orderId: payload.order_id,
        status: payload.transaction_status === 'settlement' ? 'PAID' : 'PENDING',
        paymentType: payload.payment_type,
        gatewayResponse: payload
      }))
    }))
  }
}));

describe('Top-Down Integration Test: End-to-End Payment Flow', () => {
  let createdOrderId: string; // Variabel "jembatan" untuk menyimpan ID lintas tahapan
  const customerEmail = 'fullflow@example.com';

  // --- PERSIAPAN LINGKUNGAN TES ---

  // Berjalan 1x di awal untuk menyiapkan Database
  beforeAll(async () => {
    try {
      // 1. Inisiasi Database menggunakan environment config test
      await initDatabase();
      
      // 2. Refresh & buat ulang struktur tabel (Isolasi data agar tidak bentrok)
      const generator = ormInstance().getSchemaGenerator();
      await generator.refreshDatabase();
      
    } catch (err) {
      console.error('Persiapan Tes Gagal:', err);
      throw err;
    }
  });

  // Berjalan di akhir untuk mematikan koneksi secara bersih
  afterAll(async () => {
    if (orm) await orm.close(); // Tutup database
    await closeRabbitMQConnection(); // Tutup koneksi RabbitMQ
  });

  // Helper aman untuk memanggil MikroORM instans
  const ormInstance = () => {
    if (!orm) throw new Error('Database belum diinisialisasi');
    return orm;
  };

  // ========================================================
  // RANGKAIAN EVENT (TEST FLOW BERURUTAN)
  // ========================================================

  describe('TAHAP 1: Inisiasi Pembayaran Baru (POST /payments)', () => {
    it('harus berhasil membuat pembayaran dan mengembalikan status PENDING', async () => {
      // 1. Siapkan data pembeli
      const paymentData = {
        amount: 250000,
        customer: {
          customerName: 'Sultan TopDown',
          customerEmail: customerEmail,
          phone: '081234567890',
        },
      };

      // 2. Tembak API layaknya HTTP Client (Simulasi Frontend/Aplikasi)
      const res = await app.request('/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY, // Otorisasi internal
        },
        body: JSON.stringify(paymentData),
      });

      // 3. Verifikasi Level Atas (API Response)
      expect(res.status).toBe(201);
      const body = await res.json();
      
      expect(body.data).toHaveProperty('orderId');
      expect(body.data.amount).toBe(paymentData.amount);
      expect(body.data.status).toBe('PENDING');

      // 4. Catat orderId untuk tahap selanjutnya
      createdOrderId = body.data.orderId;

      // 5. Verifikasi Level Bawah (Database Real)
      // Bukti nyata bahwa request yang lewat API benar-benar masuk ke MySQL
      const em = ormInstance().em.fork();
      const paymentInDb = await em.findOne(Payment, { orderId: createdOrderId });
      expect(paymentInDb).not.toBeNull();
      expect(Number(paymentInDb?.getAmount())).toBe(paymentData.amount);
    });

    it('harus aman dari akses tanpa kunci API (401 Unauthorized)', async () => {
      const res = await app.request('/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // Lupa memasukkan x-api-key
        body: JSON.stringify({ amount: 1000 }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('TAHAP 2: Pengecekan Awal Pembayaran (GET /payments/:orderId)', () => {
    it('harus menampilkan pesanan yang baru dibuat dengan status awal (PENDING)', async () => {
      // Frontend mengecek detail pesanan berdasarkan ID
      const res = await app.request(`/v1/payments/${createdOrderId}`, {
        method: 'GET',
        headers: { 'x-api-key': env.API_KEY },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.orderId).toBe(createdOrderId);
      expect(body.data.status).toBe('PENDING'); // Masih PENDING karena belum ditransfer
    });
  });

  describe('TAHAP 3: Simulasi Notifikasi Gateway Server-to-Server (POST /webhooks/midtrans)', () => {
    it('harus menerima webhook sukses dan mengupdate pesanan menjadi PAID', async () => {
      // 1. Siapkan payload simulasi dari Midtrans (Skenario: Customer selesai transfer bank)
      const webhookPayload = {
        order_id: createdOrderId, 
        transaction_status: 'settlement', // 'settlement' = uang berhasil diproses
        status_code: '200',
        gross_amount: '250000.00',
        payment_type: 'bank_transfer',
        signature_key: 'mock-signature-key' // Validasi ini dibypass oleh mock Factory di atas
      };

      // 2. Tembak endpoint Webhook kita (Endpoint ini bersifat PUBLIC/terbuka)
      const res = await app.request('/v1/webhooks/midtrans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-midtrans-signature': webhookPayload.signature_key
        },
        body: JSON.stringify(webhookPayload),
      });

      // 3. Pastikan API merespons ke arah Gateway bahwa notifikasi sudah diterima (HTTP 200 OK)
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('PAID');

      // 4. Verifikasi Mutlak: Periksa perubahan di dalam Tabel Database
      // Perubahan status ini dilakukan oleh Handler -> Service -> Entity
      const em = ormInstance().em.fork();
      const updatedPayment = await em.findOne(Payment, { orderId: createdOrderId });
      expect(updatedPayment?.getStatus()).toBe('PAID');
    });
  });

  describe('TAHAP 4: Verifikasi Akhir Pembayaran (GET /payments/:orderId)', () => {
    it('harus mengonfirmasi bahwa status pesanan secara global telah berubah rupa menjadi PAID', async () => {
      // Customer memuat ulang halaman e-commerce, frontend memanggil API detail
      const res = await app.request(`/v1/payments/${createdOrderId}`, {
        method: 'GET',
        headers: { 'x-api-key': env.API_KEY },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      
      // Pembuktian final End-to-End berhasil
      expect(body.data.orderId).toBe(createdOrderId);
      expect(body.data.status).toBe('PAID');
    });
  });

  describe('TAHAP 5: Pengecekan Daftar Transaksi Paginasi (GET /payments)', () => {
    it('harus menampilkan riwayat pesanan yang kita jalankan di halaman master', async () => {
      // Admin dashboard menarik list semua pelanggan
      const res = await app.request('/v1/payments', {
        method: 'GET',
        headers: { 'x-api-key': env.API_KEY },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      
      // Buktikan bahwa pesanan tes kita benar-benar terekam di pagination list
      const foundOrder = body.data.find((p: any) => p.orderId === createdOrderId);
      expect(foundOrder).toBeDefined();
      expect(foundOrder.status).toBe('PAID');
    });
  });
});
