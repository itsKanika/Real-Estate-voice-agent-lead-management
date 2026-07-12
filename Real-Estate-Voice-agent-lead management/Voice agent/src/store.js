import { query } from "./db.js";

const SELECT_COLUMNS = `
  id,
  call_id,
  owner_name,
  phone,
  from_number,
  property_address,
  lead_source,
  agent_name,
  call_status,
  duration_seconds,
  interest_level,
  qualified,
  sell_timeline,
  motivation,
  objections,
  follow_up_required,
  property_estimate,
  transcript,
  transcript_key_points,
  summary,
  sentiment,
  recording_url,
  analysis,
  tool_calls,
  start_timestamp,
  end_timestamp,
  created_at,
  updated_at
`;

export async function listCalls() {
  const result = await query(
    `select ${SELECT_COLUMNS}
     from call_logs
     order by created_at desc, id desc`
  );
  return result.rows.map(mapRowToCall);
}

export async function getCall(id) {
  const result = await query(
    `select ${SELECT_COLUMNS}
     from call_logs
     where call_id = $1 or id::text = $1
     limit 1`,
    [id]
  );
  return result.rows[0] ? mapRowToCall(result.rows[0]) : null;
}

export async function upsertCall(partial) {
  const callId = partial.call_id || partial.id;
  if (!callId) {
    const error = new Error("call_id is required");
    error.status = 400;
    throw error;
  }

  const existing = await getCall(callId);
  const next = mergeCall(existing, partial, callId);
  const result = await query(
    `
      insert into call_logs (
        call_id,
        owner_name,
        phone,
        from_number,
        property_address,
        lead_source,
        agent_name,
        call_status,
        duration_seconds,
        interest_level,
        qualified,
        sell_timeline,
        motivation,
        objections,
        follow_up_required,
        property_estimate,
        transcript,
        transcript_key_points,
        summary,
        sentiment,
        recording_url,
        analysis,
        tool_calls,
        start_timestamp,
        end_timestamp,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22::jsonb, $23::jsonb, $24, $25,
        coalesce($26, current_timestamp), current_timestamp
      )
      on conflict (call_id) do update set
        owner_name = coalesce(excluded.owner_name, call_logs.owner_name),
        phone = coalesce(excluded.phone, call_logs.phone),
        from_number = coalesce(excluded.from_number, call_logs.from_number),
        property_address = coalesce(excluded.property_address, call_logs.property_address),
        lead_source = coalesce(excluded.lead_source, call_logs.lead_source),
        agent_name = coalesce(excluded.agent_name, call_logs.agent_name),
        call_status = coalesce(excluded.call_status, call_logs.call_status),
        duration_seconds = coalesce(excluded.duration_seconds, call_logs.duration_seconds),
        interest_level = coalesce(excluded.interest_level, call_logs.interest_level),
        qualified = coalesce(excluded.qualified, call_logs.qualified),
        sell_timeline = coalesce(excluded.sell_timeline, call_logs.sell_timeline),
        motivation = coalesce(excluded.motivation, call_logs.motivation),
        objections = coalesce(excluded.objections, call_logs.objections),
        follow_up_required = coalesce(excluded.follow_up_required, call_logs.follow_up_required),
        property_estimate = coalesce(excluded.property_estimate, call_logs.property_estimate),
        transcript = coalesce(excluded.transcript, call_logs.transcript),
        transcript_key_points = coalesce(excluded.transcript_key_points, call_logs.transcript_key_points),
        summary = coalesce(excluded.summary, call_logs.summary),
        sentiment = coalesce(excluded.sentiment, call_logs.sentiment),
        recording_url = coalesce(excluded.recording_url, call_logs.recording_url),
        analysis = coalesce(excluded.analysis, call_logs.analysis),
        tool_calls = coalesce(excluded.tool_calls, call_logs.tool_calls),
        start_timestamp = coalesce(excluded.start_timestamp, call_logs.start_timestamp),
        end_timestamp = coalesce(excluded.end_timestamp, call_logs.end_timestamp),
        updated_at = current_timestamp
      returning ${SELECT_COLUMNS}
    `,
    [
      callId,
      next.owner_name,
      next.to_number || next.phone,
      next.from_number,
      next.property_address,
      next.lead_source,
      next.agent_name,
      next.status || next.call_status,
      next.duration_seconds,
      next.interest_level,
      next.qualified,
      next.sell_timeline,
      next.motivation,
      next.objections,
      next.follow_up_required,
      next.property_estimate,
      next.transcript,
      next.transcript_key_points,
      next.summary,
      next.sentiment,
      next.recording_url,
      JSON.stringify(next.analysis || {}),
      JSON.stringify(next.tool_calls || []),
      toTimestamp(next.start_timestamp),
      toTimestamp(next.end_timestamp),
      toTimestamp(next.created_at)
    ]
  );

  return mapRowToCall(result.rows[0]);
}

export async function updateCall(id, patch) {
  const existing = await getCall(id);
  if (!existing) return null;
  return upsertCall({ ...patch, id: existing.call_id, call_id: existing.call_id });
}

export async function deleteCall(id) {
  const result = await query(
    "delete from call_logs where call_id = $1 or id::text = $1 returning call_id",
    [id]
  );
  return result.rowCount > 0;
}

export async function appendEvent(callId, event) {
  const existing = await getCall(callId);
  const events = [...(existing?.events || []), event];
  return upsertCall({ id: existing?.call_id || callId, call_id: callId, events });
}

export async function appendToolCall(callId, toolCall) {
  const existing = await getCall(callId);
  const tool_calls = [...(existing?.tool_calls || []), toolCall];
  return upsertCall({
    id: existing?.call_id || callId,
    call_id: callId,
    tool_calls,
    property_estimate: toolCall.response?.estimated_value_range || existing?.property_estimate
  });
}

function mergeCall(existing, partial, callId) {
  const dynamic = partial.dynamic_variables || existing?.dynamic_variables || {};
  const analysis = buildAnalysis(existing?.analysis, partial);
  const qualified = partial.qualified || analysis.qualified || existing?.qualified;
  const sellTimeline = partial.sell_timeline || analysis.sell_timeline || existing?.sell_timeline;
  const motivation = partial.motivation || analysis.motivation || existing?.motivation;
  const objections = partial.objections || analysis.objections || existing?.objections;
  const followUpRequired = toBoolean(
    partial.follow_up_required ?? analysis.follow_up_required ?? existing?.follow_up_required
  );
  const sentiment = partial.sentiment || analysis.call_sentiment || analysis.sentiment || existing?.sentiment;
  const summary = partial.summary || analysis.call_summary || analysis.summary || existing?.summary;

  const next = {
    ...existing,
    id: callId,
    call_id: callId,
    ...partial,
    owner_name: partial.owner_name || dynamic.owner_name || existing?.owner_name,
    property_address: partial.property_address || dynamic.property_address || existing?.property_address,
    lead_source: partial.lead_source || dynamic.lead_source || existing?.lead_source,
    agent_name: partial.agent_name || dynamic.agent_name || existing?.agent_name,
    to_number: partial.to_number || partial.phone || existing?.to_number,
    from_number: partial.from_number || existing?.from_number,
    status: partial.status || partial.call_status || existing?.status || "created",
    analysis,
    tool_calls: partial.tool_calls || existing?.tool_calls || [],
    events: partial.events || existing?.events || [],
    dynamic_variables: dynamic,
    duration_seconds: partial.duration_seconds || durationSeconds(partial, existing),
    qualified,
    sell_timeline: sellTimeline,
    motivation,
    objections,
    follow_up_required: followUpRequired,
    interest_level: partial.interest_level || qualified || existing?.interest_level,
    summary,
    sentiment
  };

  next.transcript_key_points =
    normalizeKeyPointText(partial.transcript_key_points) ||
    normalizeKeyPointText(analysis.transcript_key_points || analysis.key_points || analysis.key_takeaways) ||
    deriveTranscriptKeyPoints(next);

  return next;
}

function buildAnalysis(existingAnalysis = {}, partial = {}) {
  const rawAnalysis = partial.analysis || {};
  const customAnalysis = rawAnalysis.custom_analysis_data || {};
  return stripUndefined({
    ...existingAnalysis,
    ...rawAnalysis,
    ...customAnalysis,
    ...(Object.keys(customAnalysis).length ? { custom_analysis_data: customAnalysis } : {}),
    ...(partial.dynamic_variables ? { dynamic_variables: partial.dynamic_variables } : {}),
    ...(partial.transcript_object ? { transcript_object: partial.transcript_object } : {}),
    ...(partial.transcript_with_tool_calls
      ? { transcript_with_tool_calls: partial.transcript_with_tool_calls }
      : {}),
    ...(partial.events ? { events: partial.events } : {}),
    ...(partial.disconnection_reason ? { disconnection_reason: partial.disconnection_reason } : {}),
    ...(partial.retell ? { retell: partial.retell } : {}),
    ...(partial.last_webhook_payload ? { last_webhook_payload: partial.last_webhook_payload } : {})
  });
}

function mapRowToCall(row) {
  const analysis = row.analysis || {};
  return {
    id: row.call_id || String(row.id),
    database_id: row.id,
    call_id: row.call_id,
    owner_name: row.owner_name,
    phone: row.phone,
    to_number: row.phone,
    from_number: row.from_number,
    property_address: row.property_address,
    lead_source: row.lead_source,
    agent_name: row.agent_name,
    status: row.call_status,
    call_status: row.call_status,
    duration_seconds: row.duration_seconds,
    interest_level: row.interest_level,
    qualified: row.qualified,
    sell_timeline: row.sell_timeline,
    motivation: row.motivation,
    objections: row.objections,
    follow_up_required: row.follow_up_required,
    property_estimate: row.property_estimate,
    transcript: row.transcript,
    transcript_key_points: row.transcript_key_points,
    transcript_object: analysis.transcript_object || [],
    transcript_with_tool_calls: analysis.transcript_with_tool_calls || [],
    summary: row.summary,
    sentiment: row.sentiment,
    recording_url: row.recording_url,
    analysis,
    dynamic_variables: analysis.dynamic_variables || {},
    events: analysis.events || [],
    tool_calls: row.tool_calls || [],
    start_timestamp: row.start_timestamp,
    end_timestamp: row.end_timestamp,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function deriveTranscriptKeyPoints(call) {
  const points = [
    call.summary && `Summary: ${call.summary}`,
    call.qualified && `Qualified: ${call.qualified}`,
    call.sell_timeline && `Selling timeline: ${call.sell_timeline}`,
    call.motivation && `Motivation: ${call.motivation}`,
    call.objections && `Objections: ${call.objections}`,
    call.follow_up_required !== undefined && call.follow_up_required !== null
      ? `Follow-up required: ${call.follow_up_required ? "yes" : "no"}`
      : null,
    call.sentiment && `Sentiment: ${call.sentiment}`
  ].filter(Boolean);

  if (!points.length && call.transcript) {
    points.push(...extractTranscriptHighlights(call.transcript));
  }

  return points.map((point) => `- ${point}`).join("\n") || undefined;
}

function extractTranscriptHighlights(transcript) {
  return String(transcript)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.replace(/^\s*(agent|user|assistant|customer|homeowner)\s*:\s*/i, "").trim())
    .filter((line) => line.length >= 30)
    .slice(0, 5);
}

function normalizeKeyPointText(value) {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .filter(Boolean)
      .map((item) => (item.startsWith("-") ? item : `- ${item}`))
      .join("\n");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim() || undefined;
}

function durationSeconds(partial, existing) {
  if (partial.duration_seconds) return partial.duration_seconds;
  const start = toDate(partial.start_timestamp || existing?.start_timestamp);
  const end = toDate(partial.end_timestamp || existing?.end_timestamp);
  if (!start || !end) return existing?.duration_seconds;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function toTimestamp(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value > 9999999999 ? value : value * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.toLowerCase());
  return Boolean(value);
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
