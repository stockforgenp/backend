/**
 * Comprehensive API Verification Test
 * Spins up the express app and tests all routes end-to-end
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

  console.log("🧪 Starting API Verification Suite on", baseUrl);

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
      throw new Error(
        `Expected 200 ok, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
  });

  // 2. Validation error on register
  await test("POST /clients/register returns 422 on invalid body (short password)", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "T",
        email: "invalid-email",
        password: "123",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 422 || data.success !== false) {
      throw new Error(
        `Expected 422 validation error, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
  });

  // 3. Successful client registration
  let registeredClientId = "";
  let authToken = "";

  await test("POST /clients/register successfully registers a new client with trial subscription", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Apex Supermarket",
        email: "apex@example.com",
        password: "SecurePassword123!",
        shopName: "Apex Store #1",
        shopType: "Retail",
        phone: "+1234567890",
        plan: "trial",
        trialDays: 14,
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 201 || !data.data.token || !data.data.client.id) {
      throw new Error(
        `Expected 201 created, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
    registeredClientId = data.data.client.id;
    authToken = data.data.token;
    if (
      data.data.subscriptionStatus.status !== "trial" ||
      data.data.subscriptionStatus.daysRemaining !== 14
    ) {
      throw new Error(
        `Subscription status mismatch: ${JSON.stringify(data.data.subscriptionStatus)}`,
      );
    }
  });

  // 4. Duplicate registration conflict
  await test("POST /clients/register returns 409 conflict for existing email", async () => {
    const res = await fetch(`${baseUrl}/clients/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Apex",
        email: "apex@example.com",
        password: "AnotherPassword123!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 409) {
      throw new Error(
        `Expected 409 conflict, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
  });

  // 5. Successful login
  await test("POST /clients/login authenticates client and returns token", async () => {
    const res = await fetch(`${baseUrl}/clients/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "apex@example.com",
        password: "SecurePassword123!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || !data.data.token) {
      throw new Error(
        `Expected 200 ok, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
    authToken = data.data.token;
  });

  // 6. Invalid password login
  await test("POST /clients/login returns 401 on wrong password", async () => {
    const res = await fetch(`${baseUrl}/clients/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "apex@example.com",
        password: "WrongPassword!",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 401) {
      throw new Error(
        `Expected 401 unauthorized, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
  });

  // 7. Get authenticated client profile
  await test("GET /clients/me returns authenticated client profile", async () => {
    const res = await fetch(`${baseUrl}/clients/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.email !== "apex@example.com") {
      throw new Error(
        `Expected 200 ok with profile, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
  });

  // 8. Extend subscription
  await test("POST /subscriptions/extend adds duration, updates plan and records history", async () => {
    const res = await fetch(`${baseUrl}/subscriptions/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: registeredClientId,
        durationDays: 30,
        plan: "pro",
        amountPaid: 49.99,
        currency: "USD",
        paymentReference: "PAY_TXN_987654321",
        notes: "Monthly Pro Plan Extension",
      }),
    });
    const data = (await res.json()) as any;
    if (
      res.status !== 200 ||
      data.data.client.subscription.status !== "active"
    ) {
      throw new Error(
        `Expected 200 with active sub, got ${res.status}: ${JSON.stringify(data)}`,
      );
    }
    if (data.data.client.subscription.plan !== "pro") {
      throw new Error(
        `Plan was not updated to pro: ${data.data.client.subscription.plan}`,
      );
    }
    if (data.data.daysRemaining < 43) {
      throw new Error(
        `Expected at least 44 days remaining (14 trial + 30 pro), got: ${data.data.daysRemaining}`,
      );
    }
  });

  // 9. Get subscription status
  await test("GET /subscriptions/:clientId/status returns live status and history count", async () => {
    const res = await fetch(
      `${baseUrl}/subscriptions/${registeredClientId}/status`,
    );
    const data = (await res.json()) as any;
    if (
      res.status !== 200 ||
      data.data.status !== "active" ||
      data.data.plan !== "pro"
    ) {
      throw new Error(
        `Expected active pro status, got: ${JSON.stringify(data)}`,
      );
    }
    if (data.data.totalExtensions < 2) {
      throw new Error(
        `Expected at least 2 history entries, got ${data.data.totalExtensions}`,
      );
    }
  });

  // 10. Get subscription history
  await test("GET /subscriptions/:clientId/history returns history entries", async () => {
    const res = await fetch(
      `${baseUrl}/subscriptions/${registeredClientId}/history`,
    );
    const data = (await res.json()) as any;
    if (
      res.status !== 200 ||
      !Array.isArray(data.data) ||
      data.data.length < 2
    ) {
      throw new Error(
        `Expected array of history records, got: ${JSON.stringify(data)}`,
      );
    }
  });

  // 11. Update client
  await test("PATCH /clients/:id updates client business info", async () => {
    const res = await fetch(`${baseUrl}/clients/${registeredClientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: "Apex Mega Mart",
        address: "123 Market St, New York, NY",
      }),
    });
    const data = (await res.json()) as any;
    if (res.status !== 200 || data.data.shopName !== "Apex Mega Mart") {
      throw new Error(
        `Expected updated shopName, got: ${JSON.stringify(data)}`,
      );
    }
  });

  // 12. List clients
  await test("GET /clients lists clients with pagination metadata", async () => {
    const res = await fetch(`${baseUrl}/clients?page=1&limit=10`);
    const data = (await res.json()) as any;
    if (
      res.status !== 200 ||
      !Array.isArray(data.data) ||
      data.meta.total < 1
    ) {
      throw new Error(`Expected client list, got: ${JSON.stringify(data)}`);
    }
  });

  // 13. 404 for unknown route
  await test("GET /unknown-route returns standard 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    const data = (await res.json()) as any;
    if (res.status !== 404 || data.success !== false) {
      throw new Error(
        `Expected 404, got ${res.status}: ${JSON.stringify(data)}`,
      );
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
