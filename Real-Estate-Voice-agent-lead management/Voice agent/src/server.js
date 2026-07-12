import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { checkDatabase } from "./db.js";
import { loadEnv } from "./env.js";
import {
  appendEvent,
  appendToolCall,
  deleteCall,
  getCall,
  listCalls,
  updateCall,
  upsertCall
} from "./store.js";
import { buildOutboundPayload, createRetellPhoneCall, verifyRetellSignature } from "./retell.js";

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(process.cwd(), "public");

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/config") {
      return sendJson(res, 200, {
        hasRetellKey: Boolean(process.env.RETELL_API_KEY),
        hasFromNumber: Boolean(process.env.TWILIO_FROM_NUMBER),
        hasAgentId: Boolean(process.env.RETELL_AGENT_ID),
        hasDatabaseConfig: Boolean(
          process.env.DATABASE_URL || (process.env.PGDATABASE && process.env.PGUSER)
        ),
        postgresConnected: await checkDatabase(),
        fromNumber: maskPhone(process.env.TWILIO_FROM_NUMBER),
        publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
        verifyRetellSignature: process.env.VERIFY_RETELL_SIGNATURE !== "false"
      });
    }

    if (req.method === "GET" && url.pathname === "/api/calls") {
      return sendJson(res, 200, { calls: await listCalls() });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/calls/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/calls/", ""));
      const call = await getCall(id);
      return call ? sendJson(res, 200, { call }) : sendJson(res, 404, { error: "Call not found" });
    }

    if (req.method === "POST" && url.pathname === "/api/calls") {
      const body = await readJson(req);
      validateOutboundInput(body);

      const payload = buildOutboundPayload(body);
      if (!payload.from_number) {
        return sendJson(res, 400, { error: "TWILIO_FROM_NUMBER is missing in .env" });
      }

      const retellCall = await createRetellPhoneCall(payload);
      const callId = retellCall.call_id;
      const call = await upsertCall({
        id: callId,
        call_id: callId,
        status: retellCall.call_status || "registered",
        from_number: payload.from_number,
        to_number: payload.to_number,
        owner_name: body.owner_name,
        property_address: body.property_address,
        lead_source: body.lead_source,
        agent_name: body.agent_name,
        dynamic_variables: payload.retell_llm_dynamic_variables,
        retell: retellCall
      });

      return sendJson(res, 201, { call });
    }

    if (
      (req.method === "PUT" || req.method === "PATCH") &&
      url.pathname.startsWith("/api/calls/")
    ) {
      const id = decodeURIComponent(url.pathname.replace("/api/calls/", ""));
      const body = await readJson(req);
      const call = await updateCall(id, normalizeEditableCallFields(body));
      return call ? sendJson(res, 200, { call }) : sendJson(res, 404, { error: "Call not found" });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/calls/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/calls/", ""));
      const deleted = await deleteCall(id);
      return deleted ? sendJson(res, 204, null) : sendJson(res, 404, { error: "Call not found" });
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/retell") {
      const rawBody = await readBody(req);
      if (!verifyRetellSignature(rawBody, req.headers["x-retell-signature"])) {
        return sendJson(res, 401, { error: "Invalid Retell signature" });
      }

      const payload = JSON.parse(rawBody || "{}");
      const call = payload.call || {};
      const callId = call.call_id;
      if (!callId) return sendJson(res, 400, { error: "Missing call.call_id" });

      await appendEvent(callId, {
        event: payload.event || "unknown",
        received_at: new Date().toISOString()
      });

      await upsertCall({
        id: callId,
        call_id: callId,
        status: call.call_status || payload.event,
        from_number: call.from_number,
        to_number: call.to_number,
        agent_id: call.agent_id,
        agent_name: call.retell_llm_dynamic_variables?.agent_name || call.agent_name,
        dynamic_variables: call.retell_llm_dynamic_variables,
        transcript: call.transcript,
        transcript_object: call.transcript_object,
        transcript_with_tool_calls: call.transcript_with_tool_calls,
        analysis: call.call_analysis || call.custom_analysis_data,
        recording_url: call.recording_url,
        start_timestamp: call.start_timestamp,
        end_timestamp: call.end_timestamp,
        disconnection_reason: call.disconnection_reason,
        last_webhook_payload: payload
      });

      return sendJson(res, 204, null);
    }

    if (req.method === "POST" && url.pathname === "/api/tools/property-estimate") {
      const rawBody = await readBody(req);
      if (!verifyRetellSignature(rawBody, req.headers["x-retell-signature"])) {
        return sendJson(res, 401, { error: "Invalid Retell signature" });
      }

      const payload = JSON.parse(rawBody || "{}");
      const args = payload.args || payload;
      const callId = payload.call?.call_id || args.call_id || "unknown";
      const estimate = buildPropertyEstimate(args.property_address);

      await appendToolCall(callId, {
        name: "get_property_estimate",
        args,
        response: estimate,
        created_at: new Date().toISOString()
      });

      return sendJson(res, 200, estimate);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, {
      error: error.message || "Server error",
      details: error.details
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dialoft trial app running at http://${HOST}:${PORT}`);
});

function validateOutboundInput(body) {
  const required = ["to_number", "owner_name", "property_address", "lead_source", "agent_name"];
  for (const key of required) {
    if (!body[key] || typeof body[key] !== "string") {
      const error = new Error(`${key} is required`);
      error.status = 400;
      throw error;
    }
  }
  if (!/^\+\d{8,15}$/.test(body.to_number)) {
    const error = new Error("to_number must be E.164, for example +14155550123");
    error.status = 400;
    throw error;
  }
}

function normalizeEditableCallFields(body) {
  const allowed = [
    "owner_name",
    "phone",
    "to_number",
    "from_number",
    "property_address",
    "lead_source",
    "agent_name",
    "status",
    "call_status",
    "duration_seconds",
    "interest_level",
    "qualified",
    "sell_timeline",
    "motivation",
    "objections",
    "follow_up_required",
    "property_estimate",
    "transcript",
    "transcript_key_points",
    "summary",
    "sentiment",
    "recording_url",
    "analysis",
    "tool_calls",
    "start_timestamp",
    "end_timestamp"
  ];
  return Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, body[key]]));
}

function buildPropertyEstimate(address = "the property") {
  const seed = [...address].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const low = 420000 + (seed % 9) * 15000;
  const high = low + 45000 + (seed % 4) * 10000;
  const comps = 4 + (seed % 5);
  const dom = 18 + (seed % 24);

  return {
    property_address: address,
    estimated_value_range: `$${low.toLocaleString()} to $${high.toLocaleString()}`,
    comparable_recent_sales: comps,
    average_days_on_market: dom,
    talking_point: `Based on ${comps} recent comparable sales near ${address}, homes like this are trending around $${low.toLocaleString()} to $${high.toLocaleString()}, with an average of ${dom} days on market.`
  };
}

async function readJson(req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  if (status === 204) return res.end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function serveStatic(requestPath, res) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendJson(res, 404, { error: "Not found" });
  }

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

function maskPhone(phone = "") {
  if (!phone) return "";
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}
