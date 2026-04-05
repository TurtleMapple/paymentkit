import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app';
import { initDatabase, orm } from '../config/db';
import { setupTopology } from '../domain/services/rabbitmq/topology';
import { closeRabbitMQConnection } from '../domain/services/rabbitmq/connection';
import { Payment } from '../domain/entities/paymentEntity';
import { env } from '../config/env';

describe('Big Bang Integration Test: Payment Flow', () => {
  beforeAll(async () => {
    try {
      // 1. Initialize Database with Test Config
      console.log('--- STARTING INTEGRATION TEST SETUP ---');
      const ormInstance = await initDatabase();
      console.log('Database initialized');
      
      // 2. Synchronize Schema (Replacing Migrations for Test Stability)
      const generator = ormInstance.getSchemaGenerator();
      await generator.refreshDatabase();
      console.log('Schema synchronized');
      
      // 3. Setup RabbitMQ Topology
      if (env.RABBITMQ_ENABLED) {
          await setupTopology();
          console.log('RabbitMQ setup completed');
      }
      console.log('--- SETUP FINISHED ---');
    } catch (err) {
      console.error('--- SETUP FAILED ---');
      console.error(err);
      throw err;
    }
  });

  afterAll(async () => {
    // Cleanup: Close connections
    if (orm) {
      await orm.close();
    }
    await closeRabbitMQConnection();
  });

  it('should process a payment from API to Database and RabbitMQ', async () => {
    const paymentData = {
      amount: 50000,
      customer: {
        customerName: 'Integration Test User',
        customerEmail: 'test@example.com',
        phone: '08123456789',
      },
    };

    // Act: Send POST request to /payments
    const res = await app.request('/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.API_KEY,
      },
      body: JSON.stringify(paymentData),
    });

    // Assert: Check HTTP Status
    expect(res.status).toBe(201);
    
    const body = await res.json();
    expect(body.data).toHaveProperty('orderId');
    expect(body.data.amount).toBe(paymentData.amount);
    expect(body.data.status).toBe('PENDING');

    // Assert: Check Database Persistence
    const em = orm.em.fork();
    const paymentInDb = await em.findOne(Payment, { orderId: body.data.orderId });
    
    expect(paymentInDb).not.toBeNull();
    expect(Number(paymentInDb?.getAmount())).toBe(paymentData.amount);
    expect(paymentInDb?.customerName).toBe(paymentData.customer.customerName);
    expect(paymentInDb?.customerEmail).toBe(paymentData.customer.customerEmail);
  });
});
