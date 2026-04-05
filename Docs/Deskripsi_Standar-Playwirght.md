# Standar Penulisan Test Playwright (PaymentKit)

Dokumen ini menjelaskan standar dan praktik terbaik dalam penulisan *automated testing* menggunakan Playwright agar tes berjalan stabil dan mudah dipelihara.

## 1. Lokator (Locators)
Gunakan lokator yang berorientasi pada pengguna (*user-centric*) daripada struktur internal (CSS/XPath).

*   **Prioritas Utama**: Gunakan `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`.
    ```typescript
    // Baik (berdasarkan peran ARIA)
    await page.getByRole('button', { name: 'Add to Cart' }).click();

    // Kurang Baik (fragil terhadap perubahan CSS)
    await page.locator('.group button').first().click();
    ```
*   **Ketajaman (Strictness)**: Playwright bersifat *strict*. Jika sebuah lokator menemukan lebih dari satu elemen, tes akan gagal. Gunakan `exact: true` atau `level` untuk spesifikasi.
    ```typescript
    // Mengambil H1 yang tepat bertuliskan "PaymentKit"
    await page.getByRole('heading', { name: 'PaymentKit', exact: true });
    ```

## 2. Assertion (Web-First Assertions)
Gunakan `expect` yang mendukung *auto-retry*. Playwright akan menunggu hingga kondisi terpenuhi sebelum menyatakan gagal (default timeout 5 detik).

```typescript
await expect(page).toHaveURL(/#features/);
await expect(page.getByText('Berhasil menambah!')).toBeVisible();
```

## 3. Penanganan Transisi & Animasi
Gunakan `waitForTimeout` hanya jika benar-benar diperlukan (misal: menunggu *smooth scroll* selesai sebelum mengecek apakah elemen masuk ke *viewport*).

```typescript
await page.getByRole('button', { name: 'Mulai Sekarang' }).click();
await page.waitForTimeout(500); // Tunggu animasi scroll selesai
await expect(productsHeading).toBeInViewport();
```

## 4. Konfigurasi Server (playwright.config.ts)
Pastikan `baseURL` dan `webServer` selaras untuk menghindari error `EADDRINUSE`.

```typescript
webServer: {
  command: 'pnpm dev',
  url: 'http://localhost:3001',
  reuseExistingServer: !process.env.CI,
},
use: {
  baseURL: 'http://localhost:3001',
}
```

## 5. Isolasi Tes
Setiap tes harus bersifat independen. Gunakan `beforeEach` untuk menyetel status awal (misal: navigasi ke halaman utama).

---
*Referensi: [Playwright Best Practices](https://playwright.dev/docs/best-practices)*
