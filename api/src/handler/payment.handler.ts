import { Context } from "hono";
import { CreatePaymentInput, GetAllPaymentsQuery } from "../schemas/payment.schema";
import { mapPaymentToResponse } from "../utils/formatters/payment-response.formatter";
import { PaymentStatus } from "../domain/entities/paymentStatus";
import { v7 as uuidv7 } from 'uuid';
import { buildSuccessResponse, buildPaginatedResponse } from "../utils/api-response.util";
import { HttpStatus } from "../utils/http-status.util";

/**
 * PAYMENT HANDLER (Class-Based)
 * 
 * SOLID Principles:
 * - SRP: Fokus mengatur alur HTTP (Input -> Service -> Format -> Respon).
 * - DIP: Menerima PaymentService via Dependency Injection agar mudah di-test.
 * 
 * Clean Code:
 * - Tidak ada lagi try-catch (ditangani Global Error Middleware).
 */
export class PaymentHandler {
  
  // Dependency Injection: Service dimasukkan melalui constructor
  constructor(private readonly paymentService: any) {}

  /**
   * POST /payments
   * Creates a new payment and initiates async processing
   */
  createPayment = async (c: Context, input: CreatePaymentInput) => {
    const orderId = uuidv7();

    // Default gateway untuk saat ini diset ke 'midtrans' 
    // (Bisa dikonfigurasi melalui input schema jika diaktifkan)
    const payment = await this.paymentService.createPayment(
      orderId,
      input.amount,
      'midtrans',
      input.customer.customerName,    
      input.customer.customerEmail    
    );

    // Langsung mereturn Success Response, jika terjadi error seperti Order ID duplikat,
    // maka ia akan dilempar ke Global Error Handler menjadi 409 Conflict.
    return c.json(
      buildSuccessResponse(mapPaymentToResponse(payment), 'Payment created successfully'),
      HttpStatus.CREATED
    );
  }

  /**
   * GET /payments/:orderId
   * Retrieves specific payment details (polling endpoint)
   */
  getPaymentByOrderId = async (c: Context, orderId: string) => {
    const payment = await this.paymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      // Akan ditangkap middleware sebagai 404
      throw new Error('Payment not found'); 
    }

    return c.json(
      buildSuccessResponse(mapPaymentToResponse(payment), 'Payment retrieved successfully'),
      HttpStatus.OK
    );
  }

  /**
   * GET /payments
   * Retrieves all payments with pagination and optional filtering
   */
  getAllPayments = async (c: Context, query: GetAllPaymentsQuery) => {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const status = query.status as PaymentStatus | undefined;

    const { data, total } = await this.paymentService.getAllPayments({ page, limit, status });
    const mappedData = data.map(mapPaymentToResponse);

    return c.json(
      buildPaginatedResponse(mappedData, page, limit, total, 'Payments retrieved successfully'),
      HttpStatus.OK
    );
  }

  /**
   * POST /payments/:orderId/cancel
   * Cancels a pending payment
   */
  cancelPayment = async (c: Context, orderId: string) => {
    const payment = await this.paymentService.cancelPayment(orderId);

    return c.json(
      buildSuccessResponse(mapPaymentToResponse(payment), 'Payment cancelled successfully'),
      HttpStatus.OK
    );
  }

  /**
   * POST /payments/:orderId/expire
   * Manually expires a pending payment
   */
  expirePayment = async (c: Context, orderId: string) => {
    const payment = await this.paymentService.expirePayment(orderId);

    return c.json(
      buildSuccessResponse(mapPaymentToResponse(payment), 'Payment expired successfully'),
      HttpStatus.OK
    );
  }
}