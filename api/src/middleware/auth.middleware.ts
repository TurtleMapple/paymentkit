import { Context, Next } from 'hono';
import { env } from '../config/env';
import { buildErrorResponse } from '../utils/api-response.util';
import { HttpStatus } from '../utils/http-status.util';

/**
 * API KEY AUTH MIDDLEWARE
 * 
 * Skenario Penggunaan:
 * Middleware ini bertugas sebagai "Satpam" di gerbang API kita. 
 * Endpoint rahasia hanya bisa diakses jika menyertakan header 'x-api-key'.
 * 
 * Manfaat:
 * - Proteksi akses ilegal dari publik.
 * - Sangat mudah digunakan di Scalar UI (cukup masukkan kode API_KEY dari .env).
 */
export const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header('x-api-key');

  // Validasi: Apakah API Key ada dan isinya cocok dengan yang diatur di .env?
  if (!apiKey || apiKey !== env.API_KEY) {
    return c.json(
      buildErrorResponse('Akses Ditolak', 'API Key tidak valid atau tidak ditemukan di header (x-api-key).'),
      HttpStatus.UNAUTHORIZED
    );
  }

  // Jika lolos, silakan lanjut ke proses berikutnya
  await next();
};
