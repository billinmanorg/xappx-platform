import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX ?? 10),
});

/**
 * Runs work in a transaction with the tenant context set, so row-level
 * security applies. Forgetting the context is how cross-tenant reads happen,
 * which is why nothing in this service queries outside this helper.
 */
export async function withTenant<T>(
  appId: string | null,
  work: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('xappx.app_id', $1, true)", [appId ?? ""]);
    const out = await work(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
