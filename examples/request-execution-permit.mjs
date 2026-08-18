const baseUrl = process.env.NEXA_SOLVER_BASE_URL ?? "https://solver.vsnexa.com";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const idempotencyKey = process.env.NEXA_IDEMPOTENCY_KEY ?? `solver-${Date.now()}`;
const request = {
  quoteId: required("NEXA_QUOTE_ID"),
  requestedAmountInRaw: required("NEXA_REQUESTED_AMOUNT_IN_RAW"),
  standard: process.env.NEXA_STANDARD ?? "DIRECT",
  payer: required("NEXA_PAYER"),
  recipient: required("NEXA_RECIPIENT"),
  idempotencyKey,
};

async function post(path, body) {
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${value.error ?? response.statusText}`);
  return value;
}

const messageResult = await post("/api/v6/execution-permits/request-message", request);
const requestSignature = String(process.env.NEXA_REQUEST_SIGNATURE ?? "").trim();
if (!requestSignature) {
  console.log(JSON.stringify({
    next: "Sign the exact message with the Source wallet, then rerun with NEXA_REQUEST_SIGNATURE set.",
    idempotencyKey,
    message: messageResult.message,
    request,
  }, null, 2));
  process.exit(0);
}

const permit = await post("/api/v6/execution-permits", {
  ...request,
  requestSignature,
});
console.log(JSON.stringify(permit, null, 2));
