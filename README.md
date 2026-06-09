# CASAGEN Backend API

> Backend API for **CASAGEN** — an AI-powered real-estate listing platform built with Express.js, Prisma, and PostgreSQL.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis
- pnpm (`npm install -g pnpm`)

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd johann-rochat-backend

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.dev .env
# Edit .env with your credentials

# 4. Generate Prisma Client
pnpm run prisma:generate

# 5. Run database migrations
pnpm run prisma:migrate

# 6. Seed the database
pnpm run seeds:admin      # Create admin account
pnpm run seeds:package    # Create subscription packages

# 7. Start development server
pnpm run dev
```

Server runs at `http://localhost:5000/api/v1`

---

## 📂 Project Structure

```
johann-rochat-backend/
│
├── src/
│   ├── config/                    # App configuration (DB, env, logger, etc.)
│   │
│   ├── features/                  # Feature modules (MVC per domain)
│   │   ├── ai-feature/
│   │   │   ├── ai-feature.controller.js
│   │   │   ├── ai-feature.routes.js
│   │   │   ├── ai-feature.service.js
│   │   │   └── ai-feature.validation.js
│   │   ├── auth/
│   │   ├── credit/
│   │   ├── export/
│   │   ├── generation/
│   │   ├── improvement/
│   │   ├── listing/
│   │   │   ├── listing.controller.js
│   │   │   ├── listing.routes.js
│   │   │   ├── listing.service.js
│   │   │   └── listing.validation.js
│   │   ├── meta/
│   │   ├── package/
│   │   ├── payment/
│   │   ├── prompt/
│   │   └── user/
│   │
│   ├── generated/                 # Prisma generated client output
│   │
│   ├── routes/
│   │   └── routes.js              # Central route aggregator
│   │
│   ├── seeds/
│   │   ├── admin.seeder.js        # Admin account seed
│   │   └── package.seeder.js     # Subscription package seed
│   │
│   ├── shared/
│   │   └── globals/
│   │       ├── decorators/
│   │       │   ├── catch-async.js       # Async error wrapper
│   │       │   └── zod-validation.js    # Zod middleware decorator
│   │       └── helpers/
│   │           ├── auth-middleware.js   # JWT auth guard
│   │           ├── error-handler.js     # Global error handler
│   │           ├── helpers.js
│   │           ├── pagination.helper.js
│   │           ├── query-builder.js
│   │           ├── rate-limit.helper.js
│   │           └── response.handler.js
│   │
│   ├── services/                  # Shared/external services (email, AI, etc.)
│   ├── app.js                     # Express app setup
│   ├── app.test.js
│   ├── bootstrap.js               # Server entry point
│   └── server.js                  # HTTP server initializer
│
├── prisma/
│   └── schema.prisma              # Database schema
│
├── .env.dev                       # Environment variable template
├── .editorconfig
├── package.json
└── README.md
```

---

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start development server with nodemon auto-reload |
| `pnpm start` | Start production server |
| `pnpm run start:pm2` | Start with PM2 process manager |
| `pnpm run stop` | Stop PM2 process |
| `pnpm run delete` | Delete PM2 process and flush logs |
| `pnpm run build` | Generate Prisma Client |
| `pnpm run prisma:generate` | Generate Prisma Client |
| `pnpm run prisma:migrate` | Run database migrations (dev) |
| `pnpm run prisma:deploy` | Deploy migrations (production) |
| `pnpm run prisma:studio` | Open Prisma Studio GUI |
| `pnpm run seeds:admin` | Seed admin user |
| `pnpm run seeds:package` | Seed subscription packages |
| `pnpm run lint` | Run ESLint |
| `pnpm run lint:fix` | Auto-fix ESLint issues |
| `pnpm run format` | Format code with Prettier |
| `pnpm run test` | Run tests with Vitest |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run test:coverage` | Run tests with coverage report |

---

## 🔐 Authentication

CASAGEN supports two authentication strategies:

### 1. JWT + OTP Flow

```
POST /auth/signup             →  Account created, OTP sent to email
POST /auth/verify-signup-otp  →  Account activated
POST /auth/signin             →  Access token + refresh token issued
POST /auth/verify-login-otp   →  (2FA) OTP verification step
POST /auth/refresh-token      →  Renew session with refresh token
```

### 2. Google OAuth 2.0

```
GET /auth/google              →  Redirect to Google consent screen
GET /auth/google/callback     →  Google redirects back, JWT issued
```

### Using the Token

Include the JWT in every protected request:

```
Authorization: Bearer <your-access-token>
```

🔐 Authentication Flow

System uses JWT + OTP-based verification system.

Flow:
1. Signup → OTP sent
2. Verify OTP → account activated
3. Login → JWT issued
4. Refresh token → session renewal

### 🧩 API Modules Overview
## 🔐 Auth Module

Handles authentication + OTP + password recovery

Endpoints
POST /auth/signup
POST /auth/signin
POST /auth/signout
POST /auth/verify-signup-otp
POST /auth/verify-login-otp
POST /auth/resend-otp
POST /auth/refresh-token
POST /auth/forgot-password
POST /auth/verify-reset-otp
POST /auth/reset-password
PATCH /auth/change-password