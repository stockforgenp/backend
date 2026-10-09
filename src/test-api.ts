/**
 * Comprehensive API Verification Test
 * Spins up the express app and tests all routes, auth middleware, and role protections end-to-end
 */
import app from "./app";
import http from "http";

async function runTests() {
  const port = 5099;
  const host = "127.0.0.1";
  const server = http.createServer(app);

  await new Promise<void>((resolve) =>
    server.listen(port, host, () => resolve()),
  );
  const baseUrl = `http://${host}:${port}/api/v1`;

  console.log("🧪 Starting API & Role Authorization Test Suite on", baseUrl);

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error("     Error:", err.message);
      failed++;
    }
  }

  // 1. Health check
  await test("GET /health returns 200 and healthy status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.status !== "ok") {
      throw new Error(`Expected 200 ok, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 2. Super Admin Login
  let superAdminToken = "";
  await test("POST /admin/login authenticates Super Admin and returns super_admin token", async () => {
    const res = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@stockforge.io",
        password: "SuperAdmin@StockForge2026!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || !data.data?.token || data.data.admin.role !== "super_admin") {
      throw new Error(`Expected 200 super_admin login, got ${res.status}: ${JSON.stringify(data)}`);
    }
    superAdminToken = data.data.token;
  });

  // 3. Super Admin Profile
  await test("GET /admin/me returns Super Admin profile with super_admin role", async () => {
    const res = await fetch(`${baseUrl}/admin/me`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data?.role !== "super_admin" || data.data?.email !== "admin@stockforge.io") {
      throw new Error(`Expected 200 with super_admin profile, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 4. Role Guard: Registration blocked without token (401)
  await test("POST /clients/register returns 401 Unauthorized when no token provided", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized Store",
        email: "unauth@example.com",
        password: "Password123!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 401) {
      throw new Error(`Expected 401 unauthorized, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 5. Validation error on register with Super Admin token (422)
  await test("POST /clients/register returns 422 on invalid body (short password)", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: "T",
        email: "invalid-email",
        password: "123",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 422 || data.success !== false) {
      throw new Error(`Expected 422 validation error, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 6. Successful client registration by Super Admin
  const runId = Date.now();
  const email1 = `apex_${runId}@example.com`;
  const email2 = `beta_${runId}@example.com`;
  let client1Id = "";
  let client1Token = "";

  await test("POST /clients/register successfully registers new client when called by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: "Apex Supermarket",
        email: email1,
        password: "SecurePassword123!",
        shopName: "Apex Store #1",
        shopType: "Retail",
        plan: "trial",
        trialDays: 14,
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 201 || !data.data.token || !data.data.client.id) {
      throw new Error(`Expected 201 created, got ${res.status}: ${JSON.stringify(data)}`);
    }
    client1Id = data.data.client.id;
    client1Token = data.data.token;
  });

  // 7. Register a second client for ownership testing
  let client2Id = "";
  let client2Token = "";
  await test("POST /clients/register registers client 2 by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: "Beta Electronics",
        email: email2,
        password: "SecurePassword123!",
        shopName: "Beta Tech",
        shopType: "Electronics",
        plan: "trial",
        trialDays: 7,
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(data)}`);
    client2Id = data.data.client.id;
    client2Token = data.data.token;
  });

  // 8. Role Guard: Regular Client CANNOT register clients (403 Forbidden)
  await test("POST /clients/register returns 403 Forbidden when called by a regular client", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client1Token}`,
      },
      body: JSON.stringify({
        name: "Illicit Store",
        email: `illicit_${runId}@example.com`,
        password: "Password123!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 403) {
      throw new Error(`Expected 403 forbidden for client role, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 9. Client Login
  await test("POST /clients/login authenticates registered client", async () => {
    const res = await fetch(`${baseUrl}/clients/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email1,
        password: "SecurePassword123!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || !data.data.token) {
      throw new Error(`Expected 200 ok, got ${res.status}: ${JSON.stringify(data)}`);
    }
    client1Token = data.data.token;
  });

  // 10. Authenticated client accesses their own profile
  await test("GET /clients/me returns client profile using client Bearer token", async () => {
    const res = await fetch(`${baseUrl}/clients/me`, {
      headers: { Authorization: `Bearer ${client1Token}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.email !== email1) {
      throw new Error(`Expected 200 profile, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 11. Role Guard: Client CANNOT extend subscriptions (403 Forbidden)
  await test("POST /subscriptions/extend returns 403 Forbidden when called by a regular client", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/extend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client1Token}`,
      },
      body: JSON.stringify({
        clientId: client1Id,
        durationDays: 30,
        plan: "pro",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 403) {
      throw new Error(`Expected 403 forbidden for client extending sub, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 12. Super Admin extends client subscription successfully
  await test("POST /subscriptions/extend succeeds when called by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/extend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        clientId: client1Id,
        durationDays: 30,
        plan: "pro",
        amountPaid: 49.99,
        currency: "USD",
        paymentReference: "PAY_TXN_987654321",
        notes: "Monthly Pro Plan Renewal by Super Admin",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.client.subscription.status !== "active") {
      throw new Error(`Expected 200 with active sub, got ${res.status}: ${JSON.stringify(data)}`);
    }
    if (data.data.client.subscription.plan !== "pro") {
      throw new Error(`Expected plan 'pro', got: ${data.data.client.subscription.plan}`);
    }
  });

  // 13. Role Guard: Client CANNOT list all clients (403 Forbidden)
  await test("GET /clients returns 403 Forbidden when called by a regular client", async () => {
    const res = await fetch(`${baseUrl}/clients`, {
      headers: { Authorization: `Bearer ${client1Token}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 403) {
      throw new Error(`Expected 403 forbidden for client listing all clients, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 14. Super Admin lists all clients successfully
  await test("GET /clients returns client list with pagination when called by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/clients?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || !Array.isArray(data.data) || data.meta.total < 2) {
      throw new Error(`Expected client list with at least 2 clients, got: ${JSON.stringify(data)}`);
    }
  });

  // 15. Ownership Guard: Client 1 CANNOT view Client 2 profile (403 Forbidden)
  await test("GET /clients/:id returns 403 Forbidden when client attempts to view another client profile", async () => {
    const res = await fetch(`${baseUrl}/clients/${client2Id}`, {
      headers: { Authorization: `Bearer ${client1Token}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 403) {
      throw new Error(`Expected 403 forbidden for cross-client access, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 16. Ownership Guard: Client 1 CAN view their OWN profile by ID (200 OK)
  await test("GET /clients/:id returns 200 when client views their own profile", async () => {
    const res = await fetch(`${baseUrl}/clients/${client1Id}`, {
      headers: { Authorization: `Bearer ${client1Token}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.id !== client1Id) {
      throw new Error(`Expected 200 own profile, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 17. Super Admin CAN view any client profile by ID (200 OK)
  await test("GET /clients/:id returns 200 when Super Admin views any client profile", async () => {
    const res = await fetch(`${baseUrl}/clients/${client2Id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.id !== client2Id) {
      throw new Error(`Expected 200 client 2 profile for admin, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 18. Client views their own subscription status
  await test("GET /subscriptions/:clientId/status returns 200 when client views own subscription status", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/${client1Id}/status`, {
      headers: { Authorization: `Bearer ${client1Token}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.status !== "active") {
      throw new Error(`Expected 200 status, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 19. Role Guard: Client CANNOT cancel subscriptions (403 Forbidden)
  await test("POST /subscriptions/cancel returns 403 Forbidden when called by a regular client", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${client1Token}`,
      },
      body: JSON.stringify({
        clientId: client1Id,
        reason: "Unauthorized attempt",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 403) {
      throw new Error(`Expected 403 forbidden for client cancelling subscription, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 20. Super Admin cancels subscription
  await test("POST /subscriptions/cancel succeeds when called by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        clientId: client2Id,
        reason: "Non-payment",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.status !== "cancelled") {
      throw new Error(`Expected 200 cancelled status, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 21. Super Admin deletes a client
  await test("DELETE /clients/:id succeeds when called by Super Admin", async () => {
    const res = await fetch(`${baseUrl}/clients/${client2Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200) {
      throw new Error(`Expected 200 deleted, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  // 22. Unknown route 404
  await test("GET /unknown-route returns standard 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    const data = (await res.json()) as any;
    if (res.status !== 404 || data.success !== false) {
      throw new Error(`Expected 404, got ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  server.close();

  console.log(`\n========================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});
