let calls = [];
let selectedId = null;
let config = {};

const el = {
  configStatus: document.querySelector("#configStatus"),
  callForm: document.querySelector("#callForm"),
  submitBtn: document.querySelector("#submitBtn"),
  formNote: document.querySelector("#formNote"),
  callList: document.querySelector("#callList"),
  refreshBtn: document.querySelector("#refreshBtn"),
  deleteCallBtn: document.querySelector("#deleteCallBtn"),
  metricTotal: document.querySelector("#metricTotal"),
  metricQualified: document.querySelector("#metricQualified"),
  metricSentiment: document.querySelector("#metricSentiment"),
  metricTools: document.querySelector("#metricTools"),
  detailTitle: document.querySelector("#detailTitle"),
  detailStatus: document.querySelector("#detailStatus"),
  emptyState: document.querySelector("#emptyState"),
  detailBody: document.querySelector("#detailBody"),
  infoGrid: document.querySelector("#infoGrid"),
  transcript: document.querySelector("#tab-transcript"),
  analysis: document.querySelector("#tab-analysis"),
  tools: document.querySelector("#tab-tools"),
  setup: document.querySelector("#tab-setup")
};

await init();

async function init() {
  config = await fetchJson("/api/config");
  renderConfig();
  await loadCalls();
  setInterval(loadCalls, 3500);
}

el.callForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.submitBtn.disabled = true;
  el.formNote.textContent = "Starting the Retell outbound call...";

  try {
    const body = Object.fromEntries(new FormData(el.callForm).entries());
    const response = await fetchJson("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    selectedId = response.call.call_id;
    el.formNote.textContent = "Call registered. Waiting for Retell webhook updates.";
    await loadCalls();
  } catch (error) {
    el.formNote.textContent = error.message;
  } finally {
    el.submitBtn.disabled = false;
  }
});

el.refreshBtn.addEventListener("click", loadCalls);

el.deleteCallBtn.addEventListener("click", async () => {
  if (!selectedId) return;
  const call = calls.find((item) => item.call_id === selectedId);
  const label = call?.owner_name || call?.call_id || "this call";
  if (!confirm(`Delete ${label}? This also removes it from PostgreSQL.`)) return;

  el.deleteCallBtn.disabled = true;
  try {
    await fetchJson(`/api/calls/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
    selectedId = null;
    await loadCalls();
  } catch (error) {
    alert(error.message);
  } finally {
    el.deleteCallBtn.disabled = false;
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((item) => item.classList.add("hidden"));
    tab.classList.add("active");
    document.querySelector(`#tab-${tab.dataset.tab}`).classList.remove("hidden");
  });
});

async function loadCalls() {
  const response = await fetchJson("/api/calls");
  calls = response.calls || [];
  if (!selectedId && calls[0]) selectedId = calls[0].call_id;
  renderCalls();
  renderMetrics();
  renderDetail();
}

function renderConfig() {
  const chips = [
    chip(config.hasRetellKey, "Retell key"),
    chip(config.hasFromNumber, `From ${config.fromNumber || "missing"}`),
    chip(config.hasAgentId, "Agent override"),
    chip(config.postgresConnected, "PostgreSQL"),
    chip(config.verifyRetellSignature, "Signature check")
  ];
  el.configStatus.innerHTML = chips.join("");

  const base = config.publicBaseUrl || "https://your-ngrok-url";
  el.setup.innerHTML = setupHtml(base);
}

function chip(ok, label) {
  return `<span class="status-chip ${ok ? "" : "warn"}">${escapeHtml(label)}</span>`;
}

function renderCalls() {
  if (!calls.length) {
    el.callList.innerHTML = `<div class="empty-state">No calls yet.</div>`;
    return;
  }

  el.callList.innerHTML = calls
    .map((call) => {
      const active = call.call_id === selectedId ? "active" : "";
      return `
        <button class="call-row ${active}" data-call-id="${escapeHtml(call.call_id)}">
          <strong>${escapeHtml(call.owner_name || call.dynamic_variables?.owner_name || "Unknown owner")}</strong>
          <span>${escapeHtml(call.property_address || call.dynamic_variables?.property_address || call.to_number || "")}</span>
          <span>${escapeHtml(call.status || "created")} · ${formatDate(call.created_at)}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".call-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectedId = row.dataset.callId;
      renderCalls();
      renderDetail();
    });
  });
}

function renderMetrics() {
  const total = calls.length;
  const qualified = calls.filter((call) => analysisValue(call, "qualified") === "yes").length;
  const positive = calls.filter((call) => analysisValue(call, "call_sentiment") === "positive").length;
  const tools = calls.reduce((sum, call) => sum + (call.tool_calls?.length || 0), 0);

  el.metricTotal.textContent = total;
  el.metricQualified.textContent = total ? `${Math.round((qualified / total) * 100)}%` : "0%";
  el.metricSentiment.textContent = positive;
  el.metricTools.textContent = tools;
}

function renderDetail() {
  const call = calls.find((item) => item.call_id === selectedId);
  if (!call) {
    el.emptyState.classList.remove("hidden");
    el.detailBody.classList.add("hidden");
    el.deleteCallBtn.classList.add("hidden");
    return;
  }

  el.emptyState.classList.add("hidden");
  el.detailBody.classList.remove("hidden");
  el.deleteCallBtn.classList.remove("hidden");
  el.detailTitle.textContent = call.owner_name || call.dynamic_variables?.owner_name || "Call detail";
  el.detailStatus.textContent = call.status || "created";

  el.infoGrid.innerHTML = [
    ["Call ID", call.call_id],
    ["To", call.to_number],
    ["From", call.from_number],
    ["Lead source", call.lead_source || call.dynamic_variables?.lead_source],
    ["Agent", call.agent_name || call.dynamic_variables?.agent_name],
    ["Address", call.property_address || call.dynamic_variables?.property_address]
  ]
    .map(([label, value]) => infoItem(label, value || "Waiting for webhook"))
    .join("");

  renderTranscript(call);
  renderAnalysis(call);
  renderTools(call);
}

function renderTranscript(call) {
  const turns = call.transcript_with_tool_calls || call.transcript_object || [];
  if (!turns.length && call.transcript) {
    el.transcript.innerHTML = `<pre>${escapeHtml(call.transcript)}</pre>`;
    return;
  }

  if (!turns.length) {
    el.transcript.innerHTML = `<div class="empty-state">Transcript has not arrived yet.</div>`;
    return;
  }

  el.transcript.innerHTML = `
    <div class="transcript">
      ${turns
        .map((turn) => {
          const role = turn.role || "event";
          const content = turn.content || turn.arguments || turn.name || JSON.stringify(turn);
          return `
            <div class="turn ${escapeHtml(role)}">
              <b>${escapeHtml(role.replaceAll("_", " "))}</b>
              <div>${escapeHtml(content)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAnalysis(call) {
  const analysis = call.analysis?.custom_analysis_data || call.analysis || {};
  if (!Object.keys(analysis).length) {
    el.analysis.innerHTML = `<div class="empty-state">Post-call analysis appears after Retell sends call_analyzed.</div>`;
    return;
  }

  el.analysis.innerHTML = `
    <div class="analysis-grid">
      ${Object.entries(analysis)
        .map(([key, value]) => infoItem(key.replaceAll("_", " "), stringifyValue(value)))
        .join("")}
    </div>
  `;
}

function renderTools(call) {
  if (!call.tool_calls?.length) {
    el.tools.innerHTML = `<div class="empty-state">The property estimate tool has not been called yet.</div>`;
    return;
  }

  el.tools.innerHTML = call.tool_calls
    .map(
      (tool) => `
        <div class="turn tool_call_result">
          <b>${escapeHtml(tool.name)}</b>
          <pre>${escapeHtml(JSON.stringify(tool.response, null, 2))}</pre>
        </div>
      `
    )
    .join("");
}

function setupHtml(base) {
  return `
    <div class="setup-list">
      <div>
        <strong>Retell webhook URL</strong>
        <code>${escapeHtml(base)}/api/webhooks/retell</code>
      </div>
      <div>
        <strong>Custom function URL</strong>
        <code>${escapeHtml(base)}/api/tools/property-estimate</code>
      </div>
      <div>
        <strong>Custom function schema</strong>
        <code>{"type":"object","required":["property_address"],"properties":{"property_address":{"type":"string","description":"The homeowner property address"},"call_id":{"type":"string","description":"Retell call id if available"}}}</code>
      </div>
      <div>
        <strong>Dynamic variables</strong>
        <code>{{owner_name}}, {{property_address}}, {{lead_source}}, {{agent_name}}</code>
      </div>
    </div>
  `;
}

function analysisValue(call, key) {
  return call.analysis?.custom_analysis_data?.[key] || call.analysis?.[key];
}

function infoItem(label, value) {
  return `
    <div class="info-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value) {
  if (!value) return "now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
