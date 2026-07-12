import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function checkDatabase() {
  try {
    await query("select 1");
    return true;
  } catch {
    return false;
  }
}

function buildPoolConfig() {
  const config = {};

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  } else {
    config.host = process.env.PGHOST || "localhost";
    config.port = Number(process.env.PGPORT || 5432);
    config.database = process.env.PGDATABASE;
    config.user = process.env.PGUSER;
    config.password = process.env.PGPASSWORD;
  }

  if (process.env.PGSSL === "true") {
    config.ssl = { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" };
  }

  return config;
}
