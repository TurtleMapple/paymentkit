import { z } from "zod";

// ===== BASE SCHEMAS (Reusable) =====
/**
 * Customer information schema
 * Reusable across multiple payment-related endpoints
 */
export const CustomerInfoSchema = z.object({
    customerName: z.string().min(1).max(128).describe('Nama Lengkap Customer'),
    customerEmail: z.string().email().max(128).describe('Alamat Email Customer'),
    phone: z.string().min(1).max(128).describe('Nomor Telepon Customer'),
})

// ===== TIPE TYPESCRIPT =====
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;