// xappx.ai/admin — the XAPPX Factory console, served as a Netlify Function.
//
// The console is the Express app in apps/app-factory, compiled and copied into
// ./admin-lib by `node scripts/prepare-admin.mjs` (run before each deploy).
// netlify.toml rewrites /admin and /admin/* here. Running it as a function means
// no always-on server to keep awake: Netlify cold starts are ~1 s and show no
// interstitial page.
//
// Required environment (Netlify → Site configuration → Environment variables):
//   FACTORY_USER, FACTORY_PASS   sign-in credentials (secret)
//   FACTORY_BASE_PATH=/admin     the console lives under /admin
//   CLIENTS_API_BASE             platform API the console talks to
//   WEB_RUNTIME_BASE             where generated apps are served (links only)
// Optional: FACTORY_SESSION_SECRET, ANTHROPIC_API_KEY, LLM_MODEL.
// Static imports only (no top-level await): Netlify bundles v1 `handler`
// functions to CommonJS. The console reads all of these env vars lazily, at
// request time, so setting them after the import is fine.
import serverless from "serverless-http";
import { createApp } from "./admin-lib/main.js";
import { tokensCss } from "./admin-lib/tokens.js";

process.env.FACTORY_BASE_PATH ??= "/admin";
process.env.CLIENTS_API_BASE ??= "https://clients-service-84j5.onrender.com";
process.env.WEB_RUNTIME_BASE ??= "https://web-runtime.onrender.com";
process.env.WEB_TOKENS_CSS ??= "tokens.css"; // never read from disk here; tokensCss is inlined

const configured = () => !!process.env.FACTORY_USER && !!process.env.FACTORY_PASS;

const app = createApp({ tokensCss });
const handle = serverless(app, {
  // Netlify rewrites /admin/* to this function; make sure Express sees the
  // public path (/admin/...) whichever form event.path arrives in.
  request(req, event) {
    if (event.rawUrl) {
      const u = new URL(event.rawUrl);
      req.url = u.pathname + u.search;
    }
  },
});

export const handler = async (event, context) => {
  if (!configured()) {
    // The console opens itself in local dev when no credentials are set; never
    // let that happen on the public domain.
    return {
      statusCode: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      body: "Admin console is not configured on this site yet (FACTORY_USER / FACTORY_PASS).",
    };
  }
  return handle(event, context);
};
