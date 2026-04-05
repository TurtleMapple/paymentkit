import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app';
import { initDatabase, orm } from '../config/db';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { Payment } from '../domain/entities/paymentEntity';
import { env } from '../config/env';

/**
 * STRATEGI: Top-Down Integration Test
 * 
 * Cara baca: Tes ini mensimulasikan aliran data dari urutan paling atas (API Route)
 * terus turun ke bawah sampai ke Database asli. 
 * Fokusnya adalah memastikan "pintu depan" (API) sudah tersambung dengan benar
 * ke semua komponen di belakangnya.
 */
describe('Top-Down Integration Test: Payment API', () => {
  
  //  run 1x  di awal sebelum semua tes dimulai
  beforeAll(async () => {
    try {
      // 1. Inisialisasi Database menggunakan konfigurasi khusus testing
      await initDatabase();
      
      // 2. Bersihkan dan buat ulang struktur tabel agar data tes sebelumnya tidak mengganggu
      const generator = ormInstance().getSchemaGenerator();
      await generator.refreshDatabase();
      
    } catch (err) {
      console.error('Persiapan Tes Gagal:', err);
      throw err;
    }
  });

  // Blok ini jalan sekali di akhir setelah semua tes selesai
  afterAll(async () => {
    // Tutup koneksi database agar proses tes bisa berhenti dengan bersih
    if (orm) {
      await orm.close();
    }
    // Tutup koneksi ke RabbitMQ (Message Broker)
    await closeRabbitMQConnection();
  });

  // Fungsi pembantu untuk mengambil instance database secara aman
  const ormInstance = () => {
    if (!orm) throw new Error('Database belum diinisialisasi');
    return orm;
  };

  // KELOMPOK TES: Membuat Pembayaran Baru
  describe('POST /payments', () => {
    it('harus berhasil membuat pembayaran dan mengembalikan status 201', async () => {
      // 1. Siapkan data yang akan dikirim ke API
      const paymentData = {
        amount: 75000,
        customer: {
          customerName: 'Top Down Test User',
          customerEmail: 'topdown@example.com',
          phone: '08123456789',
        },
      };

      // 2. Jalankan perintah: "Tembak API /payments dengan metode POST"
      const res = await app.request('/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY, // Gunakan kunci API yang valid
        },
        body: JSON.stringify(paymentData),
      });

      // 3. Periksa hasilnya: "Harus mengembalikan status 201 (Created)"
      expect(res.status).toBe(201);
      
      // 4. Periksa isi jawaban (body) dari API
      const body = await res.json();
      expect(body.data).toHaveProperty('orderId'); // Harus ada ID pesanan
      expect(body.data.amount).toBe(paymentData.amount); // Jumlah uang harus sama
      expect(body.data.status).toBe('PENDING'); // Status awal harus PENDING

      // 5. Verifikasi langsung ke Database (Ciri khas Top-Down dengan Real DB)
      // "Apakah data yang tadi lewat API benar-benar masuk ke tabel database?"
      const em = ormInstance().em.fork();
      const paymentInDb = await em.findOne(Payment, { orderId: body.data.orderId });
      expect(paymentInDb).not.toBeNull(); // Data tidak boleh kosong
      expect(Number(paymentInDb?.getAmount())).toBe(paymentData.amount); // Angkanya harus cocok
    });

    it('harus mengembalikan error 400 jika input tidak valid', async () => {
      // Data salah: jumlah uang minus dan nama kosong
      const invalidData = {
        amount: -100,
        customer: {
          customerName: '',
        },
      };

      // Tembak API
      const res = await app.request('/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.API_KEY,
        },
        body: JSON.stringify(invalidData),
      });

      // Harus gagal (400 Bad Request) karena validasi skema
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toBe('Validation failed');
    });
  });

  // KELOMPOK TES: Mengambil Detail Pembayaran
  describe('GET /payments/:orderId', () => {
    it('harus mengembalikan detail pembayaran untuk ID yang ada', async () => {
      // 1. Persiapan: Masukkan data langsung ke DB via Static Factory
      const em = ormInstance().em.fork();
      const orderId = 'test-top-down-get-' + Date.now();
      
      const payment = Payment.create(orderId, 100000, 'midtrans');
      payment.customerName = 'Getter User';
      payment.customerEmail = 'getter@example.com';
      
      await em.persistAndFlush(payment);

      // 2. Jalankan perintah: "Ambil data lewat API menggunakan orderId di atas"
      const res = await app.request(`/payments/${orderId}`, {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      // 3. Periksa: Status harus 200 (OK) dan datanya cocok
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.orderId).toBe(orderId);
      expect(body.data.amount).toBe(100000);
    });

    it('harus mengembalikan error 404 jika ID tidak ditemukan', async () => {
      const res = await app.request('/payments/id-asal-asalan', {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      expect(res.status).toBe(404);
    });
  });

  // KELOMPOK TES: Mengambil Semua Daftar Pembayaran
  describe('GET /payments', () => {
    it('harus mengembalikan daftar pembayaran dengan format paginasi', async () => {
      // Tembak API daftar pembayaran
      const res = await app.request('/payments', {
        method: 'GET',
        headers: {
          'x-api-key': env.API_KEY,
        },
      });

      // Periksa strukturnya: Harus ada array 'data' dan objek 'pagination'
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true); // Isinya harus list (array)
      expect(body).toHaveProperty('pagination'); // Harus ada keterangan halaman, limit, dsb
    });
  });
});
