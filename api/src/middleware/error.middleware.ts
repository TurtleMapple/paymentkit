import { Context } from 'hono';
import { ZodError } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { buildErrorResponse } from '../utils/api-response.util';
import { HttpStatus } from '../utils/http-status.util';
import {
  BaseGatewayException,
  GatewayAuthException,
  GatewayValidationException,
  GatewayTimeoutException
} from '../domain/exceptions/gateway.exception';

/**
 * Global Error Handler Middleware
 * 
 * Tanggung Jawab (Single Responsibility):
 * - Menangkap semua exception yang ter-throw dari lapisan Handler atau Service.
 * - Menerjemahkan instance error spesifik (Zod, Hono HTTP) ke dalam standar HTTP Status yang benar.
 * - Memastikan seluruh error aplikasi menggunakan format persis seperti di `shared.schema.ts`.
 */
export const errorHandler = (err: Error, c: Context) => {
  // Selalu log error murni untuk kebutuhan debug (bisa diganti dengan logger library di masa depan)
  console.error('[Global Error Catch]:', err.name, err.message);

  // 1. Zod Validation Error (400 Bad Request)
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));

    return c.json(
      buildErrorResponse('Validation failed', formattedErrors),
      HttpStatus.BAD_REQUEST
    );
  }

  // 2. Hono HTTPException (Status dinamis sesuai error spesifik)
  // Cocok dipakai di Service jika butuh melempar status spesifik
  // contoh: throw new HTTPException(401, { message: 'Unauthorized' });
  if (err instanceof HTTPException) {
    return c.json(
      buildErrorResponse(err.message),
      err.status
    );
  }

  // 3. Custom Gateway Exceptions
  if (err instanceof BaseGatewayException) {
    if (err instanceof GatewayValidationException) {
      return c.json(buildErrorResponse('Validation failed at payment gateway', err.message), HttpStatus.BAD_REQUEST);
    }
    if (err instanceof GatewayAuthException) {
      return c.json(buildErrorResponse('Gateway authentication failed', err.message), HttpStatus.UNAUTHORIZED);
    }
    if (err instanceof GatewayTimeoutException) {
      return c.json(buildErrorResponse('Gateway timeout', err.message), HttpStatus.GATEWAY_TIMEOUT);
    }
    
    // Default BaseGatewayException
    return c.json(buildErrorResponse('Payment gateway error', err.message), HttpStatus.BAD_GATEWAY);
  }

  // 4. Klasifikasi Error Standar berdasarkan Pesan (Warisan dari pola webhook logic & payment conflict)
  // Cara kerjanya: String-matching ini bertindak sebagai jaring pengaman agar "Business Rules" 
  // yang dilempar dari Services tetap tertangkap status code-nya dengan baik.
  const msg = err.message.toLowerCase();

  // 3a. Conflict (409)
  if (msg.includes('order id already exists')) {
    return c.json(buildErrorResponse('Konflik Data', err.message), HttpStatus.CONFLICT);
  }

  // 3b. Not Found (404)
  if (msg.includes('payment not found') || msg.includes('not found')) {
    return c.json(buildErrorResponse('Data tidak ditemukan', err.message), HttpStatus.NOT_FOUND);
  }

  // 3c. Unauthorized / Signature Error (401)
  if (msg.includes('invalid signature') || msg.includes('signature') || msg.includes('token')) {
    return c.json(buildErrorResponse('Akses ditolak: Verifikasi gagal', err.message), HttpStatus.UNAUTHORIZED);
  }

  // 3d. Bad Request (400)
  if (msg.includes('invalid transition') || msg.includes('not supported') || msg.includes('invalid webhook') || msg.includes('required')) {
    return c.json(buildErrorResponse('Permintaan tidak valid', err.message), HttpStatus.BAD_REQUEST);
  }

  // 4. Default / Fallback: 500 Internal Server Error
  // Sembunyikan detail sensitif ke user jika berada di mode production
  const isDev = process.env.NODE_ENV !== 'production';
  return c.json(
    buildErrorResponse('Terjadi kesalahan pada server', isDev ? err.stack : undefined),
    HttpStatus.INTERNAL_SERVER_ERROR
  );
};
