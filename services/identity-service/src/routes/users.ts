import { Router } from "express";
import { withTenant } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { replay, remember } from "../idempotency.js";
import { emit } from "../outbox.js";

export const users = Router();

// A user row is global — every brand-scoped fact hangs off a membership, never
// off the user. So there is no app_id here. Idempotency keys still need a
// partition, and global endpoints use the nil uuid rather than a brand id.
const NIL_APP = "00000000-0000-0000-0000-000000000000";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["active", "disabled", "deleted"]);

users.post("/users", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    if (!EMAIL.test(String(b.email ?? ""))) throw badRequest("a valid email is required");

    const out = await withTenant(null, async (c) => {
      const prior = await replay(c, req.header("Idempotency-Key"), NIL_APP, "POST /users", b);
      if (prior) return prior;

      let user;
      try {
        const { rows } = await c.query(
          `insert into users (email, name, auth_provider, external_id)
           values ($1,$2,coalesce($3,'password'),$4)
           returning user_id, email, name, auth_provider, external_id, status, created_at`,
          [b.email, b.name ?? null, b.auth_provider ?? null, b.external_id ?? null],
        );
        user = rows[0];
      } catch (e: any) {
        // Unique email is a database constraint; translate, do not reimplement.
        if (e?.code === "23505")
          throw conflict("A user with this email already exists.",
            "https://api.xappx.com/problems/user-exists", { email: String(b.email) });
        throw e;
      }

      await emit(c, {
        aggregate: "user",
        type: "com.xappx.user.created",
        subject: `user:${user.user_id}`,
        correlationId: req.correlationId,
        data: { user_id: user.user_id, email: user.email },
      });

      await remember(c, req.header("Idempotency-Key"), NIL_APP, "POST /users", b, 201, user);
      return { status: 201, body: user };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});

users.get("/users", async (req, res, next) => {
  try {
    const email = req.query.email ? String(req.query.email) : null;
    const rows = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select user_id, email, name, auth_provider, external_id, status, created_at
           from users
          where ($1::citext is null or email = $1::citext)
          order by created_at desc`,
        [email],
      );
      return rows;
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

users.get("/users/:id", async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) throw notFound(`User '${req.params.id}'`);
    const user = await withTenant(null, async (c) => {
      const { rows } = await c.query(
        `select user_id, email, name, auth_provider, external_id, status, created_at
           from users where user_id = $1`,
        [req.params.id],
      );
      return rows[0];
    });
    if (!user) throw notFound(`User '${req.params.id}'`);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

users.put("/users/:id", async (req, res, next) => {
  try {
    if (!UUID.test(req.params.id)) throw notFound(`User '${req.params.id}'`);
    const b = req.body ?? {};
    if (b.status !== undefined && !STATUSES.has(b.status))
      throw badRequest("status must be one of active, disabled, deleted");

    const key = req.header("Idempotency-Key");
    const idemBody = { id: req.params.id, ...b };

    const out = await withTenant(null, async (c) => {
      const prior = await replay(c, key, NIL_APP, "PUT /users/:id", idemBody);
      if (prior) return prior;

      const { rows: before } = await c.query(`select status from users where user_id = $1`, [req.params.id]);
      if (!before[0]) throw notFound(`User '${req.params.id}'`);

      const { rows } = await c.query(
        `update users
            set name = coalesce($2, name),
                status = coalesce($3, status)
          where user_id = $1
          returning user_id, email, name, auth_provider, external_id, status, created_at`,
        [req.params.id, b.name ?? null, b.status ?? null],
      );
      const user = rows[0];

      // Disabling a user is a lifecycle event other services care about.
      if (b.status === "disabled" && before[0].status !== "disabled") {
        await emit(c, {
          aggregate: "user",
          type: "com.xappx.user.disabled",
          subject: `user:${user.user_id}`,
          correlationId: req.correlationId,
          data: { user_id: user.user_id },
        });
      }

      await remember(c, key, NIL_APP, "PUT /users/:id", idemBody, 200, user);
      return { status: 200, body: user };
    });

    res.status(out.status).json(out.body);
  } catch (e) {
    next(e);
  }
});
