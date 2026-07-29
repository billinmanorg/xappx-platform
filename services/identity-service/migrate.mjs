// One-shot migrate for a hosted deploy. Applies each migration only if its table
// is missing, so it is safe on every boot (the start command runs it before the
// server). A deploy helper — it does not change the service's behaviour or tests.
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

// TLS off by default — matches the service's pool and Render's internal network.
// Set PGSSL=require when pointing at an external database URL.
const ssl = process.env.PGSSL === "require" ? { rejectUnauthorized: false } : false;
const client = new pg.Client({ connectionString: url, ssl });
const dir = fileURLToPath(new URL("./db/migrations/", import.meta.url));

async function applyIfMissing(regclass, file) {
  const { rows } = await client.query("select to_regclass($1) as t", [regclass]);
  if (rows[0].t) {
    console.log(`migrate: ${regclass} present — skip ${file}`);
    return;
  }
  console.log(`migrate: applying ${file}`);
  await client.query(readFileSync(dir + file, "utf8"));
}

await client.connect();
try {
  await applyIfMissing("public.users", "0001_init.sql");
  await applyIfMissing("public.consumed_events", "0002_consumed_events.sql");
  await applyIfMissing("public.credentials", "0003_credentials.sql");
  console.log("migrate: done");
} finally {
  await client.end();
}
