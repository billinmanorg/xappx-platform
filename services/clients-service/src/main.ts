import express from "express";
import { randomUUID } from "node:crypto";
import { pool } from "./db.js";
import { Problem, sendProblem } from "./errors.js";
import { clients } from "./routes/clients.js";
import { applications } from "./routes/applications.js";
import { products } from "./routes/products.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // One id follows a request across every service it touches. Without it,
  // debugging a fifteen-service estate is guesswork.
  app.use((req, res, next) => {
    req.correlationId = req.header("X-Correlation-Id") ?? randomUUID();
    res.set("X-Correlation-Id", req.correlationId);
    next();
  });

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.get("/readyz", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not ready", reason: "database unreachable" });
    }
  });

  app.use("/api/v1", clients, applications, products);

  app.use((req, res) =>
    sendProblem(res, new Problem(404, "Not found", `No route for ${req.method} ${req.path}`), req.correlationId),
  );
  app.use((err: unknown, req: express.Request, res: express.Response, _n: express.NextFunction) =>
    sendProblem(res, err, req.correlationId),
  );

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 8081);
  createApp().listen(port, () => console.log(`clients-service listening on ${port}`));
}
