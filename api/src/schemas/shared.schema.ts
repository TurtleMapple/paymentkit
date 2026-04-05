import { z, ZodType } from 'zod';

/**
 * Schema response error
 * Digunakan ketika request gagal validasi atau terjadi error
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false).describe('Status keberhasilan (selalu false untuk error)'),
  error: z.string().describe('Jenis error'),
  details: z.any().optional().describe('Detail error tambahan')
});

/**
 * Factory untuk schema response sukses
 * Membungkus response sukses dengan format standar
 * @param dataSchema - Zod schema untuk data response
 */
export const SuccessResponseSchema = <T>(dataSchema: ZodType<T>) =>
  z.object({
    success: z.literal(true).describe('Status keberhasilan (selalu true untuk sukses)'),
    data: dataSchema.describe('Data response'),
    message: z.string().describe('Pesan sukses')
  });

/**
 * Schema metadata pagination
 * Digunakan untuk metadata daftar data yang panjang
 */
export const PaginationSchema = z.object({
  page: z.number().describe('Halaman saat ini'),
  limit: z.number().describe('Jumlah per halaman'),
  total: z.number().describe('Total seluruh data'),
});

/**
 * Factory untuk schema response sukses dengan pagination
 * Membungkus daftar data dengan format standar { success, message, data, pagination }
 * @param dataSchema - Zod schema untuk elemen tunggal dalam array data
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true).describe('Status keberhasilan'),
    message: z.string().describe('Pesan sukses metadata pagination'),
    data: z.array(dataSchema).describe('Daftar data response'),
    pagination: PaginationSchema.describe('Metadata pagination'),
  });

// ===== TIPE TYPESCRIPT =====
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse<T> = {
  success: true;
  data: T;
  message: string;
};