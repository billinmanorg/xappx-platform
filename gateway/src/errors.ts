/** RFC 9457 problem documents. Every error the gateway returns is one of these. */
import type { Response } from "express";

export class Problem extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
    readonly type = "about:blank",
    readonly extra: Record<string, unknown> = {},
  ) {
    super(detail ?? title);
  }
}

export const badRequest = (detail: string, extra?: Record<string, unknown>) =>
  new Problem(400, "Invalid request", detail, "https://api.xappx.com/problems/invalid-request", extra);

export const unauthorized = (detail: string) =>
  new Problem(401, "Unauthorized", detail, "https://api.xappx.com/problems/unauthorized");

export const forbidden = (
  detail: string,
  type = "https://api.xappx.com/problems/forbidden",
  extra?: Record<string, unknown>,
) => new Problem(403, "Forbidden", detail, type, extra);

export const notFound = (detail: string) =>
  new Problem(404, "Not found", detail, "https://api.xappx.com/problems/not-found");

export const tooManyRequests = (detail: string, extra?: Record<string, unknown>) =>
  new Problem(429, "Too many requests", detail, "https://api.xappx.com/problems/rate-limited", extra);

export const badGateway = (detail: string) =>
  new Problem(502, "Bad gateway", detail, "https://api.xappx.com/problems/upstream-error");

export const serviceUnavailable = (detail: string) =>
  new Problem(503, "Service unavailable", detail, "https://api.xappx.com/problems/upstream-unavailable");

export function sendProblem(res: Response, err: unknown, correlationId?: string) {
  const p =
    err instanceof Problem
      ? err
      : new Problem(500, "Internal error", "The request could not be completed.");
  if (!(err instanceof Problem)) console.error("unhandled", err);

  if (res.headersSent) return;
  res
    .status(p.status)
    .type("application/problem+json")
    .json({
      type: p.type,
      title: p.title,
      status: p.status,
      detail: p.detail,
      correlation_id: correlationId,
      ...p.extra,
    });
}
