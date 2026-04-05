import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app';
import { initDatabase, orm } from '../config/db';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { Payment } from '../domain/entities/paymentEntity';
import { PaymentStatus } from '../domain/entities/paymentStatus';
import { env } from '../config/env';

/**
 * STRATEGI: Hybrid (Sandwich) Integration Test
 * 
 * Cara baca: Tes ini disebut Sandwich karena kita "menjepit" Logika Bisnis (Service)
 * dari dua sisi sekaligus:
 * 1. Dari Atas: Menggunakan request HTTP (API/Route).
 * 2. Dari Bawah: Melakukan verifikasi langsung ke Database (Repository/Entity).
 * 
 * Titik fokusnya adalah memastikan aliran data utuh dan aturan bisnis di tengah (Service)
 * berjalan dengan benar saat dipicu oleh aksi dari luar.
 */
describe('Hybrid Integration Test: Payment Flow (Sandwich)', () => {
  beforeAll(async () => {
    try {
      // 1. Inisialisasi Database
      await initDatabase();
      
      // 2. Refresh Schema (Isolasi data untuk pengujian)
      const generator = orm!.getSchemaGenerator();
      await generator.refreshDatabase();
      
    } catch (err) {
      console.error('Test Setup Failed:', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (orm) {
      await orm.close();
    }
    await closeRabbitMQConnection();
  });

  // Skema "Sandwich" 1: Alur Pembuatan Pembayaran (Pemicu dari API -> Dampak ke DB)
  describe('Alur: Create -> Verify DB Persistence', () => {
    it('harus memproses pembayaran via API dan datanya tersimpan benar di level Database', async () => {
      const orderId = 'hybrid-create-' + Date.now();
      const payload = {
        amount: 150000,
        customer: {
          customerName: 'Hybrid User',
          customerEmail: 'hybrid@example.com',
          phone: '08123456789',
        },
      };

      // --- SISI ATAS (HTTP Request) ---
      const res = await app.request('/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY,
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      // --- SISI BAWAH (Database Verification) ---
      // Kita langsung "turun" ke database untuk memastikan Service bekerja dengan Repository
      const em = orm!.em.fork();
      const paymentInDb = await em.findOne(Payment, { orderId: body.data.orderId });

      expect(paymentInDb).not.toBeNull();
      expect(paymentInDb?.getStatus()).toBe(PaymentStatus.PENDING);
      expect(Number(paymentInDb?.getAmount())).toBe(payload.amount);
      expect(paymentInDb?.customerName).toBe(payload.customer.customerName);
    });
  });

  // Skema "Sandwich" 2: Alur Update & Konsistensi State
  describe('Alur: Polling Detail -> Internal Synchronization', () => {
    it('harus sinkron antara data yang ditarik via API dengan data yang ada di level bawah', async () => {
      // 1. Setup: Buat data langsung di level bawah (Database) via Static Factory
      const em = orm!.em.fork();
      const orderId = 'hybrid-sync-' + Date.now();
      
      const payment = Payment.create(orderId, 45000, 'midtrans');
      payment.customerName = 'Sync User';
      
      await em.persistAndFlush(payment);

      // 2. --- SISI ATAS (API Request) ---
      // Ambil detail pembayaran lewat pintu depan
      const res = await app.request(`/payments/${orderId}`, {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      expect(res.status).toBe(200);
      const responseBody = await res.json();

      // 3. --- VERIFIKASI ---
      // Pastikan apa yang dikembalikan API (Atas) ISINYA SAMA dengan apa yang kita buat di DB (Bawah)
      expect(responseBody.data.orderId).toBe(orderId);
      expect(responseBody.data.amount).toBe(45000);
      expect(responseBody.data.status).toBe(PaymentStatus.PENDING);
    });
  });

  // Skema "Sandwich" 3: Penanganan Data Kompleks (Paginasi Luar vs Count Dalam)
  describe('Alur: Bulk Integration Check', () => {
    it('harus memiliki jumlah data yang konsisten antara API response dan Database count', async () => {
      // Tembak API All Payments
      const res = await app.request('/payments', {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      const body = await res.json();
      const apiTotal = body.pagination.total;

      // Verifikasi langsung ke DB count
      const em = orm!.em.fork();
      const dbTotal = await em.count(Payment, { deletedAt: null });

      // Kekuatan Hybrid: Memastikan metrics di API (Atas) SAMA PERSIS dengan kenyataan di DB (Bawah)
      expect(apiTotal).toBe(dbTotal);
    });
  });
});
