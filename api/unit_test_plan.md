# Unit Test Plan: Domain Services

Dokumen ini merinci strategi pengujian unit untuk `PaymentService` dan `WebhookService` menggunakan pola **AAA (Arrange, Act, Assert)**, mencakup skenario **Happy Path** dan **Sad Path**, serta indikator keberhasilan/kegagalan (**Green & Red Flag**).

---

## 1. PaymentService Test Plan

### `createPayment()`
| Path | Scenario | Arrange (Persiapan) | Act (Eksekusi) | Assert (Verifikasi) | Flag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Happy** | Berhasil membuat payment baru | Mock `repo.findByOrderId` (null), Mock `repo.create` (success), Mock `publisher.publish` | Panggil `createPayment` dengan data valid | Cek `repo.create` dipanggil, `publisher` dipanggil, return objek Payment | 🟢 **Green** |
| **Sad** | Order ID sudah ada | Mock `repo.findByOrderId` (Return existing payment) | Panggil `createPayment` dengan Order ID yang sama | Harus melempar error "Order ID already exists", `repo.create` tidak boleh dipanggil | 🔴 **Red** |

### `updatePaymentStatus()`
| Path | Scenario | Arrange (Persiapan) | Act (Eksekusi) | Assert (Verifikasi) | Flag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Happy** | Berhasil update (PENDING -> PAID) | Mock `repo.findByOrderId` (Status PENDING), Mock `repo.updateStatus` | Panggil `updatePaymentStatus` ke PAID | `repo.updateStatus` dipanggil, `publisher` kirim event update | 🟢 **Green** |
| **Sad** | Transisi tidak valid (PAID -> PENDING) | Mock `repo.findByOrderId` (Status PAID) | Panggil `updatePaymentStatus` ke PENDING | Lempar error "Invalid transition", `repo.updateStatus` tidak dipanggil | 🔴 **Red** |
| **Sad** | Payment tidak ditemukan | Mock `repo.findByOrderId` (null) | Panggil `updatePaymentStatus` | Lempar error "Payment not found" | 🔴 **Red** |

---

## 2. WebhookService Test Plan

### `processWebhook()`
| Path | Scenario | Arrange (Persiapan) | Act (Eksekusi) | Assert (Verifikasi) | Flag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Happy** | Webhook valid & berhasil update | Mock `gateway.validateWebhook` (true), Mock `gateway.processWebhook` (data valid), Mock `paymentService.updatePaymentStatus` | Panggil `processWebhook` | `paymentService` dipanggil dengan status yang benar, return object Payment | 🟢 **Green** |
| **Sad** | Signature tidak valid | Mock `gateway.validateWebhook` (false) | Panggil `processWebhook` dengan signature salah | Harus melempar error "Invalid webhook", `paymentService` tidak boleh dipanggil | 🔴 **Red** |
| **Sad** | Data payload tidak lengkap | Mock `gateway.validateWebhook` (true), Mock `gateway.processWebhook` (throw error) | Panggil `processWebhook` dengan payload rusak | Tangkap error dari gateway, pastikan state tidak berubah | 🔴 **Red** |

---

## Kriteria Umum (Standard)
- **Arrange**: Selalu menggunakan Mocking untuk dependensi (Repository, Publisher, API Client).
- **Act**: Target pengujian hanya pada satu fungsi spesifik (Unit).
- **Assert**: Melakukan pengecekan pada return value, pemanggilan fungsi dependensi (Spy), dan error handling.
