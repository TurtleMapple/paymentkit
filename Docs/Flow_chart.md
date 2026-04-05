# Visualisasi Flowchart Pembayaran (Standar Hostinger)

Visualisasi ini disusun mengikuti standar simbol flowchart internasional yang umum digunakan (Terminator, Proses, Keputusan, dan Input/Output) sesuai dengan [Panduan Hostinger](https://www.hostinger.com/id/tutorial/cara-membuat-flowchart).

## 1. Diagram Visual (ISO Standard Symbols)
![Standard Payment Flowchart](file:///C:/Users/fatur/.gemini/antigravity/brain/543ff839-a157-4b56-ba85-2d3d15caf541/standard_payment_flowchart_v2_1774176127552.png)

---

## 2. Struktur Alur (Top-to-Bottom)

Penyajian teks di bawah ini menggunakan notasi bentuk yang mewakili fungsi aslinya:
- `( ... )` : **Terminator** (Mulai/Selesai)
- `[ ... ]` : **Proses** (Tindakan/Langkah)
- `< ... >` : **Keputusan** (Percabangan/Validasi)
- `/ ... /` : **Input/Output** (Data masuk/keluar)

```text
               (   MULAI   )
                     │
                     ▼
        / Input: Data Pembayaran /
               (Amount, Name)
                     │
                     ▼
            [ API: Validasi ]
               (Zod Schema)
                     │
                     ▼
          < Apakah Data Valid? > ───────── TIDAK ────────┐
                     │                                   │
                     YA                                  ▼
                     │                        [ Return Error 400 ]
                     ▼                                   │
        [ Simpan PENDING ke DB ]                         │
                     │                                   │
                     ▼                                   │
        [ Publish ke RabbitMQ  ]                         │
                     │                                   │
                     ▼                                   │
        / Output: Reponse 201 / <────────────────────────┘
               (Order ID)
                     │
                     ▼
          [ Worker: Consume ]
               (Background)
                     │
                     ▼
          [ Call Midtrans API ]
               (Create Link)
                     │
                     ▼
          [ Update DB Status ]
               (Awaiting Pay)
                     │
                     ▼
        ( Menunggu Pembayaran )
                     │
                     ▼
        / Webhook dari Gateway /
              (Notification)
                     │
                     ▼
          < Signature Valid? > ─────────── TIDAK ────────┐
                     │                                   │
                     YA                                  ▼
                     │                        [ Reject Webhook ]
                     ▼                                   │
          [ Update Status PAID ]                         │
                     │                                   │
                     ▼                                   │
               (  SELESAI  ) <───────────────────────────┘
```

## Deskripsi Simbol yang Digunakan:
1.  **Terminator (Oval):** Menandakan awal (`MULAI`) dan akhir (`SELESAI`) serta titik tunggu (`Menunggu Pembayaran`).
2.  **Proses (Persegi Panjang):** Tindakan internal sistem seperti validasi, penyimpanan database, dan pengiriman event.
3.  **Keputusan (Belah Ketupat):** Titik logika di mana sistem mengecek validitas data atau tanda tangan webhook.
4.  **Input/Output (Jajar Genjang):** Langkah ketika sistem menerima data dari pengguna atau memberikan respons balik ke client.
