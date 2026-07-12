import fs from "node:fs";
import path from "node:path";
import { query } from "./src/db.js";
import { loadEnv } from "./src/env.js";
import { upsertCall } from "./src/store.js";

loadEnv();

async function migrate() {
  await ensureSchema();
  await migrateJsonCalls();
  console.log("Migration complete. PostgreSQL call_logs is ready for Power BI.");
}

async function ensureSchema() {
  const schemaPath = path.join(process.cwd(), "retell database (1).sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await query(schemaSql);
  console.log("Schema checked/created: call_logs");
}

async function migrateJsonCalls() {
  const dataPath = path.join(process.cwd(), "data", "calls.json");
  if (!fs.existsSync(dataPath)) {
    console.log("No data/calls.json found, skipping JSON import.");
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const calls = Array.isArray(jsonData) ? jsonData : jsonData.calls || [];
  console.log(`Starting JSON import of ${calls.length} records...`);

  for (const call of calls) {
    try {
      await upsertCall(call);
    } catch (error) {
      console.error(`Error importing ${call.call_id || call.id || "unknown"}:`, error.message);
    }
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { getPool } = await import("./src/db.js");
    await getPool().end();
  });
