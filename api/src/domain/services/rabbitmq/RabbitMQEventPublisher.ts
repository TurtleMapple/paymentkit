import { IPaymentEventPublisher } from "../IPaymentEventPublisher";
import { PaymentStatus } from "../../entities/paymentStatus";
import { publishPaymentCreated, publishPaymentUpdated } from "./publisher";

/**
 * RabbitMQ Implementation of Payment Event Publisher
 * (DIP: Implementation of the abstraction)
 */
export class RabbitMQPaymentEventPublisher implements IPaymentEventPublisher {
  async publishPaymentCreated(orderId: string): Promise<void> {
    await publishPaymentCreated(orderId);
  }

  async publishPaymentUpdated(orderId: string, status: PaymentStatus): Promise<void> {
    await publishPaymentUpdated(orderId, status);
  }
}
