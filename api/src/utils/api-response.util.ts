import { ErrorResponse, SuccessResponse } from '../schemas/shared.schema';

/**
 * Membuat struktur *Success Response* standar
 * 
 * @param data Data utama yang akan dikembalikan
 * @param message Pesan sukses (Opsional, default: "Operation successful")
 */
export const buildSuccessResponse = <T>(data: T, message: string = 'Operation successful'): SuccessResponse<T> => ({
  success: true,
  message,
  data,
});

/**
 * Membuat struktur *Paginated Response* standar (untuk daftar/list yang panjang)
 * 
 * @param data Array data hasil per halaman
 * @param page Halaman aktif
 * @param limit Jumlah batasan data per halaman
 * @param total Total keseluruhan data di database
 * @param message Pesan sukses (Opsional)
 */
export const buildPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message: string = 'Data retrieved successfully'
) => ({
  success: true as const,
  message,
  data,
  pagination: {
    page,
    limit,
    total,
  },
});

/**
 * Membuat struktur *Error Response* standar
 * 
 * @param error Deskripsi singkat tipe atau pesan error
 * @param details (Opsional) Detail error seperti Stack Trace atau properti Zod validation error
 */
export const buildErrorResponse = (error: string, details?: any): ErrorResponse => ({
  success: false,
  error,
  ...(details !== undefined && { details }), // Hanya masukkan details jika ada valuenya
});
