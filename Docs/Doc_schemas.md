# Dokumentasi Schemas Payment API

## Overview

Schemas adalah blueprint yang mendefinisikan struktur data yang masuk (request) dan keluar (response) dari API. Menggunakan Zod untuk validasi runtime dan generasi dokumentasi OpenAPI.

---

## Struktur File Schemas

```
src/schemas/
├── shared.schema.ts      # Schema reusable untuk seluruh API
├── payment.schema.ts     # Schema untuk endpoint payment
└── webhook.schema.ts     # Schema untuk webhook dari payment gateway
```

---

## 1. shared.schema.ts

### Deskripsi
File ini berisi schema yang dapat digunakan kembali (reusable) di seluruh API. Berfungsi sebagai base schemas yang diimport oleh schema lain.

### Schema yang Tersedia

#### 1.1 ErrorResponseSchema
**Fungsi:** Format standar untuk response error

**Struktur:**
```typescript
{
  success: false,           // Selalu false untuk error
  error: string,            // Jenis error (ValidationError, NotFoundError, dll)
  details?: any             // Detail error tambahan (opsional)
}
```

**Contoh Response:**
```json
{
  "success": false,
  "error": "ValidationError",
  "details": {
    "orderId": "Order ID harus diisi"
  }
}
```

---

#### 1.2 SuccessResponseSchema
**Fungsi:** Factory function untuk membungkus response sukses dengan format standar

**Struktur:**
```typescript
{
  success: true,            // Selalu true untuk sukses
  data: T,                  // Data response (generic type)
  message: string           // Pesan sukses
}
```

**Contoh Penggunaan:**
```typescript
const CreatePaymentResponseSchema = SuccessResponseSchema(PaymentSchema);
```

**Contoh Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "orderId": "ORDER-123",
    "amount": 100000,
    "status": "PENDING"
  },
  "message": "Payment berhasil dibuat"
}
```

---

#### 1.3 CustomerSchema
**Fungsi:** Schema untuk data customer

**Field:**
- `customerName` (string, optional) - Nama customer (max 128 karakter)
- `customerEmail` (string, optional) - Email customer (format email valid, max 128 karakter)

**Contoh:**
```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com"
}
```

---

#### 1.4 PaymentSchema
**Fungsi:** Schema lengkap entity Payment (mirror dari database)

**Field:**
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| id | UUID | ✅ | ID unik payment |
| orderId | string | ✅ | Order ID dari sistem |
| amount | number | ✅ | Jumlah pembayaran (rupiah) |
| status | enum | ✅ | Status: PENDING, PAID, FAILED, EXPIRED |
| paymentType | string | ❌ | Jenis pembayaran (bank_transfer, gopay, dll) |
| bank | string | ❌ | Kode bank (bca, bni, mandiri, dll) |
| vaNumber | string | ❌ | Nomor virtual account |
| expiredAt | date | ❌ | Waktu kadaluarsa pembayaran |
| paidAt | date | ❌ | Waktu pembayaran selesai |
| gateway | string | ✅ | Payment gateway (midtrans, xendit) |
| gatewayResponse | any | ❌ | Response mentah dari gateway |
| createdAt | date | ✅ | Waktu dibuat |
| updatedAt | date | ✅ | Waktu update terakhir |
| deletedAt | date | ❌ | Waktu soft delete |
| paymentLink | string | ❌ | URL payment link |
| paymentLinkCreatedAt | date | ❌ | Waktu payment link dibuat |
| paymentAttemptCount | number | ✅ | Jumlah percobaan generate link |
| customerName | string | ❌ | Nama customer |
| customerEmail | string | ❌ | Email customer |

---

## 2. payment.schema.ts

### Deskripsi
File ini berisi schema untuk endpoint payment API (API yang kita buat). Digunakan untuk validasi request dari client dan format response ke client.

### Schema yang Tersedia

#### 2.1 CreatePaymentRequestSchema
**Fungsi:** Validasi request pembuatan payment baru

**Endpoint:** `POST /payments`

**Field:**
| Field | Type | Required | Validasi | Deskripsi |
|-------|------|----------|----------|-----------|
| orderId | string | ✅ | min: 1, max: 64 | ID order unik dari sistem |
| amount | number | ✅ | integer, positive | Jumlah pembayaran (rupiah) |
| gateway | string | ❌ | default: 'midtrans' | Payment gateway yang digunakan |
| customer | object | ❌ | CustomerSchema | Data customer |

**Contoh Request:**
```json
{
  "orderId": "ORDER-20240210-001",
  "amount": 150000,
  "gateway": "midtrans",
  "customer": {
    "customerName": "John Doe",
    "customerEmail": "john@example.com"
  }
}
```

---

#### 2.2 CreatePaymentResponseSchema
**Fungsi:** Format response setelah payment berhasil dibuat

**Struktur:** Menggunakan `PaymentSchema` dari shared

**Contoh Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "orderId": "ORDER-20240210-001",
  "amount": 150000,
  "status": "PENDING",
  "paymentType": null,
  "bank": null,
  "vaNumber": null,
  "paymentLink": "https://app.midtrans.com/snap/v1/...",
  "expiredAt": "2024-02-11T10:30:00Z",
  "gateway": "midtrans",
  "createdAt": "2024-02-10T10:30:00Z",
  "customerName": "John Doe",
  "customerEmail": "john@example.com"
}
```

---

#### 2.3 PaymentOrderIdParamSchema
**Fungsi:** Validasi parameter orderId di URL

**Endpoint:** `GET /payments/:orderId`

**Field:**
- `orderId` (string) - Order ID payment

**Contoh URL:**
```
GET /payments/ORDER-20240210-001
```

---

#### 2.4 ListPaymentsQuerySchema
**Fungsi:** Validasi query parameter untuk list payments

**Endpoint:** `GET /payments`

**Field:**
| Field | Type | Default | Validasi | Deskripsi |
|-------|------|---------|----------|-----------|
| page | number | 1 | positive integer | Nomor halaman |
| limit | number | 10 | positive, max: 100 | Jumlah data per halaman |
| status | enum | - | PENDING/PAID/FAILED/EXPIRED | Filter berdasarkan status |

**Contoh Query:**
```
GET /payments?page=1&limit=20&status=PENDING
```

---

## 3. webhook.schema.ts

### Deskripsi
File ini berisi schema untuk webhook dari payment gateway eksternal (Midtrans, Xendit, dll). Menggunakan pendekatan gateway-agnostic untuk mendukung multiple payment gateway.

### Schema yang Tersedia

#### 3.1 WebhookRequestSchema
**Fungsi:** Schema generic untuk menerima webhook dari gateway manapun

**Karakteristik:**
- Menggunakan `.passthrough()` untuk menerima semua field
- Validasi spesifik didelegasikan ke implementasi gateway

**Endpoint:** `POST /webhooks/:gateway`

---

#### 3.2 WebhookResponseSchema
**Fungsi:** Format response standar setelah memproses webhook

**Struktur:**
```typescript
{
  success: boolean,         // Status keberhasilan pemrosesan
  message: string,          // Pesan hasil pemrosesan
  payment?: any,            // Detail payment yang diupdate (opsional)
  processedAt?: string      // Waktu pemrosesan (opsional)
}
```

**Contoh Response:**
```json
{
  "success": true,
  "message": "Webhook berhasil diproses",
  "payment": {
    "orderId": "ORDER-123",
    "status": "PAID"
  },
  "processedAt": "2024-02-10T10:35:00Z"
}
```

---

#### 3.3 WebhookGatewayParamSchema
**Fungsi:** Validasi parameter gateway di URL webhook

**Field:**
- `gateway` (enum) - Nama payment gateway: 'midtrans' | 'xendit'

**Contoh URL:**
```
POST /webhooks/midtrans
POST /webhooks/xendit
```

---

#### 3.4 MidtransWebhookSchema
**Fungsi:** Schema khusus untuk validasi webhook dari Midtrans

**Field Utama:**
| Field | Type | Required | Deskripsi |
|-------|------|----------|-----------|
| transaction_id | string | ✅ | ID transaksi dari Midtrans |
| order_id | string | ✅ | Order ID dari sistem kita |
| gross_amount | string | ✅ | Total pembayaran |
| payment_type | string | ✅ | Jenis pembayaran |
| transaction_time | string | ✅ | Waktu transaksi |
| transaction_status | string | ✅ | Status transaksi |
| fraud_status | string | ❌ | Status fraud detection |
| status_code | string | ✅ | Kode status HTTP |
| signature_key | string | ✅ | Signature untuk validasi |
| va_numbers | array | ❌ | Nomor VA (untuk bank transfer) |
| expiry_time | string | ❌ | Waktu kadaluarsa |
| settlement_time | string | ❌ | Waktu settlement |

**Contoh Webhook dari Midtrans:**
```json
{
  "transaction_id": "abc123",
  "order_id": "ORDER-20240210-001",
  "gross_amount": "150000.00",
  "payment_type": "bank_transfer",
  "transaction_time": "2024-02-10 10:30:00",
  "transaction_status": "settlement",
  "status_code": "200",
  "signature_key": "abc123def456...",
  "va_numbers": [
    {
      "bank": "bca",
      "va_number": "1234567890"
    }
  ]
}
```

---

## Flow Penggunaan Schemas

### 1. Create Payment Flow
```
Client Request
    ↓
CreatePaymentRequestSchema (validasi)
    ↓
Handler (proses payment)
    ↓
CreatePaymentResponseSchema (format response)
    ↓
SuccessResponseSchema (wrap response)
    ↓
Client Response
```

### 2. Webhook Flow
```
Payment Gateway (Midtrans)
    ↓
WebhookRequestSchema (terima payload)
    ↓
MidtransWebhookSchema (validasi spesifik)
    ↓
Handler (update payment status)
    ↓
WebhookResponseSchema (response ke gateway)
```

---

## Best Practices

### 1. Reusability
✅ **DO:** Import schema dari shared untuk reusability
```typescript
import { PaymentSchema, CustomerSchema } from './shared.schema';
```

❌ **DON'T:** Duplikasi schema di setiap file
```typescript
// Jangan buat CustomerSchema lagi di payment.schema.ts
```

### 2. Deskripsi
✅ **DO:** Tambahkan `.describe()` untuk dokumentasi
```typescript
orderId: z.string().describe('ID order unik dari sistem')
```

❌ **DON'T:** Schema tanpa deskripsi
```typescript
orderId: z.string()
```

### 3. Type Safety
✅ **DO:** Export type dari schema
```typescript
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
```

### 4. Gateway Agnostic
✅ **DO:** Buat schema generic untuk webhook
```typescript
WebhookRequestSchema = z.object({}).passthrough()
```

❌ **DON'T:** Hardcode untuk satu gateway saja

---

## Kesimpulan

Schemas adalah fondasi penting untuk:
1. ✅ **Validasi** - Memastikan data yang masuk/keluar sesuai format
2. ✅ **Type Safety** - TypeScript types otomatis dari schema
3. ✅ **Dokumentasi** - OpenAPI docs auto-generated
4. ✅ **Konsistensi** - Format response standar di seluruh API
5. ✅ **Scalability** - Mudah tambah gateway baru

**Prinsip:** Schema = Blueprint data, bukan proses!
