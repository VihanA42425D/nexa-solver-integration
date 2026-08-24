const ALLOWED_ORIGIN = "https://docs.vsnexa.com";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TICKET_ACTION = "docs_contact";
const TICKET_SENDER = "docs-tickets@tickets.vsnexa.com";
const MAX_BODY_BYTES = 8_192;

const CATEGORIES = new Set([
  "Documentation defect",
  "Broken link or artifact",
  "Integration question",
  "Security report",
  "Other public-docs issue",
]);

class RequestProblem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const jsonResponse = (status, body, extraHeaders = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { ...responseHeaders, ...extraHeaders } },
);

const singleLine = (value, limit) => String(value ?? "")
  .replace(/[\r\n\u0000-\u001f\u007f]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const multiLine = (value, limit) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  .trim()
  .slice(0, limit);

const readJsonBody = async (request) => {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestProblem(413, "Ticket payload is too large.");
  }
  if (!request.body) throw new RequestProblem(400, "Ticket payload is required.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestProblem(413, "Ticket payload is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text);
  } catch {
    throw new RequestProblem(400, "Ticket payload is not valid JSON.");
  }
};

const normalizeTicket = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RequestProblem(400, "Ticket payload must be an object.");
  }

  const ticket = {
    name: singleLine(input.name, 100),
    email: singleLine(input.email, 254).toLowerCase(),
    category: singleLine(input.category, 80),
    affectedUrl: singleLine(input.affectedUrl, 500),
    summary: singleLine(input.summary, 140),
    details: multiLine(input.details, 3_000),
    company: singleLine(input.company, 200),
    consent: input.consent === true,
    turnstileToken: singleLine(input.turnstileToken, 2_048),
  };

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,63}$/i.test(ticket.email)) {
    throw new RequestProblem(400, "A valid reply-to email is required.");
  }
  if (!CATEGORIES.has(ticket.category)) {
    throw new RequestProblem(400, "Select a valid ticket category.");
  }
  if (ticket.summary.length < 5) {
    throw new RequestProblem(400, "Ticket summary is too short.");
  }
  if (ticket.details.length < 20) {
    throw new RequestProblem(400, "Ticket details are too short.");
  }
  if (!ticket.consent) {
    throw new RequestProblem(400, "Confirm that the ticket contains no secrets.");
  }
  if (!ticket.turnstileToken) {
    throw new RequestProblem(400, "Complete the anti-bot check.");
  }
  if (ticket.affectedUrl) {
    let url;
    try {
      url = new URL(ticket.affectedUrl);
    } catch {
      throw new RequestProblem(400, "Affected URL is invalid.");
    }
    if (url.protocol !== "https:") {
      throw new RequestProblem(400, "Affected URL must use HTTPS.");
    }
    ticket.affectedUrl = url.href;
  }

  return ticket;
};

const verifyTurnstile = async (ticket, request, env) => {
  if (!env.TURNSTILE_SECRET) throw new RequestProblem(503, "Ticket service is unavailable.");

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", ticket.turnstileToken);
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) form.set("remoteip", remoteIp);

  let response;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
  } catch {
    throw new RequestProblem(503, "Anti-bot validation is temporarily unavailable.");
  }
  if (!response.ok) throw new RequestProblem(503, "Anti-bot validation is temporarily unavailable.");

  const result = await response.json();
  if (
    result.success !== true
    || result.hostname !== "docs.vsnexa.com"
    || result.action !== TICKET_ACTION
  ) {
    throw new RequestProblem(403, "Anti-bot validation failed.");
  }
};

const ticketId = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `NXDOC-${date}-${suffix}`;
};

const sendTicket = async (ticket, id, env) => {
  if (!env.TICKET_RECIPIENT || !env.TICKET_EMAIL?.send) {
    throw new RequestProblem(503, "Ticket service is unavailable.");
  }

  const text = [
    `Ticket: ${id}`,
    `Category: ${ticket.category}`,
    `Summary: ${ticket.summary}`,
    `Reporter name: ${ticket.name || "Not provided"}`,
    `Reply-to email: ${ticket.email}`,
    `Affected public URL: ${ticket.affectedUrl || "Not provided"}`,
    "",
    "Details:",
    ticket.details,
    "",
    "Submitted through https://docs.vsnexa.com/contact/.",
    "The reporter confirmed that this ticket contains no credentials or private keys.",
  ].join("\r\n");

  try {
    await env.TICKET_EMAIL.send({
      to: env.TICKET_RECIPIENT,
      from: { email: TICKET_SENDER, name: "Nexa Documentation" },
      replyTo: {
        email: ticket.email,
        ...(ticket.name ? { name: ticket.name } : {}),
      },
      subject: `[Nexa Docs Ticket ${id}] ${ticket.category}: ${ticket.summary}`,
      text,
    });
  } catch {
    throw new RequestProblem(503, "Ticket delivery is temporarily unavailable.");
  }
};

export const handleRequest = async (request, env) => {
  const url = new URL(request.url);
  if (url.pathname !== "/api/tickets") {
    return jsonResponse(404, { ok: false, error: "Not found." });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed." }, { Allow: "POST" });
  }
  if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
    return jsonResponse(403, { ok: false, error: "Cross-origin requests are not accepted." });
  }
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") {
    return jsonResponse(403, { ok: false, error: "Cross-site requests are not accepted." });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { ok: false, error: "Content-Type must be application/json." });
  }

  try {
    const rateKey = request.headers.get("CF-Connecting-IP") || "missing-client-address";
    const rate = await env.TICKET_RATE_LIMITER?.limit({ key: rateKey });
    if (!rate?.success) {
      return jsonResponse(429, { ok: false, error: "Too many ticket attempts. Try again later." }, { "Retry-After": "60" });
    }

    const input = await readJsonBody(request);
    const ticket = normalizeTicket(input);

    // Do not spend Turnstile tokens or send mail for bots that fill the trap.
    if (ticket.company) {
      return jsonResponse(202, { ok: true, ticketId: ticketId() });
    }

    await verifyTurnstile(ticket, request, env);
    const id = ticketId();
    await sendTicket(ticket, id, env);
    return jsonResponse(202, { ok: true, ticketId: id });
  } catch (error) {
    const status = error instanceof RequestProblem ? error.status : 500;
    const message = error instanceof RequestProblem && status < 500
      ? error.message
      : "Ticket service is temporarily unavailable.";
    return jsonResponse(status, { ok: false, error: message });
  }
};

export default {
  fetch: handleRequest,
};
