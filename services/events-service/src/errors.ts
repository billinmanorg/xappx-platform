/** RFC 9457 problem documents. Every error leaving this service is one of these. */
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

export const notFound = (what: string) =>
  new Problem(404, "Not found", `${what} does not exist`, "https://api.xappx.com/problems/not-found");

export const conflict = (detail: string, type: string, extra?: Record<string, unknown>) =>
  new Problem(409, "Conflict", detail, type, extra);

export const forbidden = (detail: string) =>
  new Problem(403, "Forbidden", detail, "https://api.xappx.com/problems/forbidden");

export function sendProblem(res: Response, err: unknown, correlationId?: string) {
  const p =
    err instanceof Problem
      ? err
      : new Problem(500, "Internal error", "The request could not be completed.");
  if (!(err instanceof Problem)) console.error("unhandled", err);

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
