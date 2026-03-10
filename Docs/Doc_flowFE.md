# MVVM Architecture - Payment Gateway Frontend

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Folder Structure](#folder-structure)
4. [Layer Responsibilities](#layer-responsibilities)
5. [Data Flow](#data-flow)
6. [Implementation Examples](#implementation-examples)
7. [Tech Stack](#tech-stack)

---

## 🎯 Overview

Project ini menggunakan **MVVM (Model-View-ViewModel)** pattern untuk memisahkan:
- **Business logic** dari UI
- **Data management** dari presentation
- **API calls** dari component logic

### Why MVVM?
- ✅ **Separation of Concerns** - Setiap layer punya tanggung jawab jelas
- ✅ **Testability** - ViewModel bisa di-test tanpa UI
- ✅ **Reusability** - ViewModel bisa dipakai di multiple views
- ✅ **Maintainability** - Mudah maintain dan extend

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         VIEW LAYER                          │
│  (React Components - UI Only, No Business Logic)            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ CreatePayment│  │ PaymentList  │  │ PaymentDetail│     │
│  │   Page.tsx   │  │   Page.tsx   │  │   Page.tsx   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ useViewModel()   │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      VIEWMODEL LAYER                         │
│  (Business Logic, State Management, API Orchestration)       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │CreatePayment │  │ PaymentList  │  │ PaymentDetail│     │
│  │ViewModel.ts  │  │ ViewModel.ts │  │ ViewModel.ts │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ uses Model       │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                        MODEL LAYER                           │
│  (Data Models, API Services, Business Entities)              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Payment    │  │ PaymentAPI   │  │  Validators  │     │
│  │   Model.ts   │  │  Service.ts  │  │  Utils.ts    │     │
│  └──────────────┘  └──────┬───────┘  └──────────────┘     │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   BACKEND API   │
                    │ (Hono + RabbitMQ)│
                    └─────────────────┘
```

---

## 📁 Folder Structure

```
web/
├── src/
│   ├── models/                    # MODEL LAYER
│   │   ├── entities/              # Data entities
│   │   │   ├── Payment.ts         # Payment entity
│   │   │   └── PaymentStatus.ts   # Payment status enum
│   │   └── services/              # API services
│   │       └── PaymentService.ts  # Payment API calls
│   │
│   ├── viewmodels/                # VIEWMODEL LAYER
│   │   ├── CreatePaymentViewModel.ts
│   │   ├── PaymentListViewModel.ts
│   │   └── PaymentDetailViewModel.ts
│   │
│   ├── views/                     # VIEW LAYER
│   │   ├── pages/
│   │   │   ├── CreatePaymentPage.tsx
│   │   │   ├── PaymentListPage.tsx
│   │   │   └── PaymentDetailPage.tsx
│   │   └── components/            # Reusable UI components
│   │       ├── PaymentCard.tsx
│   │       ├── PaymentForm.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── hooks/                     # Custom React hooks
│   │   └── useViewModel.ts        # Hook to connect View with ViewModel
│   │
│   └── utils/                     # Utilities
│       ├── formatters.ts          # Format currency, date, etc
│       └── validators.ts          # Input validation
│
└── docs/
    └── Doc_flowFE.md              # This file
```

---

## 🎯 Layer Responsibilities

### 1️⃣ **MODEL Layer** (Data & Business Logic)

**Responsibilities:**
- Define data structures (entities)
- Handle API communication
- Manage data persistence
- Business rules validation

**Example:**
```typescript
// models/entities/Payment.ts
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  paymentLink?: string;
  createdAt: string;
}

// models/services/PaymentService.ts
export class PaymentService {
  private baseUrl = 'http://localhost:3000';

  async createPayment(data: CreatePaymentRequest): Promise<Payment> {
    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error('Failed to create payment');
    
    const result = await response.json();
    return result.data;
  }

  async getPayment(orderId: string): Promise<Payment> {
    const response = await fetch(`${this.baseUrl}/payments/${orderId}`);
    if (!response.ok) throw new Error('Payment not found');
    
    const result = await response.json();
    return result.data;
  }
}
```

---

### 2️⃣ **VIEWMODEL Layer** (Presentation Logic)

**Responsibilities:**
- Manage UI state
- Handle user interactions
- Orchestrate API calls
- Transform data for display
- Handle loading/error states

**Example:**
```typescript
// viewmodels/CreatePaymentViewModel.ts
import { makeAutoObservable } from 'mobx';
import { PaymentService } from '../models/services/PaymentService';

export class CreatePaymentViewModel {
  isLoading = false;
  error: string | null = null;
  payment: Payment | null = null;

  private paymentService = new PaymentService();

  constructor() {
    makeAutoObservable(this);
  }

  async createPayment(orderId: string, amount: number, customer: Customer) {
    this.isLoading = true;
    this.error = null;
    
    try {
      this.payment = await this.paymentService.createPayment({
        orderId,
        amount,
        customer,
      });
      return this.payment;
    } catch (error: any) {
      this.error = error.message;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  reset() {
    this.isLoading = false;
    this.error = null;
    this.payment = null;
  }
}
```

---

### 3️⃣ **VIEW Layer** (UI Components)

**Responsibilities:**
- Render UI
- Handle user input
- Display data from ViewModel
- NO business logic
- NO API calls

**Example:**
```typescript
// views/pages/CreatePaymentPage.tsx
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePaymentViewModel } from '../../viewmodels/CreatePaymentViewModel';

export const CreatePaymentPage = observer(() => {
  const [viewModel] = useState(() => new CreatePaymentViewModel());
  const navigate = useNavigate();

  const handleSubmit = async (data: FormData) => {
    try {
      await viewModel.createPayment(data.orderId, data.amount, data.customer);
      navigate(`/payments/${data.orderId}`);
    } catch (error) {
      // Error handled by ViewModel
    }
  };

  return (
    <div className="container">
      <h1>Create Payment</h1>
      
      {viewModel.isLoading && <Spinner />}
      {viewModel.error && <ErrorAlert message={viewModel.error} />}
      
      <PaymentForm onSubmit={handleSubmit} />
    </div>
  );
});
```

---

## 🔄 Data Flow

### **Create Payment Flow:**

```
1. USER ACTION
   User fills form & clicks "Create Payment"
   ↓
2. VIEW (CreatePaymentPage.tsx)
   - Validates input
   - Calls viewModel.createPayment()
   ↓
3. VIEWMODEL (CreatePaymentViewModel.ts)
   - Sets isLoading = true
   - Calls PaymentService.createPayment()
   ↓
4. MODEL (PaymentService.ts)
   - POST /api/payments
   - Returns Payment data
   ↓
5. VIEWMODEL
   - Updates state with payment data
   - Sets isLoading = false
   ↓
6. VIEW
   - Re-renders with new data
   - Shows success message
   - Redirects to payment detail
```

### **Polling Payment Status Flow:**

```
1. VIEW (PaymentDetailPage.tsx)
   - Component mounts
   - Calls viewModel.startPolling()
   ↓
2. VIEWMODEL (PaymentDetailViewModel.ts)
   - Starts interval timer (every 3 seconds)
   - Calls PaymentService.getPayment()
   ↓
3. MODEL (PaymentService.ts)
   - GET /api/payments/:orderId
   - Returns updated Payment data
   ↓
4. VIEWMODEL
   - Compares old status vs new status
   - Updates state if changed
   - Stops polling if status = PAID/FAILED/EXPIRED
   ↓
5. VIEW
   - Re-renders with updated status
   - Shows payment link when available
```

---

## 💻 Implementation Examples

### **Example 1: Payment Detail with Polling**

#### **ViewModel:**
```typescript
// viewmodels/PaymentDetailViewModel.ts
import { makeAutoObservable } from 'mobx';
import { PaymentService } from '../models/services/PaymentService';
import { Payment, PaymentStatus } from '../models/entities/Payment';

export class PaymentDetailViewModel {
  payment: Payment | null = null;
  isLoading = false;
  error: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private paymentService = new PaymentService();

  constructor() {
    makeAutoObservable(this);
  }

  async loadPayment(orderId: string) {
    this.isLoading = true;
    this.error = null;

    try {
      this.payment = await this.paymentService.getPayment(orderId);
    } catch (error: any) {
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  startPolling(orderId: string, intervalMs = 3000) {
    this.stopPolling();
    
    this.pollingInterval = setInterval(async () => {
      try {
        const updated = await this.paymentService.getPayment(orderId);
        this.payment = updated;

        if (this.isFinalStatus(updated.status)) {
          this.stopPolling();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private isFinalStatus(status: PaymentStatus): boolean {
    return [
      PaymentStatus.PAID,
      PaymentStatus.FAILED,
      PaymentStatus.EXPIRED,
    ].includes(status);
  }

  dispose() {
    this.stopPolling();
  }
}
```

#### **View:**
```typescript
// views/pages/PaymentDetailPage.tsx
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PaymentDetailViewModel } from '../../viewmodels/PaymentDetailViewModel';

export const PaymentDetailPage = observer(() => {
  const { orderId } = useParams<{ orderId: string }>();
  const [viewModel] = useState(() => new PaymentDetailViewModel());

  useEffect(() => {
    if (orderId) {
      viewModel.loadPayment(orderId);
      viewModel.startPolling(orderId);
    }

    return () => viewModel.dispose();
  }, [orderId]);

  if (viewModel.isLoading) return <Spinner />;
  if (viewModel.error) return <ErrorAlert message={viewModel.error} />;
  if (!viewModel.payment) return <NotFound />;

  const { payment } = viewModel;

  return (
    <div className="container">
      <h1>Payment Detail</h1>
      
      <PaymentCard>
        <p><strong>Order ID:</strong> {payment.orderId}</p>
        <p><strong>Amount:</strong> Rp {payment.amount.toLocaleString()}</p>
        <p><strong>Status:</strong> <StatusBadge status={payment.status} /></p>
        
        {payment.paymentLink && (
          <a href={payment.paymentLink} target="_blank" className="btn-primary">
            Pay Now
          </a>
        )}
      </PaymentCard>
    </div>
  );
});
```

---

### **Example 2: Payment List with Pagination**

#### **ViewModel:**
```typescript
// viewmodels/PaymentListViewModel.ts
import { makeAutoObservable } from 'mobx';
import { PaymentService } from '../models/services/PaymentService';
import { Payment } from '../models/entities/Payment';

export class PaymentListViewModel {
  payments: Payment[] = [];
  isLoading = false;
  error: string | null = null;
  currentPage = 1;
  totalPages = 1;
  
  private paymentService = new PaymentService();

  constructor() {
    makeAutoObservable(this);
  }

  async loadPayments(page = 1, limit = 10) {
    this.isLoading = true;
    this.error = null;

    try {
      const result = await this.paymentService.getAllPayments(page, limit);
      this.payments = result.data;
      this.currentPage = result.pagination.page;
      this.totalPages = Math.ceil(result.pagination.total / limit);
    } catch (error: any) {
      this.error = error.message;
    } finally {
      this.isLoading = false;
    }
  }

  async nextPage() {
    if (this.currentPage < this.totalPages) {
      await this.loadPayments(this.currentPage + 1);
    }
  }

  async prevPage() {
    if (this.currentPage > 1) {
      await this.loadPayments(this.currentPage - 1);
    }
  }
}
```

---

## 📊 Benefits of This Architecture

### ✅ **Separation of Concerns**
- View hanya handle UI
- ViewModel handle business logic
- Model handle data

### ✅ **Testability**
```typescript
// Easy to test ViewModel without UI
test('should create payment', async () => {
  const viewModel = new CreatePaymentViewModel();
  await viewModel.createPayment(mockData);
  expect(viewModel.payment).toBeDefined();
});
```

### ✅ **Reusability**
```typescript
// Same ViewModel can be used in different views
<CreatePaymentModal viewModel={createPaymentViewModel} />
<CreatePaymentPage viewModel={createPaymentViewModel} />
```

### ✅ **Maintainability**
- Change API? Update Model only
- Change UI? Update View only
- Change logic? Update ViewModel only

---

## 🎯 Best Practices

### ✅ **DO:**
- Keep Views dumb (no business logic)
- Put all state in ViewModel
- Use dependency injection for services
- Make ViewModels testable
- Use TypeScript for type safety

### ❌ **DON'T:**
- Put API calls in Views
- Put UI logic in Models
- Share state between ViewModels
- Make ViewModels depend on Views
- Use global state unnecessarily

---

## 📚 Tech Stack

- **View:** React + TypeScript
- **State Management:** MobX (for ViewModel reactivity)
- **Routing:** React Router
- **HTTP Client:** Fetch API
- **Styling:** Tailwind CSS
- **Build Tool:** Vite

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install mobx mobx-react-lite react-router-dom
npm install -D @types/react @types/react-dom
```

### 2. Create Folder Structure
```bash
mkdir -p src/{models/{entities,services},viewmodels,views/{pages,components},hooks,utils}
```

### 3. Start Implementing Features
Follow MVVM pattern for each feature:
1. Create Model (entity + service)
2. Create ViewModel (business logic)
3. Create View (UI component)

---

## 📝 Feature Checklist

### ✅ **Phase 1: Core Features**
- [ ] Create Payment (Form + API call)
- [ ] Payment Detail (Polling status)
- [ ] Payment List (Pagination)

### ✅ **Phase 2: Enhanced Features**
- [ ] Payment status notifications
- [ ] Error handling & retry
- [ ] Loading states & skeletons
- [ ] Responsive design

### ✅ **Phase 3: Advanced Features**
- [ ] Payment history filtering
- [ ] Export payment data
- [ ] Real-time updates (WebSocket)

---

**Last Updated:** 2024  
**Project:** Payment Gateway with RabbitMQ  
**Architecture:** MVVM Pattern
