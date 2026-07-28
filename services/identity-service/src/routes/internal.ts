import { Router } from "express";
import { consume } from "../consumer.js";

export const internal = Router();

/**
 * Inbound event delivery from the outbox relay. Not a public route (absent from
 * the gateway's routes.yaml). Idempotent: consume() deduplicates on the
 * CloudEvent id, so the relay may redeliver freely. This is what keeps
 * known_applications current — application.created no longer needs seeding by hand.
 */
internal.post("/internal/events", async (req, res, next) => {
  try {
    const applied = await consume(req.body ?? {});
    res.json({ applied });
  } catch (e) {
    next(e);
  }
});
