# PaymentKit 🚀

**PaymentKit** is a robust, modular payment gateway integration platform designed for scalability and reliability. It features a high-performance Hono API, asynchronous background processing with RabbitMQ, and a modern Next.js management frontend.

---

## 📋 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#-usage)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

- 🔗 **Midtrans Integration**: Seamless connection with Midtrans (Sandbox & Production).
- ⚡ **Asynchronous Processing**: Background jobs handled by RabbitMQ for high throughput.
- 🛡️ **Secure Webhooks**: SHA512 signature validation for all incoming gateway notifications.
- 🏗️ **SOLID Architecture**: Clean code principles with Repository and Service patterns.
- 📖 **OpenAPI Docs**: Interactive API documentation powered by Scalar.
- 💾 **SQL Persistence**: Reliable data storage using MikroORM with support for MySQL/Postgres.

---

## 📂 Project Structure

```text
.
├── 📁 api (Hono API & Worker)
│   ├── 📁 src
│   │   ├── 📁 config (DB & Env config)
│   │   ├── 📁 domain (Services, Gateways, Repositories)
│   │   ├── 📁 handler (HTTP Request Handlers)
│   │   ├── 📁 middleware (Auth, Errors)
│   │   ├── 📁 routes (API Route Definitions)
│   │   ├── 📁 schemas (Zod Validation)
│   │   └── 📁 worker (RabbitMQ Consumers)
│   └── 📄 package.json
├── 📁 web (Next.js Frontend)
│   ├── 📁 app (Pages & Layouts)
│   ├── 📁 src
│   │   ├── 📁 models (API Services & Entities)
│   │   ├── 📁 viewmodels (MobX State Management)
│   │   └── 📁 views (React Components)
│   └── 📄 package.json
├── 📁 Docs (Flowcharts & Documentation)
├── 📄 package.json (Root Workspace)
├── 📄 pnpm-workspace.yaml
└── 📄 README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v9 or higher
- **RabbitMQ**: (Running locally or via Docker)
- **Database**: MySQL or PostgreSQL

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TurtleMapple/paymentkit.git
   cd paymentkit
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy the example files and update them with your credentials.
   ```bash
   cp api/.env.example api/.env
   cp web/.env.example web/.env
   ```

### Configuration

#### API Environment Variables (`api/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | API Server Port | `3000` |
| `DB_HOST` | Database Host | `localhost` |
| `DB_NAME` | Database Name | `paymentkit` |
| `RABBITMQ_URL` | RabbitMQ Connection String | `amqp://localhost:5672` |
| `MIDTRANS_SERVER_KEY` | Your Midtrans Server Key | *Required* |
| `API_KEY` | Security key for internal API calls | *Required* |

---

## 🛠 Usage

### Development Mode

Run all services concurrently using the root workspace:

```bash
# Start API
pnpm --filter api run dev

# Start Worker (Background Processing)
pnpm --filter api run dev:worker

# Start Web Frontend
pnpm --filter web run dev
```

### Production Build

```bash
# Build all apps
pnpm build

# Start production server
pnpm start
```

---

## 🏛 Architecture

PaymentKit follows a **Clean Architecture** approach:

1. **API Layer**: Receives payment requests and publishes events to RabbitMQ.
2. **Message Broker**: RabbitMQ acts as a buffer and ensures message persistence.
3. **Worker Layer**: Consumes messages, interacts with Midtrans API, and updates the database.
4. **Reliability**: Uses a Dead Letter Exchange (DLX) for automatic retry and failure handling.

---

## 🔍 Troubleshooting

- **RabbitMQ Connection Failure**: Ensure the RabbitMQ service is running and the `RABBITMQ_URL` in `.env` is correct.
- **Midtrans Signature Error**: Verify your `MIDTRANS_SERVER_KEY` matches the one in your Midtrans Dashboard.
- **Database Migrations**: Run `pnpm --filter api run migration:up` if you encounter missing table errors.

---

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT** License. See `LICENSE` for more information.

---

## 👤 Credits

- **TurtleMapple** - *Initial Work* - [@TurtleMapple](https://github.com/TurtleMapple)
