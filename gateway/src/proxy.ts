import type { Request, Response } from "express";
import { badGateway } from "./errors.js";

// Hop-by-hop headers are per-connection and must not be forwarded. Host and
// content-length are re-derived by the upstream fetch from the new request.
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
]);

/**
 * Forward the request to the resolved service and stream the response back,
 * injecting the identity headers the gateway derived. Bodies are JSON on this
 * platform, so express.json has already parsed the request; it is re-serialised
 * for the upstream call.
 */
export async function proxy(
  req: Request,
  res: Response,
  baseUrl: string,
  injected: Record<string, string>,
): Promise<void> {
  // Drop any incoming header the gateway will inject, so a client cannot spoof
  // X-App-Id / X-User-Id / X-Correlation-Id and cannot cause a duplicated header.
  const injectedLower = new Set(Object.keys(injected).map((k) => k.toLowerCase()));
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (typeof v === "string" && !HOP_BY_HOP.has(lk) && !injectedLower.has(lk)) headers[k] = v;
  }
  for (const [k, v] of Object.entries(injected)) headers[k] = v;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  if (hasBody) headers["content-type"] = "application/json";

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(baseUrl + req.originalUrl, {
      method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw badGateway("The upstream service did not respond.");
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) res.setHeader(key, value);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
