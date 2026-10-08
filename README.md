# StockForge Backend API

A production-ready TypeScript backend API built with **Express**, **CORS**, **Firebase Admin SDK**, **Cloud Firestore**, **Zod**, and structured error handling. Provides comprehensive management for client registration, client authentication, and subscription lifecycle management (trial, extension, renewal, cancellation, and transaction history).

---

## 🚀 Features

- **TypeScript & Express**: Strictly typed REST API architecture with clean separation of concerns (routes, controllers, services, middlewares, models, validations).
- **Firebase Authentication & Firestore**:
  - Secure user creation in Firebase Auth (`admin.auth().createUser`)
  - Client profile & subscription records in Firestore (`clients` collection)
  - Custom user claims for role-based permissions (`role: 'client'`, `plan`)
  - Verification of Firebase ID Tokens (`admin.auth().verifyIdToken`) with fallback JWT session tokens
  - Offline / Dev simulation mode when Firebase credentials are not yet configured
- **Subscription Management**:
  - Automatic trial creation on registration (configurable duration, default 14 days)
  - Smart subscription extension (`/api/v1/subscriptions/extend`):
    - Extends future expiration dates if currently active
    - Extends from today if currently expired
    - Upgrades or alters subscription plans (`trial`, `starter`, `pro`, `enterprise`)
    - Tracks full audit and payment history (`amountPaid`, `paymentReference`, `extendedAt`, `previousExpiryDate`, `newExpiryDate`)
  - Subscription status queries & cancellations
- **Security & Reliability**:
  - **CORS** middleware with configurable origin whitelist
  - **Helmet** for HTTP security headers
  - **Morgan** for HTTP request logging
  - **Zod** schema validation middleware for request bodies, query params, and URL parameters
  - Centralized **Error Handling** with consistent JSON error envelopes and status codes

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts                   # Environment variables loader
│   │   └── firebase.ts              # Firebase Admin SDK & Firestore initialization
│   ├── controllers/
│   │   ├── client.controller.ts     # Client auth and profile HTTP handlers
│   │   └── subscription.controller.ts # Subscription lifecycle HTTP handlers
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # Bearer token authentication (Firebase ID Token / JWT)
│   │   ├── error.middleware.ts      # Global centralized error handler
│   │   ├── notFound.middleware.ts   # 404 handler
│   │   └── validate.middleware.ts   # Zod request validation
│   ├── routes/
│   │   ├── client.routes.ts         # /api/v1/clients
│   │   ├── subscription.routes.ts   # /api/v1/subscriptions
│   │   └── index.ts                 # Aggregated router & /api/v1/health
│   ├── services/
│   │   ├── client.service.ts        # Client business logic (Auth + Firestore)
│   │   ├── mockStorage.service.ts   # Local in-memory store for dev without credentials
│   │   └── subscription.service.ts  # Subscription calculations & history
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces and types
│   ├── utils/
│   │   ├── apiError.ts              # Custom ApiError with HTTP status codes
│   │   ├── apiResponse.ts           # Standardized JSON response envelope
│   │   └── dateUtils.ts             # Expiry & extension date calculation helpers
│   ├── validations/
│   │   ├── client.validation.ts     # Zod schemas for clients
│   │   └── subscription.validation.ts # Zod schemas for subscriptions
│   ├── app.ts                       # Express app configuration
│   ├── server.ts                    # Server startup & graceful shutdown
│   └── test-api.ts                  # End-to-end API test verification suite
├── .env.example                     # Sample environment configuration
├── .env                             # Active environment configuration
├── package.json
└── tsconfig.json
```

---

## ⚙️ Configuration (.env)

Create a `.env` file in `backend/` or copy from `.env.example`:

```env
PORT=5000
NODE_ENV=development
CLIENT_CORS_ORIGIN=*

# JWT Fallback Secret
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Default Trial Duration
DEFAULT_TRIAL_DAYS=14

# --- Firebase Configuration (Choose Option 1 or Option 2) ---

# Option 1: File path to Firebase Service Account JSON (Recommended)
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json

# Option 2: Individual credentials from Service Account JSON
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Web API Key (Optional, used for client email/password login verification)
FIREBASE_WEB_API_KEY=AIzaSy...
```

> **Note**: If Firebase credentials are not provided, the API automatically runs in **Local Simulation Mode**, allowing you to test endpoints immediately without configuration!

---

## 📦 Scripts

```bash
# Run in development mode with live reloading
npm run dev

# Run automated end-to-end API verification suite
npm test

# Typecheck TypeScript code
npm run typecheck

# Build for production
npm run build

# Start production build
npm start
```

---

## 📡 API Reference

Base URL: `http://localhost:5000/api/v1`

### 1. Client Authentication & Management

#### Register Client
`POST /api/v1/clients/register`
- **Request Body**:
```json
{
  "name": "Apex Supermarket",
  "email": "apex@example.com",
  "password": "SecurePassword123!",
  "phone": "+1234567890",
  "shopName": "Apex Store #1",
  "shopType": "Retail",
  "address": "123 Market St, NY",
  "plan": "trial",
  "trialDays": 14
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "message": "Client registered successfully",
  "data": {
    "token": "...",
    "tokenType": "Bearer",
    "client": {
      "id": "usr_xyz123",
      "email": "apex@example.com",
      "name": "Apex Supermarket",
      "shopName": "Apex Store #1",
      "isActive": true,
      "subscription": {
        "plan": "trial",
        "status": "trial",
        "startDate": "2026-10-09T00:00:00.000Z",
        "durationDays": 14,
        "expiryDate": "2026-10-23T00:00:00.000Z",
        "history": [...]
      }
    },
    "subscriptionStatus": {
      "status": "trial",
      "plan": "trial",
      "expiryDate": "2026-10-23T00:00:00.000Z",
      "daysRemaining": 14,
      "isExpired": false
    }
  }
}
```

#### Login Client
`POST /api/v1/clients/login`
- **Request Body**:
```json
{
  "email": "apex@example.com",
  "password": "SecurePassword123!"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Client logged in successfully",
  "data": {
    "token": "...",
    "tokenType": "Bearer",
    "client": { ... },
    "subscriptionStatus": { ... }
  }
}
```

#### Get Current Authenticated Client Profile
`GET /api/v1/clients/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`)

#### Get Client by ID
`GET /api/v1/clients/:id`

#### Update Client
`PATCH /api/v1/clients/:id`
- **Request Body**:
```json
{
  "shopName": "Apex Mega Mart",
  "address": "456 Main Blvd"
}
```

#### List Clients (with pagination & filter)
`GET /api/v1/clients?page=1&limit=20&status=active&search=apex`

---

### 2. Subscription Management

#### Extend Subscription
`POST /api/v1/subscriptions/extend`
- **Request Body**:
```json
{
  "clientId": "usr_xyz123",
  "durationDays": 30,
  "plan": "pro",
  "amountPaid": 49.99,
  "currency": "USD",
  "paymentReference": "TXN_789456123",
  "notes": "Monthly Pro subscription renewal"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Subscription extended successfully",
  "data": {
    "client": {
      "id": "usr_xyz123",
      "subscription": {
        "plan": "pro",
        "status": "active",
        "durationDays": 44,
        "expiryDate": "2026-11-22T00:00:00.000Z",
        "history": [...]
      }
    },
    "extensionDetails": {
      "id": "sub_ext_...",
      "extendedAt": "2026-10-09T00:00:00.000Z",
      "durationDays": 30,
      "previousExpiryDate": "2026-10-23T00:00:00.000Z",
      "newExpiryDate": "2026-11-22T00:00:00.000Z",
      "plan": "pro",
      "amountPaid": 49.99,
      "currency": "USD",
      "paymentReference": "TXN_789456123",
      "notes": "Monthly Pro subscription renewal",
      "extendedBy": "admin"
    },
    "daysRemaining": 44
  }
}
```

#### Check Subscription Status
`GET /api/v1/subscriptions/:clientId/status`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Subscription status retrieved successfully",
  "data": {
    "clientId": "usr_xyz123",
    "status": "active",
    "plan": "pro",
    "startDate": "2026-10-09T00:00:00.000Z",
    "expiryDate": "2026-11-22T00:00:00.000Z",
    "daysRemaining": 44,
    "isExpired": false,
    "totalExtensions": 2
  }
}
```

#### Get Subscription Extension History
`GET /api/v1/subscriptions/:clientId/history`
- Returns audit list of all extensions, renewals, and plan upgrades with transaction IDs and dates.

#### Cancel Subscription
`POST /api/v1/subscriptions/cancel`
- **Request Body**:
```json
{
  "clientId": "usr_xyz123",
  "reason": "Customer request"
}
```

---

### 3. System & Health

#### Health Check
`GET /api/v1/health`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "StockForge Backend API is healthy",
  "data": {
    "status": "ok",
    "uptime": 12.34,
    "timestamp": "2026-10-09T00:00:00.000Z",
    "firebase": {
      "connected": true,
      "mode": "firebase_cloud"
    }
  }
}
```

