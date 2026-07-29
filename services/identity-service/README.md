# identity-service

Global user identity, per-brand membership, roles and sessions. A user row is
global; every brand-scoped fact hangs off a membership. There is no `app_id` on
`users`, and there never will be.

## Run it

```bash
createdb xappx_identity_service
psql -d xappx_identity_service -f db/migrations/0001_init.sql
psql -d xappx_identity_service -f db/migrations/0002_consumed_events.sql

npm ci && npm run build
DATABASE_URL=postgres://…/xappx_identity_service npm start   # :8082
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/auth/signup` | Create an account (email + password) and return a bearer token |
| POST | `/api/v1/auth/login` | Verify credentials and return a bearer token |
| GET | `/api/v1/auth/me` | The user for a bearer token |
| POST | `/api/v1/auth/logout` | Client-side token discard (see note) |
| POST | `/api/v1/users` | Create a global user. Honours `Idempotency-Key` |
| GET | `/api/v1/users` | Filter with `?email=` |
| GET | `/api/v1/users/:id` | |
| PUT | `/api/v1/users/:id` | Rename / change status; disabling emits `user.disabled` |
| POST | `/api/v1/memberships` | Join a brand. Rejected for an unknown brand |
| GET | `/api/v1/memberships` | Requires `?app_id=`; scoped by RLS |
| POST | `/api/v1/sessions` | Issue a session for an authenticated principal |
| DELETE | `/api/v1/sessions/:id` | Revoke a session |
| GET | `/healthz`, `/readyz` | Readiness includes the database |

## Behaviour worth knowing before you change anything

**Authentication lives here.** `POST /auth/signup` and `/auth/login` verify a
scrypt-hashed password (`credentials` table) and mint an HS256 bearer token the
gateway verifies at the edge with the same shared secret and the same issuer /
audience. Requires `AUTH_JWT_SECRET` (falls back to `GATEWAY_JWT_TEST_SECRET` for
local parity). Sign-in returns one generic `401` for a bad email *or* password
and runs a hash even for unknown accounts, so it never reveals which emails
exist. Tokens are stateless and short-lived; server-side revocation (refresh
tokens + a denylist) is a deliberate follow-up — `logout` is a client-side
discard for now.

**Password auth vs external providers.** `users.auth_provider` distinguishes
`password` accounts (verified here) from externally-federated ones. The plaintext
password is never stored or logged — only the scrypt digest, in its own table.

**No membership is a 403 with a join path, never a 401.** A user who
authenticated successfully but has no membership for the requested brand is not
a failed login. `POST /sessions` returns `403` of type
`.../problems/no-membership` carrying a `join_path`. Returning `401` here — or
presenting it as a sign-in failure — is the production bug this endpoint exists
to not repeat.

**Unknown brands are rejected locally.** `POST /memberships` and `POST /sessions`
check `known_applications`, a projection maintained from `application.created`,
so neither needs a synchronous call to clients-service.

**Consumers deduplicate on the CloudEvent id.** Delivery is at-least-once. The
`application.created` handler records the event id in `consumed_events` before
touching the projection, so a redelivery is a no-op.

**Events go through the outbox.** `user.created`, `membership.created` and
`user.disabled` are written inside the same transaction as the state change.
Nothing publishes to a broker inline.

## Human review required

The session / membership-resolution path is auth code. Per the platform rule,
it may be written by Claude Code but must not be reviewed only by Claude Code.

## Tests

```bash
DATABASE_URL=… npm test
```

Integration tests against a real Postgres, covering: global user CRUD, unique
email, idempotent retries, membership creation and rejection of unknown brands,
consumer idempotency, session issuance, the 403-with-join-path boundary, session
revocation, tenant isolation across two brands, and problem-document error
shapes. Every run scopes its own ids so the suite is re-runnable against a
populated database.
