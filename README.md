# StockForge Backend API

A production-ready TypeScript backend API built with **Express**, **CORS**, **Firebase Admin SDK**, **Cloud Firestore**, **Zod**, and structured error handling. Provides comprehensive management for client registration, client authentication, and subscription lifecycle management (trial, extension, renewal, cancellation, and transaction history).

---

## 🚀 Features

- **TypeScript & Express**: Strictly typed REST API architecture with clean separation of concerns (routes, controllers, services, middlewares, models, validations).
- **Firebase Authentication & Firestore**:
  - Secure user creation in Firebase Auth (`admin.auth().createUser`)
  - Client profile & subscription records in Firestore (`clients` collection)
  - Custom user claims for role-based permissions (`role: 'client'`, `plan`)
  - Verification of Firebase ID Tokens (`admin.auth().verifyIdToken`)
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
│   │   ├── auth.middleware.ts       # Bearer token authentication (Firebase ID Token)
│   │   ├── error.middleware.ts      # Global centralized error handler
│   │   ├── notFound.middleware.ts   # 404 handler
│   │   └── validate.middleware.ts   # Zod request validation
│   ├── routes/
│   │   ├── client.routes.ts         # /api/v1/clients
│   │   ├── subscription.routes.ts   # /api/v1/subscriptions
│   │   ├── inquiry.routes.ts        # /api/v1/inquiries
│   │   └── index.ts                 # Aggregated router & /api/v1/health
│   ├── services/
│   │   ├── admin.service.ts         # Super Admin authentication & seeding
│   │   ├── client.service.ts        # Client business logic (Auth + Firestore)
│   │   ├── subscription.service.ts  # Subscription calculations & history
│   │   └── inquiry.service.ts       # Customer & lead inquiries
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces and types
│   ├── utils/
│   │   ├── apiError.ts              # Custom ApiError with HTTP status codes
│   │   ├── apiResponse.ts           # Standardized JSON response envelope
│   │   └── dateUtils.ts             # Expiry & extension date calculation helpers
│   ├── validations/
│   │   ├── client.validation.ts     # Zod schemas for clients
│   │   ├── subscription.validation.ts # Zod schemas for subscriptions
│   │   └── inquiry.validation.ts    # Zod schemas for inquiries
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

# Default Trial Duration
DEFAULT_TRIAL_DAYS=14

# --- Firebase Credentials ---
# From Firebase Console -> Project Settings -> Service Accounts:
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# From Firebase Console -> Project Settings -> General -> Web API Key:
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

# Seed/verify Super Admin in Firebase
npm run seed:admin

# Start production build
npm start
```

---

## 🛡️ Super Admin Credentials & Management

A dedicated Super Admin account is pre-configured and automatically verified in Firebase Authentication on server start (or manually via `npm run seed:admin`).

### Default Credentials (Configurable in `.env`):
- **Email**: `admin@stockforge.io` (via `SUPER_ADMIN_EMAIL`)
- **Password**: `SuperAdmin@StockForge2026!` (via `SUPER_ADMIN_PASSWORD`)
- **Name**: `Super Administrator` (via `SUPER_ADMIN_NAME`)
- **Role Claim**: `super_admin` (`isAdmin: true`)

---

## 📡 API Reference

Base URL: `http://localhost:5000/api/v1`

### 0. Super Admin Endpoints

#### Admin Login
`POST /api/v1/admin/login`
- **Request Body**:
```json
{
  "email": "admin@stockforge.io",
  "password": "SuperAdmin@StockForge2026!"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Super Admin authenticated successfully",
  "data": {
    "token": "...",
    "tokenType": "Bearer",
    "admin": {
      "id": "I5tW9mcoQNcetZqST8nsnxIME4W2",
      "email": "admin@stockforge.io",
      "name": "Super Administrator",
      "role": "super_admin"
    }
  }
}
```

#### Get Current Super Admin Profile
`GET /api/v1/admin/me`
- **Headers**: `Authorization: Bearer <super_admin_token>`

#### Manually Trigger Super Admin Seed
`POST /api/v1/admin/seed`
- **Headers**: `Authorization: Bearer <super_admin_token>`

---

### Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | Allowed Roles / Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/admin/login` | `POST` | Public | Super Admin authentication |
| `/api/v1/admin/me` | `GET` | `super_admin` | View Super Admin profile |
| `/api/v1/clients/login` | `POST` | Public | Client login with email/password |
| `/api/v1/clients/register` | `POST` | **`super_admin` only** | Register a new client account |
| `/api/v1/clients` | `GET` | **`super_admin` only** | List all clients with pagination & filters |
| `/api/v1/clients/:id` | `GET` | Self or `super_admin` | View specific client details |
| `/api/v1/clients/:id` | `PATCH` | Self or `super_admin` | Update client profile details |
| `/api/v1/clients/:id` | `DELETE` | **`super_admin` only** | Delete a client |
| `/api/v1/clients/me` | `GET` | Authenticated Client | View own profile & subscription |
| `/api/v1/subscriptions/extend` | `POST` | **`super_admin` only** | Extend or alter client subscription |
| `/api/v1/subscriptions/cancel` | `POST` | **`super_admin` only** | Cancel client subscription |
| `/api/v1/subscriptions/:clientId/status` | `GET` | Self or `super_admin` | Query subscription status & days remaining |
| `/api/v1/subscriptions/:clientId/history` | `GET` | Self or `super_admin` | Audit log of subscription extensions |
| `/api/v1/inquiries` | `POST` | Public / Optional Auth | Submit new contact, sales, or support inquiry |
| `/api/v1/inquiries` | `GET` | **`super_admin` only** | List all inquiries with search & status filters |
| `/api/v1/inquiries/my` | `GET` | Authenticated Client | List inquiries submitted by the logged-in client |
| `/api/v1/inquiries/:id` | `GET` | Self or `super_admin` | View inquiry details |
| `/api/v1/inquiries/:id` | `PATCH` | **`super_admin` only** | Update inquiry status or admin notes |
| `/api/v1/inquiries/:id` | `DELETE` | **`super_admin` only** | Delete an inquiry |

---

### 1. Client Authentication & Management

#### Register Client (Super Admin Only)
`POST /api/v1/clients/register`
- **Headers**: `Authorization: Bearer <super_admin_token>`
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

#### Extend Subscription (Super Admin Only)
`POST /api/v1/subscriptions/extend`
- **Headers**: `Authorization: Bearer <super_admin_token>`
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
- Returns audit list of all extensions, renewals, trial allocations, and cancellations stored in the dedicated `subscription_history` collection, ordered newest first.

#### Cancel Subscription (Super Admin Only)
`POST /api/v1/subscriptions/cancel`
- **Headers**: `Authorization: Bearer <super_admin_token>`
- **Request Body**:
```json
{
  "clientId": "usr_xyz123",
  "reason": "Customer request"
}
```

---

### 3. Inquiry Management

#### Submit an Inquiry (Public / Client)
`POST /api/v1/inquiries`
- **Headers**: Optional `Authorization: Bearer <client_token>` (auto-attaches `clientId`)
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+15551234567",
  "shopName": "Jane Boutique",
  "type": "sales",
  "subject": "Interested in Enterprise Plan",
  "message": "Hello, I would like to request a demo and discuss enterprise pricing for our chain of 5 stores.",
  "source": "website"
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "message": "Inquiry submitted successfully",
  "data": {
    "id": "inq_1791537855213_84513f",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "shopName": "Jane Boutique",
    "type": "sales",
    "subject": "Interested in Enterprise Plan",
    "message": "...",
    "status": "pending",
    "source": "website",
    "createdAt": "2026-10-09T09:24:15.000Z",
    "updatedAt": "2026-10-09T09:24:15.000Z"
  }
}
```

#### List All Inquiries (Super Admin Only)
`GET /api/v1/inquiries?page=1&limit=20&status=pending&type=sales&search=boutique`
- **Headers**: `Authorization: Bearer <super_admin_token>`

#### List My Inquiries (Authenticated Client)
`GET /api/v1/inquiries/my?page=1&limit=10`
- **Headers**: `Authorization: Bearer <client_token>`

#### Get Inquiry Details
`GET /api/v1/inquiries/:id`
- **Headers**: `Authorization: Bearer <token>` (Super Admin or inquiry owner)

#### Update Inquiry Status & Notes (Super Admin Only)
`PATCH /api/v1/inquiries/:id`
- **Headers**: `Authorization: Bearer <super_admin_token>`
- **Request Body**:
```json
{
  "status": "in_progress",
  "adminNotes": "Assigned to sales representative. Call scheduled for tomorrow."
}
```

#### Delete Inquiry (Super Admin Only)
`DELETE /api/v1/inquiries/:id`
- **Headers**: `Authorization: Bearer <super_admin_token>`

---

### 4. System & Health

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

