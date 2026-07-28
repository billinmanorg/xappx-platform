import express from "express";
import pg from "pg";
import { drainOnce } from "./relay.js";
import { routesFor, parseSources } from "./config.js";

/**
 * The outbox relay. One poller per source outbox; a small health endpoint so the
 * platform can watch it. This is delivery infrastructure, not a service that owns
 * data — it reads each source's own outbox, which is exactly what the transactional
 * outbox pattern requires.
 */
if (process.env.NODE_ENV !== "test") {
  const sources = parseSources();
  const intervalMs = Number(process.env.RELAY_INTERVAL_MS ?? 1000);

  for (const source of sources) {
    const pool = new pg.Pool({ connectionString: source.databaseUrl, max: 4 });
    setInterval(() => {
      drainOnce(pool, { routes: routesFor }).catch((e) =>
        console.error(`[relay:${source.name}] drain failed`, e),
      );
    }, intervalMs);
    console.log(`relay draining ${source.name}`);
  }

  const app = express();
  app.get("/healthz", (_req, res) => res.json({ status: "ok", sources: sources.map((s) => s.name) }));
  const port = Number(process.env.RELAY_PORT ?? 8095);
  app.listen(port, () => console.log(`relay health on ${port}, ${sources.length} source(s)`));
}
