import { Entity, PrimaryKey, Property } from '@mikro-orm/core'
import { PaymentStatus } from './paymentStatus'
import { v7 as uuid } from 'uuid'

@Entity({ tableName: 'payments' })
export class Payment {
  @PrimaryKey({ type: 'uuid' })
  id!: string

  @Property({ type: 'string', length: 64, unique: true, fieldName: 'order_id' })
  orderId!: string

  @Property({ type: 'int' })
  // amazonq-ignore-next-line
  // amazonq-ignore-next-line
  amount!: number

  @Property({ type: 'string', length: 32, default: PaymentStatus.PENDING })
  status!: PaymentStatus

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
  gateway!: string

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
  paymentAttemptCount!: number

  @Property({ type: 'string', length: 128, nullable: true, fieldName: 'customer_name' })
  customerName?: string
  
  @Property({ type: 'string', length: 128, nullable: true, fieldName: 'customer_email' })
  customerEmail?: string

  constructor() {
    this.id = uuid()
  }  
}