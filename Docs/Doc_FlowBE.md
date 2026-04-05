┌─────────────────────────────────────────────────────────────────────┐
│ FASE 1: CREATE PAYMENT │
└─────────────────────────────────────────────────────────────────────┘

[FRONTEND] ❌ Belum dibuat (Nanti dibuat terpisah)
│
▼
┌─────────────────────────────────────────────────────────────────────┐
│ POST /payments │
│ Headers: │
│ - Idempotency-Key: "unique-request-id" (REQUIRED) 🆕 │
│ │
│ Body: │
│ { │
│ "orderId": "ORDER-123", │
│ "amount": 100000, │
│ "customer": { │
│ "customerName": "John Doe", │
│ "customerEmail": "john@example.com" │
│ } │
│ } │
└─────────────────────────────────────────────────────────────────────┘
│
▼
[BACKEND - API] ✅ Sudah dibuat
│
├─► payment.routes.ts ✅ (Sudah dibuat)
│ └─► POST /payments endpoint
│
├─► payment.handler.ts ✅ (Sudah dibuat)
│ ├─► Validate request (Zod schema ✅)
│ ├─► Call PaymentService ✅
│ └─► Return response
│
├─► payment.service.ts ✅ (Sudah dibuat)
│ ├─► Check duplicate
│ ├─► Create payment
│ ├─► Publish to RabbitMQ
│ └─► State machine validation ✅
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► create(data)
│
▼
[DATABASE] ✅ Sudah ada
│
│ Table: payments
│ ┌──────────────────────────────────────┐
│ │ id: uuid │
│ │ orderId: "ORDER-123" │
│ │ amount: 100000 │
│ │ status: "PENDING" │
│ │ paymentLink: null │
│ │ vaNumber: null │
│ │ customerName: "John Doe" │
│ │ customerEmail: "john@example.com" │
│ └──────────────────────────────────────┘
│
▼
[RABBITMQ] ✅ Sudah ada (services)
│
│ ┌─────────────────────────────────────────────────────────────┐
│ │ RABBITMQ ARCHITECTURE │
│ │ │
│ │ Publisher → Channel → Exchange → Binding → Queue → Consumer│
│ │ ↓ (on error) │
│ │ DLQ │
│ └─────────────────────────────────────────────────────────────┘
│
├─► 1. CHANNEL (api/src/domain/services/rabbitmq/channel.ts) ✅
│ │ - Koneksi virtual di dalam TCP connection
│ │ - Semua operasi (publish, consume) melalui channel
│ │ - Singleton pattern dengan error handling
│ └─► getRabbitMQChannel()
│
├─► 2. PUBLISHER (api/src/domain/services/rabbitmq/publisher.ts) ✅
│ │ - Mengirim message ke Exchange (bukan langsung ke Queue!)
│ │ - Menggunakan routing key untuk filtering
│ ├─► publishToExchange(routingKey, message)
│ ├─► publishPaymentCreated(orderId)
│ ├─► publishPaymentUpdated(orderId, status)
│ └─► publishWebhookReceived(orderId, gateway)
│
├─► 3. EXCHANGE (api/src/domain/services/rabbitmq/topology.ts) ✅
│ │ - Router yang menerima message dari Publisher
│ │ - Routing ke Queue berdasarkan routing key & binding
│ │
│ ├─► payment.exchange (TYPE: TOPIC) ✅
│ │ │ - Pattern matching routing key
│ │ │ - Flexible routing (payment._, payment.created, dll)
│ │ └─► Routing keys:
│ │ ├─ payment.created
│ │ ├─ payment.updated
│ │ └─ payment.webhook
│ │
│ └─► payment.dlx (TYPE: FANOUT) ✅
│ │ - Dead Letter Exchange untuk error handling
│ │ - Broadcast ke semua queue (ignore routing key)
│ └─► Untuk message yang gagal diproses
│
├─► 4. BINDING (api/src/domain/services/rabbitmq/topology.ts) ✅
│ │ - Aturan yang menghubungkan Exchange dengan Queue
│ │ - Berdasarkan routing key pattern
│ │
│ ├─► payment.created → payment.created.queue
│ ├─► payment.updated → payment.updated.queue
│ ├─► payment.webhook → payment.webhook.queue
│ └─► payment.dlx → payment.dlq (fanout, no routing key)
│
├─► 5. QUEUE (api/src/domain/services/rabbitmq/topology.ts) ✅
│ │ - Buffer yang menyimpan message sampai Consumer ambil
│ │ - Durable: survive RabbitMQ restart
│ │ - Dead Letter Exchange: kirim ke DLX jika gagal
│ │
│ ├─► payment.created.queue (durable, with DLX)
│ ├─► payment.updated.queue (durable, with DLX)
│ ├─► payment.webhook.queue (durable, with DLX)
│ └─► payment.dlq (Dead Letter Queue)
│
└─► 6. CONSUMER (api/src/worker/consumers/payment.consumer.ts) ✅
│ - Membaca message dari Queue dan memproses
│ - Prefetch: 1 message at a time
│ - ACK: message berhasil → hapus dari queue
│ - NACK: message gagal → kirim ke DLQ
│
├─► startPaymentConsumer()
│ ├─ Declare exchange & queue
│ ├─ Bind queue to exchange
│ └─ Start consuming
│
├─► channel.consume(QUEUES.PAYMENT_CREATED, callback)
│ ├─ parseMessage(msg) → Parse JSON
│ ├─ processPayment(data) → Call gateway API
│ └─ channel.ack(msg) → Success
│
└─► Error Handling:
└─ channel.nack(msg, false, false) → Send to DLQ
│
│ ┌──────────────────────────────────────────────────────────┐
│ │ FLOW EXAMPLE: payment.created │
│ │ │
│ │ 1. publishPaymentCreated("ORDER-123") │
│ │ ↓ │
│ │ 2. channel.publish(payment.exchange, "payment.created") │
│ │ ↓ │
│ │ 3. Exchange routing berdasarkan "payment.created" │
│ │ ↓ │
│ │ 4. Binding match → payment.created.queue │
│ │ ↓ │
│ │ 5. Message masuk queue │
│ │ ↓ │
│ │ 6. Consumer ambil message │
│ │ ↓ │
│ │ 7. Process: Call Midtrans API, Update DB │
│ │ ↓ │
│ │ 8. ACK → Message dihapus dari queue ✅ │
│ │ │
│ │ Error Flow (Production Strategy): │
│ │ 7. Process failed (e.g. Midtrans RTO) │
│ │ ↓ │
│ │ 8. Retry 3x with Exponential Backoff 🆕 │
│ │ (5s, 30s, 5m) │
│ │ ↓ │
│ │ 9. Still failed → NACK → Send to DLX │
│ │ ↓ │
│ │ 10. DLX broadcast ke DLQ │
│ │ ↓ │
│ │ 11. Admin inspect DLQ / Automatic Alert ⚠️ │
│ └──────────────────────────────────────────────────────────┘
│
│ ┌──────────────────────────────────────────────────────────┐
│ │ EXCHANGE TYPES COMPARISON │
│ ├──────────┬─────────────────┬──────────────────────────┤
│ │ Type │ Routing │ Use Case │
│ ├──────────┼─────────────────┼──────────────────────────┤
│ │ TOPIC │ Pattern match │ Flexible routing │
│ │ │ (payment._) │ payment.exchange ✅ │
│ ├──────────┼─────────────────┼──────────────────────────┤
│ │ FANOUT │ Broadcast │ Error handling │
│ │ │ (ignore key) │ payment.dlx ✅ │
│ ├──────────┼─────────────────┼──────────────────────────┤
│ │ DIRECT │ Exact match │ Simple routing │
│ │ │ (1 key = 1 Q) │ Not used ❌ │
│ └──────────┴─────────────────┴──────────────────────────┘
│
▼
[BACKEND - Response ke Frontend] ✅ Sudah dibuat
│
│ Response (cepat! tidak tunggu gateway):
│ {
│ "id": "uuid",
│ "orderId": "ORDER-123",
│ "amount": 100000,
│ "status": "PENDING",
│ "paymentLink": null,
│ "vaNumber": null,
│ "createdAt": "2024-02-10T10:00:00Z"
│ }
│

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 2: WORKER PROCESS (Background) │
└─────────────────────────────────────────────────────────────────────┘

[WORKER] ✅ Sudah ada
│
│ payment.consumer.ts ✅
│ (api/src/worker/consumers/payment.consumer.ts)
│
│ ┌─────────────────────────────────────────────────────┐
│ │ CONSUMER FLOW │
│ │ │
│ │ 1. channel.consume(QUEUES.PAYMENT_CREATED, ...) │
│ │ ↓ │
│ │ 2. parseMessage(msg) → Parse JSON │
│ │ ↓ │
│ │ 3. processPayment(data) │
│ │ ├─ Find payment in DB │
│ │ ├─ Call gateway.createPayment() │
│ │ └─ Update payment in DB │
│ │ ↓ │
│ │ 4. channel.ack(msg) → Success ✅ │
│ │ │
│ │ Error: │
│ │ 4. channel.nack(msg) → Send to DLQ ⚠️ │
│ └─────────────────────────────────────────────────────┘
│
▼
│ Fetch payment dari DB
│ - orderId: "ORDER-123"
│
▼
[PAYMENT GATEWAY] ✅ Sudah ada
│
│ PaymentGatewayFactory.create('midtrans') ✅
│
│
└─► MidtransPaymentGateway.createPayment() ✅ NEW!
│ Call Midtrans API:
│ POST https://api.sandbox.midtrans.com/v1/payment-links
│ Headers:
│ - Authorization: Basic {base64(serverKey:)}
│ Body:
│ {
│ "transaction_details": {
│ "order_id": "ORDER-123",
│ "gross_amount": 100000
│ },
│ "customer_details": {
│ "first_name": "John Doe",
│ "email": "john@example.com"
│ },
│ "usage_limit": 1,
│ "expiry": { "duration": 24, "unit": "hours" }
│ }
│
│ Response:
│ - payment_url: "https://app.sandbox.midtrans.com/snap/v1/..."
│ - expiry_time: "2024-02-11T10:00:00Z"
│
▼
[DATABASE] ✅ Update payment
│
│ Table: payments
│ ┌──────────────────────────────────────┐
│ │ orderId: "ORDER-123" │
│ │ status: "PENDING" │
│ │ paymentLink: "https://app.sandbox..." │
│ │ expiredAt: "2024-02-11T10:00:00Z" │
│ │ gatewayResponse: {...} │
│ └──────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3: READ - GET PAYMENT BY ORDER ID │
└─────────────────────────────────────────────────────────────────────┘

[CLIENT/POSTMAN] Test API
│
│ GET /payments/ORDER-123
│
▼
[BACKEND - API] ✅ Sudah dibuat
│
├─► payment.routes.ts ✅
│ └─► GET /payments/:orderId
│
├─► payment.handler.ts ✅
│ └─► getPaymentByOrderId()
│
├─► payment.service.ts ✅
│ └─► getPaymentByOrderId()
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► findByOrderId(orderId)
│
▼
[BACKEND - Response] ✅ Sudah dibuat
│
│ Response:
│ {
│ "success": true,
│ "data": {
│ "orderId": "ORDER-123",
│ "status": "PENDING",
│ "amount": 100000,
│ "paymentLink": "https://app.sandbox.midtrans.com/snap/v1/...",
│ "vaNumber": "unique-va-number",
│ "bank": "bca",
│ "expiredAt": "2024-02-11T10:00:00Z"
│ }
│ }
│

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3A: READ - GET ALL PAYMENTS (LIST) │
└─────────────────────────────────────────────────────────────────────┘

[CLIENT/POSTMAN] Test API
│
│ GET /payments?page=1&limit=10&status=PENDING
│
▼
[BACKEND - API] ✅ Sudah dibuat
│
├─► payment.routes.ts ✅
│ └─► GET /payments (with query params)
│
├─► payment.handler.ts ✅
│ └─► getAllPayments()
│
├─► payment.service.ts ✅
│ └─► getAllPayments()
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► findAllWithCount({ page, limit, status })
│
▼
[BACKEND - Response] ✅ Sudah dibuat
│
│ Response:
│ {
│ "success": true,
│ "data": [
│ {
│ "orderId": "ORDER-123",
│ "amount": 100000,
│ "status": "PENDING",
│ "createdAt": "2024-02-10T10:00:00Z"
│ },
│ {
│ "orderId": "ORDER-124",
│ "amount": 200000,
│ "status": "PAID",
│ "createdAt": "2024-02-10T11:00:00Z"
│ }
│ ],
│ "pagination": {
│ "page": 1,
│ "limit": 10,
│ "total": 25
│ }
│ }
│

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3B: UPDATE - MANUAL UPDATE PAYMENT │
└─────────────────────────────────────────────────────────────────────┘

[CLIENT/POSTMAN] Test API
│
│ PUT /payments/ORDER-123
│ {
│ "status": "PAID",
│ "paidAt": "2024-02-10T15:00:00Z"
│ }
│
▼
[BACKEND - API] ❌ Belum dibuat
│
├─► payment.routes.ts ❌
│ └─► PUT /payments/:orderId
│
├─► payment.handler.ts ❌
│ └─► updatePayment()
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► update(orderId, data)
│
▼
[DATABASE] ✅ Update payment
│
│ Table: payments
│ ┌──────────────────────────────────────┐
│ │ orderId: "ORDER-123" │
│ │ status: "PAID" ← Updated! │
│ │ paidAt: "2024-02-10T15:00:00Z" │
│ └──────────────────────────────────────┘
│
▼
[BACKEND - Response] ❌ Belum dibuat
│
│ Response:
│ {
│ "success": true,
│ "data": {
│ "orderId": "ORDER-123",
│ "status": "PAID",
│ "paidAt": "2024-02-10T15:00:00Z"
│ },
│ "message": "Payment updated successfully"
│ }

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 3C: DELETE - SOFT DELETE PAYMENT │
└─────────────────────────────────────────────────────────────────────┘

[CLIENT/POSTMAN] Test API
│
│ DELETE /payments/ORDER-123
│
▼
[BACKEND - API] ❌ Belum dibuat
│
├─► payment.routes.ts ❌
│ └─► DELETE /payments/:orderId
│
├─► payment.handler.ts ❌
│ └─► deletePayment()
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► softDelete(orderId)
│
▼
[DATABASE] ✅ Soft delete payment
│
│ Table: payments
│ ┌──────────────────────────────────────┐
│ │ orderId: "ORDER-123" │
│ │ deletedAt: "2024-02-10T16:00:00Z" │
│ │ ← Marked as deleted │
│ └──────────────────────────────────────┘
│
▼
[BACKEND - Response] ❌ Belum dibuat
│
│ Response:
│ {
│ "success": true,
│ "message": "Payment deleted successfully"
│ }

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 4: CUSTOMER BAYAR (External) │
└─────────────────────────────────────────────────────────────────────┘

[CUSTOMER]
│
│ Klik "Bayar Sekarang"
│ Redirect ke: https://app.sandbox.midtrans.com/snap/v1/...
│
▼
[PAYMENT GATEWAY] (Midtrans)
│
│ Customer melakukan pembayaran
│ - Atau metode lain (QRIS, E-wallet, dll)
│
▼
│ Payment berhasil!

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 5: WEBHOOK (Gateway → Backend) ✅ │
└─────────────────────────────────────────────────────────────────────┘

[PAYMENT GATEWAY] (Dummy/Midtrans)
│
│ Kirim webhook notification:
│ POST /webhooks/midtrans
│ Headers:
│ - x-midtrans-signature: "midtrans-signature-123"
│ Body:
│ {
│ "orderId": "ORDER-123",
│ "status": "paid",
│ "paymentType": "bank_transfer",
│ "paidAt": "2024-02-10T15:30:00Z"
│ }
│
▼
[BACKEND - API] ✅ Sudah dibuat
│
├─► webhook.routes.ts ✅ (Sudah dibuat)
│ └─► POST /webhooks/:gateway
│ ├─► Supported: midtrans
│ └─► OpenAPI documented (200, 400, 401, 404, 500)
│
├─► webhook.handler.ts ✅ (Sudah dibuat)
│ ├─► Extract signature from headers ✅
│ │ └─► Check: x-signature, x-midtrans-signature, x-callback-token
│ ├─► Get gateway instance (Factory) ✅
│ ├─► Validate webhook ✅
│ │ └─► gateway.validateWebhook(body, signature)
│ │ ├─► Check required fields (orderId, status) ✅
│ │ └─► Verify signature ✅
│ ├─► Process webhook ✅
│ │ └─► gateway.processWebhook(body)
│ │ └─► Transform to internal format
│ └─► Update payment status ✅
│
├─► webhook.schema.ts ✅ (Sudah dibuat)
│ ├─► WebhookGatewayParamSchema ✅
│ ├─► WebhookRequestSchema ✅
│ ├─► WebhookResponseSchema ✅
│ └─► MidtransWebhookSchema ✅
│
│
├─► MidtransPaymentGateway.ts ✅ NEW!
│ ├─► validateWebhook(payload, signature) ✅
│ │ ├─► Extract: order_id, status_code, gross_amount
│ │ ├─► Generate SHA512 hash
│ │ │ └─► Hash = SHA512(order_id + status_code + gross_amount + serverKey)
│ │ └─► Compare hash === signature
│ └─► processWebhook(payload) ✅
│ └─► Map status: settlement→PAID, pending→PENDING,
│ deny→FAILED, expire→EXPIRED
│
├─► payment.service.ts ✅ (Sudah dibuat)
│ └─► updatePaymentStatus() ✅
│ ├─► Check payment exists (404 if not found) ✅
│ ├─► Idempotency check (skip if final state) ✅
│ ├─► State machine validation ✅
│ │ └─► validateTransition(current, next)
│ │ ├─► PENDING → PAID/FAILED/EXPIRED ✅
│ │ ├─► PAID/FAILED/EXPIRED → same (idempotent) ✅
│ │ └─► Invalid transitions blocked ✅
│ └─► Update payment di DB ✅
│
├─► payment.repository.ts ✅ (Sudah dibuat)
│ └─► updateStatus(orderId, status, data)
│
▼
[DATABASE] ✅ Update payment
│
│ Table: payments
│ ┌──────────────────────────────────────┐
│ │ orderId: "ORDER-123" │
│ │ status: "PAID" ← Updated! │
│ │ paidAt: "2024-02-10T15:30:00Z" │
│ │ paymentType: "bank_transfer" │
│ │ gatewayResponse: {...} │
│ └──────────────────────────────────────┘
│
▼
[BACKEND - Response ke Gateway] ✅ Sudah dibuat
│
│ Response 200 OK:
│ {
│ "success": true,
│ "message": "Webhook processed successfully for order ORDER-123",
│ "payment": {
│ "orderId": "ORDER-123",
│ "status": "PAID"
│ },
│ "processedAt": "2024-02-10T15:30:01Z"
│ }
│
│ Error Responses:
│ - 400: Invalid webhook data / Invalid transition
│ - 401: Missing or invalid signature
│ - 404: Payment not found
│ - 500: Internal server error
│
│
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 5A: RECONCILIATION / SYNC (Inquiry) 🆕 │
│ (Background Job - Every 15m) │
│ Mencegah Webhook yang Terlewat │
└─────────────────────────────────────────────────────────────────────┘
│
[CRON JOB / WORKER]
│
├─► Step 1: Ambil transaksi status "PENDING" dari DB
│ └─► SELECT \* FROM payments WHERE status = 'PENDING'
│ AND createdAt < (NOW - 15 minutes)
│
├─► Step 2: Loop & Call Gateway Inquiry API
│ └─► Midtrans.transaction.status(orderId)
│
├─► Step 3: Bandingkan Status
│ ├─► Masih PENDING? → Lewati.
│ ├─► Sudah SETTLEMENT/PAID? → Update status di DB ✅
│ └─► Sudah EXPIRED/FAILED? → Update status di DB ❌
│
└─► Step 4: Update Audit Trail
└─► Log: "Status synced via Reconciliation Job"

┌─────────────────────────────────────────────────────────────────────┐
│ FASE 6: FRONTEND POLLING (Deteksi PAID) │
└─────────────────────────────────────────────────────────────────────┘

[FRONTEND] ❌ Belum dibuat
│
│ Masih polling GET /payments/ORDER-123
│
▼
[BACKEND - Response]
│
│ Response:
│ {
│ "success": true,
│ "data": {
│ "orderId": "ORDER-123",
│ "status": "PAID", ← Status berubah!
│ "paidAt": "2024-02-10T15:30:00Z"
│ }
│ }
│
▼
[FRONTEND] ❌ Belum dibuat
│
│ Tampilkan success:
│ ┌──────────────────────────────────────┐
│ │ 🎉 Pembayaran Berhasil! │
│ │ │
│ │ Order ID: ORDER-123 │
│ │ Amount: Rp 100.000 │
│ │ Status: PAID │
│ │ │
│ │ Dibayar pada: │
│ │ 2024-02-10 15:30:00 │
│ │ │
│ │ [Lihat Detail] [Kembali] │
│ └──────────────────────────────────────────────────────────┘
│
│
┌─────────────────────────────────────────────────────────────────────┐
│ FASE 7: AUDIT TRAIL & LOGGING 🆕 │
└─────────────────────────────────────────────────────────────────────┘
│
│ Setiap perubahan status dicatat di tabel: payment_logs
│
│ ┌─────────────────────────────────────────────────────────────┐
│ │ Example Log Entry: │
│ ├──────────┬──────────┬─────────────┬─────────────────────────┤
│ │ OrderId │ Status │ Source │ Notes │
│ ├──────────┼──────────┼─────────────┼─────────────────────────┤
│ │ ORD-123 │ PENDING │ API │ Initial creation │
│ │ ORD-123 │ PAID │ WEBHOOK │ Midtrans settlement ok │
│ │ ORD-124 │ PAID │ RECONCILE │ Sync via Inquiry API │
│ │ ORD-125 │ FAILED │ SYSTEM │ Expired by timer │
│ └──────────┴──────────┴─────────────┴─────────────────────────┘
│
│ Manfaat:
│ 1. Traceability untuk dispute customer
│ 2. Debugging jika ada anomali status
│ 3. Compliance & Reporting
┌─────────────────────────────────────────────────────────────────────┐
│ SUMMARY IMPLEMENTASI │
└─────────────────────────────────────────────────────────────────────┘

✅ FASE 1: CREATE PAYMENT - COMPLETE

- POST /payments endpoint
- Validation, service, repository
- RabbitMQ integration

✅ FASE 2: WORKER PROCESS - COMPLETE

- payment.consumer.ts
- Gateway integration:
  ✅ MidtransPaymentGateway (production) NEW!
- Payment link generation via Midtrans API

✅ FASE 3: GET PAYMENT BY ORDER ID - COMPLETE

- GET /payments/:orderId endpoint
- Response with payment details

✅ FASE 3A: GET ALL PAYMENTS - COMPLETE

- GET /payments endpoint
- Pagination & filtering support

❌ FASE 3B: UPDATE PAYMENT - NOT IMPLEMENTED

- PUT /payments/:orderId endpoint
- Manual update handler

❌ FASE 3C: DELETE PAYMENT - NOT IMPLEMENTED

- DELETE /payments/:orderId endpoint
- Soft delete handler

❌ FASE 1A: IDEMPOTENCY - NOT IMPLEMENTED 🆕

- Check Idempotency-Key header
- Store request hash in Redis/DB

❌ FASE 2A: RETRY STRATEGY - NOT IMPLEMENTED 🆕

- Exponential backoff in Consumer
- Retry count tracking

✅ FASE 4: CUSTOMER BAYAR - EXTERNAL

- Customer interaction with gateway
- Not part of backend implementation

✅ FASE 5: WEBHOOK - COMPLETE ✅

- POST /webhooks/:gateway endpoint
- Supported gateways:
  ✅ midtrans (SHA512 signature) NEW!
- Signature validation (401)
- Payload validation (400)
- Payment exists check (404)
- Idempotency check
- State machine validation (FSM)
- Error handling (400, 401, 404, 500)
- SOLID principles (10/10)

❌ FASE 5A: RECONCILIATION - NOT IMPLEMENTED 🆕

- Cron job for status sync
- Midtrans Inquiry API integration

❌ FASE 7: AUDIT TRAIL - NOT IMPLEMENTED 🆕

- payment_logs table
- Status change interceptor/hook

❌ FASE 6: FRONTEND - NOT IMPLEMENTED

- Frontend polling
- UI for payment status

┌─────────────────────────────────────────────────────────────────────┐
│ GATEWAY COMPARISON │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┬─────────────────────────────┐
│ Feature │ MidtransGateway │
├──────────────┼─────────────────────────────┤
│ Purpose │ Production │
│ API Call │ Yes (real API) │
│ Payment Link │ Real Midtrans URL │
│ Signature │ SHA512 verification │
│ Status Map │ 7 statuses │
│ Environment │ Sandbox/Production │
│ Config │ MIDTRANS_SERVER_KEY required│
└──────────────┴─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ENVIRONMENT VARIABLES │
└─────────────────────────────────────────────────────────────────────┘

Required for Midtrans:

```env
MIDTRANS_SERVER_KEY=your-server-key-here
MIDTRANS_BASE_URL=https://api.sandbox.midtrans.com
```

Production:

```env
MIDTRANS_BASE_URL=https://api.midtrans.com
```
