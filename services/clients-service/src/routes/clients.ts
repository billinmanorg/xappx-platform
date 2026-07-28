import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest } from "../errors.js";
import { emit } from "../outbox.js";

export const clients = Router();

clients.get("/clients", async (_req, res, next) => {
  try {
    const rows = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select client_id, name, slug, status, jurisdiction from clients order by name`,
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

clients.post("/clients", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.name) throw badRequest("name is required");
    if (!b.slug) throw badRequest("slug is required");
    const row = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `insert into clients (name, slug, jurisdiction, billing_email, admin_email)
         values ($1,$2,$3,$4,$5)
         returning client_id, name, slug, status, jurisdiction`,
        [b.name, b.slug, b.jurisdiction ?? null, b.billing_email ?? null, b.admin_email ?? null],
      );
      await emit(c, {
        aggregate: "client",
        type: "com.xappx.client.created",
        subject: `client:${rows[0].client_id}`,
        correlationId: req.correlationId,
        data: { client_id: rows[0].client_id, slug: rows[0].slug },
      });
      return rows[0];
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});
