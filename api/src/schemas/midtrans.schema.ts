import { z } from "zod";

// ===== CUSTOMER DETAILS (format Midtrans) =====
/**
 * Schema detail customer format Midtrans
 * Berbeda dari CustomerInfoSchema — ini mengikuti format API Midtrans
 */
export const MidtransCustomerDetailsSchema = z.object({
  first_name: z.string().describe('Nama depan customer'),
  last_name: z.string().optional().describe('Nama belakang customer'),
  email: z.string().email().describe('Email customer'),
  phone: z.string().optional().describe('Nomor telepon customer'),
  billing_address: z.object({
    first_name: z.string().describe('Nama depan customer'),
    last_name: z.string().optional().describe('Nama belakang customer'),
    phone: z.string().optional().describe('Nomor telepon customer'),
    address: z.string().optional(),
    city: z.string().optional(),
    postal_code: z.string().optional(),
    country_code: z.string().optional(),
  }).optional().describe('Alamat penagihan'),
  shipping_address: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    postal_code: z.string().optional(),
    country_code: z.string().optional(),
  }).optional().describe('Alamat pengiriman'),
});

// ===== ITEM DETAILS (format Midtrans) =====
/**
 * Schema item detail format Midtrans
 * Digunakan untuk mengirim detail item ke Midtrans
 */
export const MidtransItemDetailsSchema = z.object({
    id: z.string().describe('ID item/produk'),
    price: z.number().int().positive().describe('Harga satuan item'),
    quantity: z.number().int().positive().describe('Jumlah item'),
    name: z.string().max(50).describe('Nama item'),
    brand: z.string().optional().describe('Merek item'),
    category: z.string().optional().describe('Kategori item'),
    merchant_name: z.string().optional().describe('Nama merchant'),
});

// ===== CREDIT CARD OPTIONS (format Midtrans) =====
/**
 * Schema konfigurasi opsi kartu kredit Midtrans
 * Digunakan untuk mengatur parameter pembayaran kartu kredit, 3D Secure, dan cicilan
 */
export const MidtransCreditCardOptionsSchema = z.object({
  secure: z.boolean()
    .optional()
    .describe('Aktifkan autentikasi 3D Secure'),

  channel: z.enum(['migs', 'none'])
    .optional()
    .describe('Channel acquiring yang digunakan'),

  bank: z.string()
    .optional()
    .describe('Bank pengakuisisi (acquiring bank)'),

  installment: z.object({
    required: z.boolean()
      .describe('Wajibkan pembayaran cicilan'),
    terms: z.record(z.string(), z.array(z.number()))
      .describe('Tenor cicilan berdasarkan bank (contoh: {"bni": [3, 6, 12]})')
  })
    .optional()
    .describe('Konfigurasi cicilan'),

  whitelist_bins: z.array(z.string())
    .optional()
    .describe('Daftar nomor BIN yang diperbolehkan')
}).optional();

// ===== CALLBACKS (format Midtrans) =====
/**
 * Schema konfigurasi callback Midtrans
 * Digunakan untuk mengatur URL pengalihan (redirect) kustom setelah proses pembayaran
 */
export const MidtransCallbacksSchema = z.object({
  finish: z.string()
    .url()
    .optional()
    .describe('URL ketika pembayaran selesai (baik sukses maupun gagal)'),

  unfinish: z.string()
    .url()
    .optional()
    .describe('URL ketika pelanggan menutup halaman pembayaran sebelum selesai'),

  error: z.string()
    .url()
    .optional()
    .describe('URL ketika terjadi kesalahan teknis pada sistem pembayaran')
}).optional();

// ===== EXPIRY =====
/**
 * Schema konfigurasi waktu kadaluarsa pembayaran
 */
export const MidtransExpirySchema = z.object({
  start_time: z.string().optional().describe('Waktu mulai format: yyyy-MM-dd HH:mm:ss Z'),
  unit: z.enum(['second', 'minute', 'hour', 'day']).describe('Satuan durasi kadaluarsa'),
  duration: z.number().int().positive().describe('Durasi kadaluarsa'),
});

// ===== COMBINED OPTIONS =====
/**
 * Schema opsi lengkap untuk transaksi Midtrans
 * Menggabungkan semua konfigurasi opsional
 */
export const MidtransOptionsSchema = z.object({
  customer_details: MidtransCustomerDetailsSchema.optional().describe('Detail customer format Midtrans'),
  item_details: z.array(MidtransItemDetailsSchema).optional().describe('Daftar item yang dibeli'),
  credit_card: MidtransCreditCardOptionsSchema.optional().describe('Opsi kartu kredit'),
  callbacks: MidtransCallbacksSchema.optional().describe('URL callback redirect'),
  expiry: MidtransExpirySchema.optional().describe('Konfigurasi kadaluarsa'),
});

// ===== WEBHOOK NOTIFICATION =====
/**
 * Schema webhook notification dari Midtrans
 * Digunakan untuk validasi payload notifikasi yang dikirim Midtrans ke server
 * Ref: https://docs.midtrans.com/reference/http-notification
 */
export const MidtransWebhookSchema = z.object({
  transaction_id: z.string().describe('ID transaksi dari Midtrans'),
  order_id: z.string().describe('ID order dari sistem'),
  gross_amount: z.string().describe('Total pembayaran'),
  payment_type: z.string().describe('Jenis pembayaran (bank_transfer, gopay, dll)'),
  transaction_time: z.string().describe('Waktu transaksi'),
  transaction_status: z.string().describe('Status transaksi (settlement, pending, dll)'),
  fraud_status: z.string().optional().describe('Status fraud detection'),
  status_code: z.string().describe('Kode status HTTP'),
  signature_key: z.string().describe('Signature untuk validasi keamanan'),
  va_numbers: z.array(z.object({
    bank: z.string().describe('Nama bank'),
    va_number: z.string().describe('Nomor virtual account'),
  })).optional().describe('Nomor virtual account (untuk bank transfer)'),
  expiry_time: z.string().optional().describe('Waktu kadaluarsa pembayaran'),
  settlement_time: z.string().optional().describe('Waktu settlement'),
});

// ===== TIPE TYPESCRIPT =====
export type MidtransCustomerDetails = z.infer<typeof MidtransCustomerDetailsSchema>;
export type MidtransItemDetails = z.infer<typeof MidtransItemDetailsSchema>;
export type MidtransCreditCardOptions = z.infer<typeof MidtransCreditCardOptionsSchema>;
export type MidtransCallbacks = z.infer<typeof MidtransCallbacksSchema>;
export type MidtransExpiry = z.infer<typeof MidtransExpirySchema>;
export type MidtransOptions = z.infer<typeof MidtransOptionsSchema>;
export type MidtransWebhook = z.infer<typeof MidtransWebhookSchema>;