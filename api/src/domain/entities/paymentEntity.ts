import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import { PaymentStatus } from './paymentStatus'
import { v7 as uuid } from 'uuid'

@Entity({ tableName: 'payments' })
export class Payment {
  @PrimaryKey({ type: 'uuid' })
  private id: string

  @Property({ type: 'string', length: 128, unique: true, fieldName: 'order_id' })
  readonly orderId: string

  @Property({ type: 'int' })
  private amount: number

  @Property({ type: 'string', length: 32, default: PaymentStatus.PENDING })
  private status: PaymentStatus = PaymentStatus.PENDING

  @Property({ type: 'string', length: 32, nullable: true, fieldName: 'payment_type' })
  paymentType?: string

  @Property({ type: 'string', length: 32, nullable: true })
  bank?: string

  @Property({ type: 'string', length: 64, nullable: true, fieldName: 'va_number' })
  vaNumber?: string

  @Property({ type: 'datetime', nullable: true, fieldName: 'expired_at' })
  expiredAt?: Date

  @Property({ type: 'datetime', nullable: true, fieldName: 'paid_at' })
  paidAt?: Date

  @Property({ type: 'string', length: 32, default: 'midtrans' })
  gateway: string

  @Property({ type: 'json', nullable: true, fieldName: 'gateway_response' })
  gatewayResponse?: any

  @Property({ type: 'datetime', fieldName: 'created_at' })
  createdAt = new Date()

  @Property({ type: 'datetime', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt = new Date()

  @Property({ type: 'datetime', nullable: true, fieldName: 'deleted_at' })
  deletedAt?: Date

  @Property({ type: 'string', length: 255, nullable: true, fieldName: 'payment_link' })
  paymentLink?: string

  @Property({ type: 'datetime', nullable: true, fieldName: 'payment_link_created_at' })
  paymentLinkCreatedAt?: Date

  @Property({ type: 'int', default: 0, fieldName: 'payment_attempt_count' })
  paymentAttemptCount: number = 0

  @Property({ type: 'string', length: 128, nullable: true, fieldName: 'customer_name' })
  customerName?: string
  
  @Property({ type: 'string', length: 128, nullable: true, fieldName: 'customer_email' })
  customerEmail?: string

  /**
   * Private Constructor (Gunakan Payment.create untuk inisialisasi awal)
   * MikroORM membutuhkan argumen opsional untuk instansiasi internal
   */
  constructor(orderId: string = '', amount: number = 0, gateway: string = 'midtrans') {
    this.id = uuid();
    this.orderId = orderId;
    this.amount = amount;
    this.gateway = gateway;
  }

  // ===== STATIC FACTORY METHOD (Ubiquitous Language) =====

  /**
   * Membuat pembayaran baru dengan validasi Invariant
   */
  public static create(orderId: string, amount: number, gateway: string = 'midtrans'): Payment {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    return new Payment(orderId, amount, gateway);
  }

  // ===== GETTERS (Encapsulated Access) =====

  public getId(): string { return this.id; }
  public getStatus(): PaymentStatus { return this.status; }
  public getAmount(): number { return this.amount; }

  // ===== DOMAIN ACTIONS (Rich Domain Model) =====

  /**
   * Logika transisi status internal (Guard clauses)
   */
  private transitionTo(nextStatus: PaymentStatus): void {
    if (this.status === nextStatus) return;

    // State machine definition
    const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.EXPIRED, PaymentStatus.CANCELLED],
      [PaymentStatus.PAID]: [PaymentStatus.REFUNDED],
      [PaymentStatus.FAILED]: [],
      [PaymentStatus.EXPIRED]: [],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.CANCELLED]: [],
    };


    const allowed = VALID_TRANSITIONS[this.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Invalid transition from ${this.status} to ${nextStatus}`);
    }

    this.status = nextStatus;
  }

  public complete(paidAt: Date = new Date(), gatewayResponse?: any): void {
    this.transitionTo(PaymentStatus.PAID);
    this.paidAt = paidAt;
    if (gatewayResponse) {
      this.gatewayResponse = gatewayResponse;
    }
  }

  public fail(reason?: any): void {
    this.transitionTo(PaymentStatus.FAILED);
    if (reason) {
      this.gatewayResponse = { ...(this.gatewayResponse || {}), failure_reason: reason };
    }
  }

  public expire(): void {
    this.transitionTo(PaymentStatus.EXPIRED);
  }

  public cancel(): void {
    this.transitionTo(PaymentStatus.CANCELLED);
  }

  public refund(gatewayResponse?: any): void {
    this.transitionTo(PaymentStatus.REFUNDED);
    if (gatewayResponse) {
      this.gatewayResponse = { ...(this.gatewayResponse || {}), refund_info: gatewayResponse };
    }
  }

  public updateGatewayMeta(data: { 
    type?: string, 
    bank?: string, 
    va?: string, 
    link?: string,
    expiredAt?: Date
  }): void {
    if (data.type) this.paymentType = data.type;
    if (data.bank) this.bank = data.bank;
    if (data.va) this.vaNumber = data.va;
    if (data.link) this.paymentLink = data.link;
    if (data.expiredAt) this.expiredAt = data.expiredAt;
  }

  public incrementAttempt(): void {
    this.paymentAttemptCount++;
  }

  public softDelete(): void {
    this.deletedAt = new Date();
  }
}