// Migrate + seed for a hosted deploy. Idempotent and safe to run on every boot
// (the platform's start command does exactly that): it applies every file in
// db/migrations that hasn't run yet, tracked in a schema_migrations table, each
// in its own transaction. On a brand-new database it also runs seed.sql once.
// This is a deploy helper — it does not change the service's behaviour or tests.
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
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
const dir = fileURLToPath(new URL("./db/", import.meta.url));

await client.connect();
try {
  await client.query(
    `create table if not exists schema_migrations (
       filename   text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  // A fresh database (no applications table) has never been seeded. Detect that
  // now, before recording any migration, so we seed exactly once on first boot.
  const fresh = !(await client.query("select to_regclass('public.applications') as t")).rows[0].t;

  const applied = new Set(
    (await client.query("select filename from schema_migrations")).rows.map((r) => r.filename),
  );
  const files = readdirSync(dir + "migrations").filter((f) => f.endsWith(".sql")).sort();

  // A database created before schema_migrations existed already has the init
  // migration's objects but no record of them. Re-running the init would fail on
  // the existing tables, so baseline it (record without executing) and let the
  // loop apply only the genuinely-new migrations after it.
  if (!fresh && files.length && !applied.has(files[0])) {
    console.log(`migrate: baselining ${files[0]} (schema already present)`);
    await client.query("insert into schema_migrations (filename) values ($1) on conflict do nothing", [files[0]]);
    applied.add(files[0]);
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`migrate: applying ${file}`);
    await client.query("begin");
    try {
      await client.query(readFileSync(dir + "migrations/" + file, "utf8"));
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }

  if (fresh) {
    console.log("migrate: seeding a fresh database");
    await client.query(readFileSync(dir + "seed.sql", "utf8"));
  }
  console.log("migrate: done");
} finally {
  await client.end();
}
