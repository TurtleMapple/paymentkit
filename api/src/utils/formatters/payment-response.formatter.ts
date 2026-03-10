import { Payment } from "../../domain/entities/paymentEntity";

/**
 * Maps Payment entity to response DTO
 * Reusable across multiple handlers
 */
export function mapPaymentToResponse(payment: Payment) {
  // Extract dari gatewayResponse jika ada
  const gatewayData = payment.gatewayResponse || {};

  return {
    id: payment.id,
    orderId: payment.orderId,
    amount: payment.amount,
    status: payment.status,
    paymentType: payment.paymentType || null,
    bank: payment.bank || null,
    vaNumber: payment.vaNumber || null,
    paymentLink: payment.paymentLink || null,
    expiredAt: payment.expiredAt?.toISOString() || null,
    paidAt: payment.paidAt?.toISOString() || null,
    gateway: payment.gateway,
    customerName: payment.customerName || null,
    customerEmail: payment.customerEmail || null,

    // Field tambahan dari Midtrans gatewayResponse
    paymentLinkId: gatewayData.payment_link_id || null,
    usageLimit: gatewayData.usage_limit || null,
    paymentAttemptCount: payment.paymentAttemptCount,

    midtransDirectUrl: gatewayData.payment_url || payment.paymentLink || null,

    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}
