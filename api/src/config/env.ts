import { config } from 'dotenv';
import path from 'path';
import { z } from 'zod';

/**
 * TAHAP 1: LOADING FILE .ENV
 * Kita menentukan file mana yang akan dibaca berdasarkan NODE_ENV.
 * Jika sedang testing, kita pakai .env.test agar tidak merusak database utama.
 */
if (process.env.NODE_ENV === 'test') {
  config({ path: path.resolve(process.cwd(), '.env.test') });
} else {
  config();
}

/**
 * TAHAP 2: VALIDASI SKEMA (Kunci Keamanan Kode)
 * Menggunakan Zod untuk memastikan semua variabel yang dibutuhkan ada dan tipenya benar.
 * Jika ada yang kurang, aplikasi akan langsung "Lapor" (error) saat startup.
 */
const envSchema = z.object({
  // Konfigurasi Dasar Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Kredensial Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('paymentkit'),
  DATABASE_URL: z.string().optional(), // Dipakai di Cloud (Heroku/Railway/VPS)

  // Konfigurasi Antrian (RabbitMQ)
  RABBITMQ_ENABLED: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('payment.exchange'),
  RABBITMQ_QUEUE: z.string().default('payment.created'),

  // Kredensial Vendor (Midtrans)
  MIDTRANS_SERVER_KEY: z.string().min(1, 'MIDTRANS_SERVER_KEY wajib diisi'),
  MIDTRANS_CLIENT_KEY: z.string().min(1, 'MIDTRANS_CLIENT_KEY wajib diisi'),
  MIDTRANS_IS_PRODUCTION: z.preprocess((val) => val === 'true', z.boolean()).default(false),

  // Keamanan API Kita
  API_KEY: z.string().min(1, 'API_KEY aplikasi wajib diisi'),

  // Level Pencatatan Log
  LOG_LEVEL: z.enum(['info', 'success', 'error', 'debug', 'warn']).default('info'),
});

/**
 * TAHAP 3: EKSEKUSI VALIDASI
 * safeParse akan mengecek process.env terhadap skema di atas.
 */
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Jika validasi gagal, tampilkan list errornya dan matikan aplikasi (Fail-Fast)
  console.error('❌ Variabel Environment Tidak Valid:', JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

// Export hasil yang sudah valid dan memiliki tipe data yang jelas (Type-Safe)
export const env = parsedEnv.data;
