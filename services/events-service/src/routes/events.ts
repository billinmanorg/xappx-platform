import { Router } from "express";
import { ingest } from "../ingest.js";

export const events = Router();

/**
 * Internal ingest. The outbox relay POSTs every CloudEvent here; it is not a
 * public route (not in the gateway's routes.yaml). Idempotent on the event id,
 * so the relay can redeliver freely.
 */
events.post("/internal/events", async (req, res, next) => {
  try {
    const stored = await ingest(req.body ?? {});
    res.status(200).json({ stored });
  } catch (e) {
    next(e);
  }
});
