/**
 * The manifest is the only input to the runtime. Everything rendered comes from
 * here; nothing about a brand is hardcoded. In production this is fetched
 * through the gateway, which resolves the tenant and forwards to clients-service.
 */
export interface Manifest {
  app_id: string;
  slug: string;
  version: string;
  theme?: { logo_url?: string; primary_color?: string; font?: string };
  copy?: Record<string, string>;
  taxonomy?: Record<string, string>;
  products: { code: string; enabled: boolean; display_name?: string | null }[];
  nav: { label: string; route: string; product?: string }[];
  onboarding?: { step: number; key: string; product?: string }[];
  legal?: { terms_url?: string; privacy_url?: string; version?: string };
}

export class ManifestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const apiBase = () => {
  let b = (process.env.WEB_API_BASE ?? "http://localhost:8080").trim().replace(/\/$/, "");
  // Tolerate a bare host (e.g. a cloud service address) — default to https.
  if (!/^https?:\/\//.test(b)) b = "https://" + b;
  return b;
};

/**
 * Fetch a brand's manifest. Passes X-App-Slug so it resolves through the gateway
 * (whose /api/v1/applications route has no product gate). A 404 means the brand
 * does not exist; anything else upstream is surfaced as a 502 by the caller.
 */
export async function fetchManifest(slug: string): Promise<Manifest> {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/v1/applications/${encodeURIComponent(slug)}/manifest`, {
      headers: { "X-App-Slug": slug },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new ManifestError(502, "The manifest service did not respond.");
  }
  if (r.status === 404) throw new ManifestError(404, `No brand '${slug}'.`);
  if (!r.ok) throw new ManifestError(502, `Manifest lookup failed (${r.status}).`);
  return (await r.json()) as Manifest;
}
