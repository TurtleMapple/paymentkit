import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  ErrorResponseSchema, 
  SuccessResponseSchema, 
  PaginationSchema, 
  PaginatedResponseSchema 
} from '../shared.schema';

describe('Shared Schema - Unit & Gray Box Testing', () => {

  describe('ErrorResponseSchema', () => {
    describe('Red Flag Testing', () => {
      it('harus menolak jika "success" bernilai true (karena ini schema error)', () => {
        const invalidError = {
          success: true,
          error: 'SOME_ERROR'
        };
        expect(ErrorResponseSchema.safeParse(invalidError).success).toBe(false);
      });

      it('harus menolak jika field "error" (string) tidak ada', () => {
        const invalidError = {
          success: false,
          details: { code: 123 }
        };
        expect(ErrorResponseSchema.safeParse(invalidError).success).toBe(false);
      });
    });

    describe('Green Flag Testing', () => {
      it('harus menerima format error standar dengan details opsional', () => {
        const validError = {
          success: false,
          error: 'NOT_FOUND',
          details: 'Data tidak ditemukan di database'
        };
        expect(ErrorResponseSchema.safeParse(validError).success).toBe(true);
      });
    });
  });

  describe('SuccessResponseSchema (Factory)', () => {
    // Kita buat test schema sederhana untuk dimasukkan ke factory
    const TestDataSchema = z.object({ id: z.number(), name: z.string() });
    const WrappedSchema = SuccessResponseSchema(TestDataSchema);

    describe('Red Flag Testing', () => {
      it('harus menolak jika data di dalamnya tidak sesuai dengan schema yang diberikan', () => {
        const invalidData = {
          success: true,
          message: 'OK',
          data: { id: 'bukan-angka', name: 'Test' } // id harusnya number
        };
        expect(WrappedSchema.safeParse(invalidData).success).toBe(false);
      });
    });

    describe('Green Flag Testing', () => {
      it('harus berhasil membungkus data sesuai kontrak SuccessResponse', () => {
        const validData = {
          success: true,
          message: 'Data berhasil dimuat',
          data: { id: 1, name: 'Produk A' }
        };
        const result = WrappedSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('PaginationSchema', () => {
    describe('Red Flag Testing', () => {
      it('harus menolak jika ada field pagination yang kurang (page/limit/total)', () => {
        const partialPagination = { page: 1, limit: 10 }; // Kurang total
        expect(PaginationSchema.safeParse(partialPagination).success).toBe(false);
      });
    });

    describe('Green Flag Testing', () => {
      it('harus menerima metadata paginasi yang lengkap', () => {
        const validPagination = { page: 1, limit: 10, total: 100 };
        expect(PaginationSchema.safeParse(validPagination).success).toBe(true);
      });
    });
  });

  describe('PaginatedResponseSchema (Factory)', () => {
    const ItemSchema = z.object({ code: z.string() });
    const WrappedPaginated = PaginatedResponseSchema(ItemSchema);

    describe('Red Flag Testing', () => {
      it('harus menolak jika field "data" bukan merupakan array', () => {
        const invalidPaginated = {
          success: true,
          message: 'OK',
          data: { code: 'ABC' }, // Harusnya [ { code: 'ABC' } ]
          pagination: { page: 1, limit: 1, total: 1 }
        };
        expect(WrappedPaginated.safeParse(invalidPaginated).success).toBe(false);
      });
    });

    describe('Green Flag Testing', () => {
      it('harus berhasil memvalidasi struktur response lengkap dengan array data dan metadata pagination', () => {
        const validPaginated = {
          success: true,
          message: 'List items',
          data: [{ code: 'A1' }, { code: 'B2' }],
          pagination: { page: 1, limit: 10, total: 2 }
        };
        expect(WrappedPaginated.safeParse(validPaginated).success).toBe(true);
      });
    });
  });

});
