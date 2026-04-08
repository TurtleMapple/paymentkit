import { IPaymentEventPublisher } from "../IPaymentEventPublisher";
import { PaymentStatus } from "../../entities/paymentStatus";
import { PaymentCreatedPublisher, PaymentUpdatedPublisher } from "./publisher";

/**
 * RabbitMQ Implementation of Payment Event Publisher
 * (DIP: Implementation of the abstraction)
 */
export class RabbitMQPaymentEventPublisher implements IPaymentEventPublisher {
  private createdPublisher = new PaymentCreatedPublisher();
  private updatedPublisher = new PaymentUpdatedPublisher();

  async publishPaymentCreated(orderId: string): Promise<void> {
    await this.createdPublisher.publish({ orderId });
  }

  async publishPaymentUpdated(orderId: string, status: PaymentStatus): Promise<void> {
    await this.updatedPublisher.publish({ orderId, status });
  }
}
