# PaymentKit

Mini payment system dengan arsitektur event-driven menggunakan TypeScript, Hono, RabbitMQ, dan Midtrans.

---

## 📋 Project Overview

PaymentKit adalah prototype sistem payment gateway yang dibangun dengan pendekatan **event-driven architecture**. Sistem ini memisahkan proses penerimaan request pembayaran dengan proses pembuatan payment link, sehingga lebih scalable dan resilient.

### Konsep Utama

- **Asynchronous Processing**: API tidak langsung memproses payment, melainkan mengirim event ke message broker
- **Event-Driven**: Worker mendengarkan event dan memproses payment secara background
- **Separation of Concerns**: API, Worker, dan Frontend terpisah sebagai service independen
- **Multi-Repository**: Setiap service memiliki repository sendiri untuk kemudahan development

---

## 🛠️ Tech Stack

### Backend API
- **Runtime**: Node.js 20+
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: MySQL
- **ORM**: MikroORM
- **Message Broker**: RabbitMQ (amqplib)
- **Payment Gateway**: Midtrans (Sandbox)
- **Validation**: Zod
- **OpenAPI Generator**: @hono/zod-openapi
- **API Documentation UI**: Scalar

### Frontend Web
- **Framework**: Next.js (App Router)
- **UI Library**: React
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios

### Development Tools
- **Language**: TypeScript v5.8+
- **Package Manager**: pnpm
- **Dev Server**: 
  - `tsx` v4.7 - TypeScript execution (API)
  - Next.js dev server (Frontend)

### Infrastructure
- **Message Broker**: RabbitMQ (Native Windows installation)
- **Database**: MySQL Server
- **Payment Provider**: Midtrans Sandbox

---

## 📦 Key Dependencies Explained

### API Dependencies

| Package                      | Version | Purpose                                   |
|------------------------------|---------|-------------------------------------------|
| `hono`                       | ^4.11.9 | Lightweight HTTP framework untuk API      |
| `@hono/zod-openapi`          | ^1.2.1  | OpenAPI integration dengan Zod validation |
| `@mikro-orm/core`            | ^6.6.6  | ORM untuk database operations             |
| `@mikro-orm/mysql`           | ^6.6.6  | MySQL driver untuk MikroORM               |
| `amqplib`                    | ^0.10.9 | RabbitMQ client library                   |
| `midtrans-client`            | ^1.4.3  | Official Midtrans SDK                     |
| `zod`                        | ^4.3.6  | Runtime type validation                   |
| `uuid`                       | ^13.0.0 | Generate unique identifiers               |
| `@scalar/hono-api-reference` | ^0.9.40 | Interactive API documentation             |

### Frontend Dependencies

| Package       | Version | Purpose                           |
|---------------|---------|-----------------------------------|
| `next`        | 16.1.6  | React framework dengan App Router |
| `react`       | 19.2.3  | UI library                        |
| `tailwindcss` | ^4      | Utility-first CSS framework       |
| `axios`       | ^1.13.5 | HTTP client untuk API calls       |
| `ky`          | ^1.14.3 | Modern fetch wrapper              |

---

### Komponen Utama Sistem

Sistem terdiri dari tiga komponen utama:

#### 1. Frontend (Next.js)
- Menyediakan UI sederhana untuk membeli produk.
- Mengirim request pembuatan payment ke backend API.

#### 2. Backend API (Hono)
- Menerima request pembuatan payment dari frontend.
- Menyimpan data payment ke database.
- Mengirim event `payment.created` ke RabbitMQ.

#### 3. Worker (RabbitMQ Consumer)
- Mendengarkan event dari RabbitMQ.
- Memproses payment secara asynchronous.
- Menghasilkan payment link dari Midtrans Sandbox.
- Mengupdate status payment di database.

---

### Arsitektur Alur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAYMENT SYSTEM ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    HTTP Request     ┌─────────────────┐
│                 │ ──────────────────► │                 │
│  User/Browser   │                     │ Next.js Frontend│
│                 │ ◄────────────────── │                 │
└─────────────────┘    HTTP Response    └─────────────────┘
                                                 │
                                                 │ POST /payments
                                                 │ {amount, customer}
                                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        HONO API SERVER                              │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Routes    │  │  Handlers   │  │  Services   │  │ Repositories││
│  │ payment.ts  │─►│ payment.ts  │─►│ payment.ts  │─►│ payment.ts  ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│
│                                          │                          │
│                                          │ 1. Insert Payment       │
│                                          │ 2. Publish Event        │
└──────────────────────────────────────────┼─────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RABBITMQ MESSAGE BROKER                     │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  Publisher  │───►│  Exchange   │───►│    Queue    │             │
│  │             │    │ payment.ex  │    │payment.queue│             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                │                    │
│  Event: payment.created                        │                    │
│  Payload: {orderId, amount}                    │                    │
└────────────────────────────────────────────────┼───────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PAYMENT WORKER                               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Consumer   │  │   Gateway   │  │  Repository │                 │
│  │payment.ts   │─►│ Factory.ts  │─►│ payment.ts  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                           │                                         │
│                           │ 3. Consume Event                       │
│                           │ 4. Call Gateway API                    │
│                           │ 5. Update Payment                      │
└───────────────────────────┼─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PAYMENT GATEWAYS                               │
│                                                                     │
│  ┌─────────────────┐              ┌─────────────────┐              │
│  │ DummyGateway    │              │ MidtransGateway │              │
│  │ (Development)   │              │ (Production)    │              │
│  │                 │              │                 │              │
│  │ • Mock Data     │              │ • Real API      │              │
│  │ • Simple Auth   │              │ • SHA512 Auth   │              │
│  │ • Instant       │              │ • HTTP Calls    │              │
│  └─────────────────┘              └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MYSQL DATABASE                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PAYMENTS TABLE                           │   │
│  │                                                             │   │
│  │  • id (UUID)           • paymentLink (URL)                 │   │
│  │  • orderId (String)    • vaNumber (String)                 │   │
│  │  • amount (Number)     • expiredAt (DateTime)              │   │
│  │  • status (Enum)       • createdAt (DateTime)              │   │
│  │  • customerName        • updatedAt (DateTime)              │   │
│  │  • customerEmail       • gatewayResponse (JSON)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         WEBHOOK FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    Webhook POST     ┌─────────────────┐
│                 │ ──────────────────► │                 │
│ Payment Gateway │                     │  Webhook API    │
│ (Midtrans/Dummy)│                     │ /webhooks/:type │
│                 │ ◄────────────────── │                 │
└─────────────────┘    200 OK Response  └─────────────────┘
                                                 │
                                                 │ Validate & Process
                                                 ▼
                                        ┌─────────────────┐
                                        │ Update Payment  │
                                        │ Status in DB    │
                                        └─────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      STATUS FLOW DIAGRAM                            │
└─────────────────────────────────────────────────────────────────────┘

    PENDING ──────────────────────────────────────► PAID
       │                                              ▲
       │                                              │
       ├──────────────► FAILED                       │
       │                                              │
       └──────────────► EXPIRED ─────────────────────┘

• PENDING: Payment baru dibuat, menunggu worker
• PAID: Payment berhasil, customer sudah bayar
• FAILED: Payment gagal, error dari gateway
• EXPIRED: Payment kedaluwarsa, link tidak valid

┌─────────────────────────────────────────────────────────────────────┐
│                       TIMING BREAKDOWN                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐ ~100-200ms ┌─────────────┐ ~2-5 seconds ┌─────────────┐
│   Request   │ ─────────► │  API        │ ──────────► │  Payment    │
│   Payment   │            │  Response   │             │  Link Ready │
└─────────────┘            └─────────────┘             └─────────────┘
      │                           │                           │
      │                           │                           │
   User Click                API Returns                Worker Done
   "Pay Now"               PENDING Status              Link Generated
```

### Konsep Utama yang Digunakan

#### 1. Event-Driven Processing
API tidak memproses payment secara langsung.  
Sebagai gantinya, API hanya:

- Menyimpan data payment
- Mengirim event ke RabbitMQ

Worker yang akan memproses logika pembayaran.

#### 2. Separation of Concerns
Tanggung jawab dipisah dengan jelas:

- API → menerima request & publish event
- Worker → memproses payment
- Database → menyimpan state

#### 3. Asynchronous Workflow
Dengan RabbitMQ:

- API tidak perlu menunggu proses payment selesai
- Sistem lebih scalable
- Worker bisa ditambah jumlahnya jika beban meningkat

---

### Kenapa Menggunakan Arsitektur Ini?

Arsitektur ini dipilih karena:

- Meniru sistem pembayaran real-world
- Lebih scalable dibanding synchronous processing
- Memudahkan penambahan worker atau service baru
- Memisahkan logic API dan processing

---

## 📁 Project Structure

Project ini menggunakan struktur **multi-repository** dengan pemisahan antara **frontend**, **backend API**, **worker**, dan **shared logic**.

```
paymentkit/
├── api/ # Backend API Server (Hono)
│ ├── src/
│ │ ├── config/ # Konfigurasi environment & setup
│ │ ├── handlers/ # Request handlers / controllers
│ │ ├── middleware/ # Middleware (auth, validation, error)
│ │ ├── routes/ # API route definitions
│ │ ├── schemas/ # Zod validation schemas
│ │ ├── utils/ # Helper functions & utilities
│ │ ├── index.ts # Application entry point
│ │ └── server.ts # HTTP server setup
│ ├── .env # Environment variables
│ ├── .env.example # Environment template
│ ├── package.json
│ └── tsconfig.json
│
├── worker/ # Background Worker (RabbitMQ Consumer)
│ ├── consumers/
│ │ └── payment.consumer.ts # Payment event consumer
│ └── index.ts # Worker entry point
│
├── shared/ # Shared Logic & Infrastructure
│ ├── database/ # Database configuration & migrations
│ ├── domain/ # Domain layer
│ │ ├── entities/ # Database entities (MikroORM)
│ │ ├── repositories/ # Data access layer
│ │ └── services/ # Business logic services
│ ├── midtrans/ # Midtrans integration
│ │ └── midtrans.client.ts
│ └── rabbitmq/ # RabbitMQ integration
│ ├── channel.ts # Channel management
│ ├── connection.ts # Connection setup
│ ├── publisher.ts # Event publisher
│ └── topology.ts # Queue & exchange setup
│
├── web/ # Frontend (Next.js)
│ ├── app/ # App Router pages
│ │ ├── success/ # Payment success page
│ │ ├── layout.tsx # Root layout
│ │ └── page.tsx # Home page
│ ├── components/ # React components
│ ├── public/ # Static assets
│ ├── package.json
│ └── tsconfig.json
│
├── package.json # Root package.json (workspace)
└── README.md
```

## 🔄 Request / Event Flow (Step by Step)

Bagian ini menjelaskan alur proses pembayaran dari saat user menekan tombol bayar hingga payment diproses oleh worker.

Flow ini menggunakan pendekatan **asynchronous event-driven**, di mana API dan proses payment dipisahkan menggunakan RabbitMQ.

---

### Step 1 — User membuat payment dari UI
User membuka halaman frontend dan menekan tombol **"Buy / Pay"**.

Frontend akan mengirim request ke backend:
```http
POST /v1/payments
```

```json{
    "productId": "prod_001",
    "amount": 50000
}
```
### Step 2 — API menerima request
API (Hono) menerima request tersebut dan melakukan:
1. Validasi payload menggunakan Zod.
2. Menjalankan service createPayment.

### Step 3 — Service menyimpan data payment
Di dalam service:
1. Payment baru dibuat dengan status awal:
```json{
  "status": "pending"
}
```

2. Data payment disimpan ke database MySQL melalui repository.
Contoh data yang disimpan:
```json{
  "id": "pay_123",
  "product_id": "prod_001",
  "amount": 50000,
  "status": "pending"
}
```

### Step 4 — API publish event ke RabbitMQ
Setelah payment berhasil disimpan:
1. API mengirim event ke RabbitMQ:

```json
{
  "event": "payment.created"
}
```
2. Event dikirim melalui exchange ke queue worker.
Contoh payload event:
```json
{
  "paymentId": "pay_123",
  "amount": 50000
}
```

### Step 5 — API mengembalikan response ke client

API tidak menunggu proses payment selesai.  
API langsung merespons ke frontend:

```json
{
  "success": true,
  "data": {
    "id": "pay_123",
    "status": "pending",
    "message": "Payment is being processed"
  }
}
```

**Artinya:**
- Payment sudah tercatat di database
- Event sudah dikirim ke RabbitMQ
- Proses selanjutnya akan ditangani worker secara background
- User tidak perlu menunggu proses payment selesai

---

### Step 6 — Worker menerima event dari RabbitMQ

Worker yang berjalan sebagai background service:

1. Mendengarkan queue `payment.created`
2. Menerima event dari RabbitMQ
3. Parse payload event

Contoh event yang diterima:
```json
{
  "paymentId": "pay_123",
  "amount": 50000
}
```

---

### Step 7 — Worker memproses payment

Worker kemudian:

1. **Mengambil data payment dari database**
```json
{
  "id": "pay_123",
  "product_id": "prod_001",
  "amount": 50000,
  "status": "pending"
}
```

2. **Mengirim request ke Midtrans Sandbox**
3. **Menghasilkan payment link**

Contoh hasil dari Midtrans:
```
https://app.sandbox.midtrans.com/snap/v2/vtweb/abc123
```

---

### Step 8 — Worker update status payment

Setelah payment link berhasil dibuat:

1. Worker mengupdate data payment di database
2. Status berubah menjadi:

```json
{
  "id": "pay_123",
  "product_id": "prod_001",
  "amount": 50000,
  "status": "awaiting_payment",
  "payment_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/abc123",
  "updated_at": "2024-01-15T10:30:03Z"
}
```

3. Worker acknowledge message ke RabbitMQ (event selesai diproses)

---

### Timeline Proses

- **Step 1-5**: ~100-200ms (API response)
- **Step 6-8**: ~2-5 detik (Worker processing)
- **Total**: Payment link siap dalam 2-5 detik setelah user klik bayar

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3001/api
```

---

### 1. Create Payment

Membuat payment baru dan mengirim event ke worker untuk diproses.

**Endpoint:**
```http
POST /api/v1/payments
```

**Request Body:**
```json
{
  "productId": "prod_001",
  "amount": 50000,
  "customerName": "John Doe",
  "customerEmail": "john@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123",
    "productId": "prod_001",
    "amount": 50000,
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ]
  }
}
```

---

### 2. Get Payment Details

Mendapatkan detail payment berdasarkan ID.

**Endpoint:**
```http
GET /api/v1/payments/:id
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123",
    "productId": "prod_001",
    "amount": 50000,
    "status": "awaiting_payment",
    "paymentUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/abc123",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:15Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment with ID pay_abc123 not found"
  }
}
```

---

### 3. Midtrans Payment Callback

Webhook endpoint untuk menerima notifikasi dari Midtrans.

**Endpoint:**
```http
POST /api/v1/payments/callback
```

**Request Body (dari Midtrans):**
```json
{
  "transaction_status": "settlement",
  "order_id": "pay_abc123",
  "gross_amount": "50000.00",
  "payment_type": "bank_transfer",
  "transaction_time": "2024-01-15 10:35:00",
  "signature_key": "..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment status updated"
}
```

---

### 4. Get All Payments (Optional)

Mendapatkan list semua payments.

**Endpoint:**
```http
GET /api/v1/payments
```

**Query Parameters:**
- `status` (optional) - Filter by status: `pending`, `awaiting_payment`, `paid`, `failed`
- `limit` (optional) - Limit results (default: 10)
- `offset` (optional) - Offset for pagination (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "pay_abc123",
      "amount": 50000,
      "status": "paid",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "pay_def456",
      "amount": 75000,
      "status": "awaiting_payment",
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "limit": 10,
    "offset": 0
  }
}
```

---

### Payment Status Flow

```
pending → awaiting_payment → paid
   ↓              ↓            ↓
failed         expired      refunded
```

**Status Definitions:**
- `pending` - Payment baru dibuat, belum diproses
- `awaiting_payment` - Payment link sudah dibuat, menunggu user bayar
- `paid` - Payment berhasil
- `failed` - Payment gagal
- `expired` - Payment link expired
- `refunded` - Payment di-refund

---

### Error Codes

| Code                   | HTTP Status     | Description |
|------------------------|-----------------|-------------|
| `VALIDATION_ERROR`     | 400             | Request body tidak valid |
| `PAYMENT_NOT_FOUND`    | 404             | Payment tidak ditemukan |
| `PAYMENT_ALREADY_PAID` | 409             | Payment sudah dibayar |
| `MIDTRANS_ERROR`       | 500             | Error dari Midtrans |
| `INTERNAL_ERROR`       | 500             | Internal server error |

---

### API Documentation

Setelah API berjalan, akses dokumentasi interaktif di:

**Scalar UI:**
```
http://localhost:3001/docs
```

Dokumentasi ini di-generate otomatis dari Zod schemas menggunakan `@hono/zod-openapi`.

---

## ⚙️ Environment Variables

Untuk kemudahan development, gunakan **satu file `.env`** di root folder yang di-share oleh semua service.

### Setup Environment Variables

Buat file `.env` di **root folder** `paymentkit/` dengan konfigurasi berikut:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=paymentkit
DB_USER=root
DB_PASSWORD=

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EXCHANGE=payment.exchange
RABBITMQ_QUEUE=payment.created

# Midtrans Configuration
MIDTRANS_SERVER_KEY=your_server_key_here
MIDTRANS_CLIENT_KEY=your_client_key_here
MIDTRANS_IS_PRODUCTION=false

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### Penjelasan Environment Variables

**Server:**
- `PORT` - Port untuk API server (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

**Database:**
- `DB_HOST` - MySQL host
- `DB_PORT` - MySQL port (default: 3306)
- `DB_NAME` - Nama database
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password

**RabbitMQ:**
- `RABBITMQ_URL` - Connection URL ke RabbitMQ
- `RABBITMQ_EXCHANGE` - Nama exchange untuk routing messages
- `RABBITMQ_QUEUE` - Nama queue untuk payment events

**Midtrans:**
- `MIDTRANS_SERVER_KEY` - Server key dari Midtrans dashboard
- `MIDTRANS_CLIENT_KEY` - Client key dari Midtrans dashboard
- `MIDTRANS_IS_PRODUCTION` - Mode production (true/false)

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Base URL untuk API backend

---

### Load Environment Variables di Setiap Service

**API (api/src/config/env.ts):**
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load .env dari root folder
dotenv.config({ path: path.join(__dirname, '../../../.env') });
```

**Worker (worker/src/config/env.ts):**
```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load .env dari root folder
dotenv.config({ path: path.join(__dirname, '../../.env') });
```

**Frontend (web/.env.local):**

Untuk Next.js, buat symlink atau copy variable yang dibutuhkan:

```bash
# Windows (Command Prompt as Admin)
mklink web\.env.local .env

# Atau manual copy hanya variable NEXT_PUBLIC_*
echo NEXT_PUBLIC_API_URL=http://localhost:3001 > web\.env.local
```

---

### Struktur File Environment

```
paymentkit/
├── .env              # ✅ Satu file untuk semua service
├── .env.example      # Template untuk .env
├── .gitignore        # Pastikan .env masuk ignore
├── api/
├── worker/
└── web/
    └── .env.local    # Symlink atau copy dari root .env
```

---

### Cara Mendapatkan Midtrans Keys

1. **Daftar di Midtrans Sandbox:**
   - Kunjungi: https://dashboard.sandbox.midtrans.com/register
   - Buat akun baru

2. **Login ke Dashboard:**
   - Login di: https://dashboard.sandbox.midtrans.com/

3. **Ambil API Keys:**
   - Buka menu **Settings** → **Access Keys**
   - Copy **Server Key** dan **Client Key**
   - Paste ke file `.env` di root folder

---

### Security Notes

⚠️ **PENTING:**
- Jangan commit file `.env` ke Git
- Gunakan `.env.example` sebagai template
- Simpan credentials dengan aman
- Untuk production, gunakan environment variables dari hosting provider
- Pisahkan `.env` per service saat deploy ke production

---

## 🚀 Installation & Setup

### Prerequisites

Pastikan sudah terinstall:
- **Node.js** v18 atau lebih baru
- **pnpm** (package manager)
- **MySQL** Server
- **RabbitMQ** Server
- **Midtrans** Sandbox Account

---

### 1. Clone Repository

```bash
git clone <repository-url>
cd paymentkit
```

---

### 2. Setup Environment Variables

Buat file `.env` di root folder:

```bash
cp .env.example .env
```

Edit `.env` dan isi dengan konfigurasi Anda (lihat bagian [Environment Variables](#⚙️-environment-variables)).

---

### 3. Setup Database

Buat database MySQL:

```sql
CREATE DATABASE paymentkit;
```

---

### 4. Setup RabbitMQ (Windows)

#### Install Erlang
1. Download dari: https://www.erlang.org/downloads
2. Install dengan default settings
3. Verify: `erl -version`

#### Install RabbitMQ
1. Download dari: https://www.rabbitmq.com/install-windows.html
2. Install dengan default settings
3. Cek status: `rabbitmqctl status`

#### Enable Management Dashboard
```bash
rabbitmq-plugins enable rabbitmq_management
```

Dashboard: http://localhost:15672 (guest/guest)

---

### 5. Install Dependencies

**Install semua dependencies:**
```bash
# API
cd api
pnpm install
cd ..

# Worker
cd worker
pnpm install
cd ..

# Frontend
cd web
pnpm install
cd ..
```

---

### 6. Run Database Migrations

```bash
cd api
pnpm mikro-orm migration:up
cd ..
```

---

### 7. Run Services

**Terminal 1 - API:**
```bash
cd api
pnpm dev
```
API: http://localhost:3001

**Terminal 2 - Worker:**
```bash
cd worker
pnpm dev
```

**Terminal 3 - Frontend:**
```bash
cd web
pnpm dev
```
Frontend: http://localhost:3000

---

### 8. Verify Setup

1. **API**: Buka http://localhost:3001/docs
2. **RabbitMQ**: Buka http://localhost:15672
3. **Frontend**: Buka http://localhost:3000

---

## 🧪 Development

### Run API
```bash
cd api
pnpm dev
```

### Run Worker
```bash
cd worker
pnpm dev
```

### Run Frontend
```bash
cd web
pnpm dev
```

### Build for Production
```bash
# API
cd api
pnpm build
pnpm start

# Frontend
cd web
pnpm build
pnpm start
```

---
