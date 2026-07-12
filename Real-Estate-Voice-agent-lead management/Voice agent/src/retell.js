import crypto from "node:crypto";

const RETELL_API = "https://api.retellai.com/v2";

export async function createRetellPhoneCall(payload) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    const error = new Error("RETELL_API_KEY is missing");
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${RETELL_API}/create-phone-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || "Retell create phone call failed");
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export function verifyRetellSignature(rawBody, signature) {
  const shouldVerify = process.env.VERIFY_RETELL_SIGNATURE !== "false";
  if (!shouldVerify) return true;
  if (!process.env.RETELL_API_KEY || !signature) return false;

  const match = /^v=(\d+),d=(.*)$/.exec(signature);
  if (!match) return false;

  const timestamp = Number(match[1]);
  const digest = match[2];
  if (!Number.isFinite(timestamp)) return false;

  const fiveMinutesMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestamp) > fiveMinutesMs) return false;

  const expected = crypto
    .createHmac("sha256", process.env.RETELL_API_KEY)
    .update(rawBody + match[1])
    .digest("hex");

  if (expected.length !== digest.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(digest));
}

export function buildOutboundPayload(input) {
  const dynamicVariables = {
    owner_name: input.owner_name,
    property_address: input.property_address,
    lead_source: input.lead_source,
    agent_name: input.agent_name
  };

  const payload = {
    from_number: process.env.TWILIO_FROM_NUMBER,
    to_number: input.to_number,
    metadata: {
      trial_app: "dialoft-retell-twilio",
      owner_name: input.owner_name,
      property_address: input.property_address,
      lead_source: input.lead_source
    },
    retell_llm_dynamic_variables: dynamicVariables
  };

  if (process.env.RETELL_AGENT_ID) payload.override_agent_id = process.env.RETELL_AGENT_ID;
  if (process.env.RETELL_AGENT_VERSION) {
    payload.override_agent_version = Number(process.env.RETELL_AGENT_VERSION);
  }

  return payload;
}
