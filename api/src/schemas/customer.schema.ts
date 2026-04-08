import { z } from "@hono/zod-openapi";

// ===== BASE SCHEMAS (Reusable) =====
/**
 * Customer information schema
 * Reusable across multiple payment-related endpoints
 */
export const CustomerInfoSchema = z.object({
    customerName: z.string().min(1).max(128).openapi({ 
        example: 'John Doe',
        description: 'Nama Lengkap Customer' 
    }),
    customerEmail: z.string().email().max(128).openapi({ 
        example: 'johndoe@example.com',
        description: 'Alamat Email Customer' 
    }),
    phone: z.string().min(1).max(128).openapi({ 
        example: '08123456789',
        description: 'Nomor Telepon Customer' 
    }),
})

// ===== TIPE TYPESCRIPT =====
export type CustomerInfo = z.infer<typeof CustomerInfoSchema>;