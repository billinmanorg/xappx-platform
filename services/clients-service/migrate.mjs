// One-shot migrate + seed for a hosted deploy. Idempotent: it applies
// 0001_init.sql and seed.sql only if the schema isn't there yet, so it is safe
// to run on every boot (the platform's start command does exactly that). This is
// a deploy helper — it does not change the service's behaviour or its tests.
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

// TLS off by default — matches the service's own pool and Render's internal
// database network. Set PGSSL=require if you point this at an external URL.
const ssl = process.env.PGSSL === "require" ? { rejectUnauthorized: false } : false;
const client = new pg.Client({ connectionString: url, ssl });

await client.connect();
try {
  const { rows } = await client.query("select to_regclass('public.applications') as t");
  if (rows[0].t) {
    console.log("migrate: schema already present — nothing to do");
  } else {
    const dir = fileURLToPath(new URL("./db/", import.meta.url));
    console.log("migrate: applying 0001_init.sql");
    await client.query(readFileSync(dir + "migrations/0001_init.sql", "utf8"));
    console.log("migrate: applying seed.sql");
    await client.query(readFileSync(dir + "seed.sql", "utf8"));
    console.log("migrate: done");
  }
} finally {
  await client.end();
}
