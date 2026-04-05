import { Payment } from "../../domain/entities/paymentEntity";
import { PaymentResponse } from "../../schemas/payment.schema";

/**
 * Maps Payment entity to response DTO
 * Mapped tightly to PaymentResponse Zod schema inference
 * Reusable across multiple handlers
 */
export function mapPaymentToResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.getId(),
    orderId: payment.orderId,
    amount: payment.getAmount(),
    status: payment.getStatus(),
    paymentType: payment.paymentType,
    bank: payment.bank,
    vaNumber: payment.vaNumber,
    paymentLink: payment.paymentLink,
    expiredAt: payment.expiredAt,
    paidAt: payment.paidAt,
    gateway: payment.gateway,
    gatewayResponse: payment.gatewayResponse,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    deletedAt: payment.deletedAt,
    paymentLinkCreatedAt: payment.paymentLinkCreatedAt,
    paymentAttemptCount: payment.paymentAttemptCount,
    customerName: payment.customerName,
    customerEmail: payment.customerEmail,
  };
}
