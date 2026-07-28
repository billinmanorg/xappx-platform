import express from "express";
import { randomUUID } from "node:crypto";
import {
  loadConfig, matchRoute, rateRuleFor, serviceBaseUrl, type Config,
} from "./config.js";
import {
  Problem, sendProblem, forbidden, notFound, tooManyRequests, serviceUnavailable,
} from "./errors.js";
import { authenticate } from "./auth.js";
import { TenantDirectory } from "./tenant.js";
import { ProductGate } from "./productGate.js";
import { RateLimiter } from "./rateLimit.js";
import { proxy } from "./proxy.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * The only public surface. Every request runs the same pipeline:
 *   correlation id -> route match -> authenticate -> resolve tenant ->
 *   product gate -> rate limit -> forward identity headers -> proxy.
 *
 * The tenant resolution and product gate are the security-relevant parts and,
 * being auth-adjacent, require a human reviewer. The edge product check is a
 * speed optimisation; the target service checks again at its own boundary.
 */
export function createApp(cfg: Config = loadConfig()) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const directory = new TenantDirectory(cfg);
  const gate = new ProductGate(cfg);
  const limiter = new RateLimiter();

  app.use((req, res, next) => {
    req.correlationId = req.header("X-Correlation-Id") ?? randomUUID();
    res.set("X-Correlation-Id", req.correlationId);
    next();
  });

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.get("/readyz", (_req, res) => res.json({ status: "ready" }));

  // Cache invalidation hook. The outbox relay calls this on
  // com.xappx.application.product.* so a toggle takes effect before the TTL.
  app.post("/_internal/cache/invalidate", (req, res) => {
    gate.invalidate(typeof req.query.slug === "string" ? req.query.slug : undefined);
    res.status(204).end();
  });

  app.use(async (req, res) => {
    try {
      const route = matchRoute(cfg, req.path);
      if (!route) throw notFound(`No route for ${req.method} ${req.path}`);

      const principal = await authenticate((n) => req.header(n), cfg);

      const tenant = await directory.resolve((n) => req.header(n), req.hostname, principal);
      if (!tenant) {
        throw new Problem(
          cfg.tenant.onMissing,
          "No tenant resolved",
          "Could not resolve a brand from the host, X-App-Slug header, or token claim.",
          "https://api.xappx.com/problems/tenant-unresolved",
        );
      }

      if (route.requires_product) {
        const ok = await gate.isEnabled(tenant.slug, route.requires_product);
        if (!ok) {
          throw forbidden(
            `This brand does not have '${route.requires_product}' enabled.`,
            "https://api.xappx.com/problems/product-disabled",
            { product: route.requires_product, app_id: tenant.app_id },
          );
        }
      }

      const rl = rateRuleFor(cfg, req.path);
      const { allowed, resetAt } = limiter.check(`${tenant.app_id}:${route.prefix}`, rl.requests, rl.perMs);
      if (!allowed) {
        throw tooManyRequests("Rate limit exceeded for this brand.", {
          retry_after_ms: Math.max(0, resetAt - Date.now()),
        });
      }

      const base = serviceBaseUrl(route.service);
      if (!base) throw serviceUnavailable(`Service '${route.service}' is not configured.`);

      // Only forward the headers the config names, so nothing else leaks in.
      const candidates: Record<string, string> = {
        "X-Correlation-Id": req.correlationId,
        "X-App-Id": tenant.app_id,
        "X-Client-Id": tenant.client_id,
      };
      if (principal.userId) candidates["X-User-Id"] = principal.userId;
      const allow = new Set(cfg.tenant.forwards.map((h) => h.toLowerCase()));
      const injected: Record<string, string> = {};
      for (const [k, v] of Object.entries(candidates)) {
        if (allow.has(k.toLowerCase())) injected[k] = v;
      }

      await proxy(req, res, base, injected);
    } catch (e) {
      sendProblem(res, e, req.correlationId);
    }
  });

  app.use((err: unknown, req: express.Request, res: express.Response, _n: express.NextFunction) =>
    sendProblem(res, err, req.correlationId),
  );

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const cfg = loadConfig();
  createApp(cfg).listen(cfg.listen, () => console.log(`gateway listening on ${cfg.listen}`));
}
