// Scheduled keep-warm ping for the admin console (app-factory on Render's free plan).
//
// Render's free web services spin down after ~15 minutes without traffic and
// take 20-30 s to spin back up, during which visitors to xappx.ai/admin see
// Render's "loading" interstitial. Pinging the health endpoint every 10 minutes
// keeps the service awake at no cost (Netlify scheduled functions are free, and
// one always-on free Render service fits inside Render's 750 free hours/month).
//
// Not a security surface: it only GETs /healthz, which is public and returns {status:"ok"}.

const DEFAULT_TARGET = "https://app-factory-3jf3.onrender.com/healthz";

export default async () => {
  const target = process.env.ADMIN_HEALTH_URL || DEFAULT_TARGET;
  const started = Date.now();
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(50_000) });
    console.log(`keepwarm ${res.status} ${target} in ${Date.now() - started}ms`);
  } catch (err) {
    console.log(`keepwarm failed ${target}: ${err?.message ?? err}`);
  }
  return new Response("ok");
};

export const config = { schedule: "*/10 * * * *" };
