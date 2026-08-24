import assert from "node:assert/strict";
import test from "node:test";
import worker from "../docs-ticket-worker/src/worker.mjs";

const validPayload = (overrides = {}) => ({
  name: "External Integrator",
  email: "solver@example.com",
  category: "Documentation defect",
  affectedUrl: "https://docs.vsnexa.com/quick-start/",
  summary: "Canonical example needs clarification",
  details: "The public example and its explanatory text appear to disagree.",
  company: "",
  consent: true,
  turnstileToken: "valid-single-use-token",
  ...overrides,
});

const ticketRequest = (payload = validPayload(), headers = {}) => new Request(
  "https://docs.vsnexa.com/api/tickets",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://docs.vsnexa.com",
      "Sec-Fetch-Site": "same-origin",
      "CF-Connecting-IP": "192.0.2.10",
      ...headers,
    },
    body: JSON.stringify(payload),
  },
);

const testEnv = (emails, rateSuccess = true) => ({
  TURNSTILE_SECRET: "turnstile-test-secret",
  TICKET_RECIPIENT: "hidden-recipient@example.test",
  TICKET_RATE_LIMITER: {
    async limit() {
      return { success: rateSuccess };
    },
  },
  TICKET_EMAIL: {
    async send(message) {
      emails.push(message);
      return { messageId: "test-message" };
    },
  },
});

const withTurnstile = async (t, result, callback) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    return Response.json(result);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  await callback(() => calls);
};

test("ticket Worker verifies Turnstile and sends one fixed-destination email", { concurrency: false }, async (t) => {
  const emails = [];
  await withTurnstile(t, {
    success: true,
    hostname: "docs.vsnexa.com",
    action: "docs_contact",
  }, async (turnstileCalls) => {
    const response = await worker.fetch(ticketRequest(), testEnv(emails));
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.match(body.ticketId, /^NXDOC-\d{8}-[0-9A-F]{8}$/);
    assert.equal(turnstileCalls(), 1);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, "hidden-recipient@example.test");
    assert.equal(emails[0].from.email, "docs-tickets@tickets.vsnexa.com");
    assert.equal(emails[0].replyTo.email, "solver@example.com");
    assert.match(emails[0].subject, new RegExp(body.ticketId));
    assert.match(emails[0].text, /Canonical example needs clarification/);
    assert.doesNotMatch(JSON.stringify(body), /hidden-recipient/);
  });
});

test("ticket Worker rejects cross-origin requests before rate limit or email", async () => {
  const emails = [];
  let rateCalls = 0;
  const env = testEnv(emails);
  env.TICKET_RATE_LIMITER.limit = async () => {
    rateCalls += 1;
    return { success: true };
  };

  const response = await worker.fetch(
    ticketRequest(validPayload(), { Origin: "https://attacker.example" }),
    env,
  );
  assert.equal(response.status, 403);
  assert.equal(rateCalls, 0);
  assert.equal(emails.length, 0);
});

test("ticket Worker requires canonical Turnstile hostname and action", { concurrency: false }, async (t) => {
  const emails = [];
  await withTurnstile(t, {
    success: true,
    hostname: "attacker.example",
    action: "docs_contact",
  }, async () => {
    const response = await worker.fetch(ticketRequest(), testEnv(emails));
    assert.equal(response.status, 403);
    assert.equal(emails.length, 0);
  });
});

test("ticket Worker absorbs the honeypot without validating or sending", { concurrency: false }, async (t) => {
  const emails = [];
  await withTurnstile(t, {
    success: true,
    hostname: "docs.vsnexa.com",
    action: "docs_contact",
  }, async (turnstileCalls) => {
    const response = await worker.fetch(
      ticketRequest(validPayload({ company: "https://bot.example" })),
      testEnv(emails),
    );
    assert.equal(response.status, 202);
    assert.equal(turnstileCalls(), 0);
    assert.equal(emails.length, 0);
  });
});

test("ticket Worker enforces rate and body-size limits", async () => {
  const emails = [];
  const limited = await worker.fetch(ticketRequest(), testEnv(emails, false));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");

  const oversized = await worker.fetch(
    ticketRequest(validPayload(), { "Content-Length": "9000" }),
    testEnv(emails),
  );
  assert.equal(oversized.status, 413);
  assert.equal(emails.length, 0);
});

test("ticket Worker strips header control characters from user input", { concurrency: false }, async (t) => {
  const emails = [];
  await withTurnstile(t, {
    success: true,
    hostname: "docs.vsnexa.com",
    action: "docs_contact",
  }, async () => {
    const response = await worker.fetch(
      ticketRequest(validPayload({ summary: "Valid summary\r\nBcc: victim@example.com" })),
      testEnv(emails),
    );
    assert.equal(response.status, 202);
    assert.equal(emails.length, 1);
    assert.doesNotMatch(emails[0].subject, /[\r\n]/);
  });
});
