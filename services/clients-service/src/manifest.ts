import type { PoolClient } from "pg";
import { notFound } from "./errors.js";

/** Nav entries are gated by product. An entry whose product is off never ships. */
const NAV: { label: string; route: string; product?: string }[] = [
  { label: "Home", route: "/" },
  { label: "My Twin", route: "/twin", product: "twins" },
  { label: "Agents", route: "/agents", product: "agents" },
  { label: "Vault", route: "/vault", product: "vault" },
  { label: "Community", route: "/community", product: "community" },
  { label: "Pricing", route: "/pricing" },
];

const ONBOARDING: { key: string; product?: string }[] = [
  { key: "account" },
  { key: "create_twin", product: "twins" },
  { key: "connect_vault", product: "vault" },
  { key: "join_community", product: "community" },
];

export type Manifest = {
  app_id: string;
  slug: string;
  version: string;
  theme: unknown;
  copy: unknown;
  taxonomy: unknown;
  products: { code: string; enabled: boolean; display_name: string | null }[];
  nav: { label: string; route: string; product?: string }[];
  onboarding: { step: number; key: string; product?: string }[];
  legal: { terms_url?: string; privacy_url?: string; version?: string };
};

/**
 * The single source of truth the front end renders from. Everything a disabled
 * product would have shown is absent here, not hidden client-side: nav entry,
 * onboarding step, and route all disappear together.
 */
export async function resolveManifest(c: PoolClient, slug: string): Promise<Manifest> {
  const { rows: apps } = await c.query(
    `select app_id, slug, manifest_version, theme, copy, taxonomy
       from applications where slug = $1`,
    [slug],
  );
  const app = apps[0];
  if (!app) throw notFound(`Application '${slug}'`);

  const { rows: products } = await c.query(
    `select p.code, coalesce(ap.enabled,false) as enabled, ap.display_name
       from products p
       left join app_products ap on ap.product_code = p.code and ap.app_id = $1
      where coalesce(p.admin_only,false) = false
      order by p.code`,
    [app.app_id],
  );

  const on = new Set(products.filter((p) => p.enabled).map((p) => p.code));
  const gate = <T extends { product?: string }>(x: T) => !x.product || on.has(x.product);

  const { rows: legal } = await c.query(
    `select distinct on (kind) kind, version
       from legal_documents where app_id = $1
      order by kind, effective_at desc`,
    [app.app_id],
  );
  const legalMap = Object.fromEntries(legal.map((l) => [l.kind, l.version]));

  return {
    app_id: app.app_id,
    slug: app.slug,
    version: app.manifest_version,
    theme: app.theme,
    copy: app.copy,
    taxonomy: app.taxonomy,
    products: products.map((p) => ({
      code: p.code,
      enabled: p.enabled,
      display_name: p.display_name ?? null,
    })),
    nav: NAV.filter(gate),
    onboarding: ONBOARDING.filter(gate).map((s, i) => ({ step: i + 1, ...s })),
    legal: {
      terms_url: legalMap.terms ? `/legal/terms/${legalMap.terms}` : undefined,
      privacy_url: legalMap.privacy ? `/legal/privacy/${legalMap.privacy}` : undefined,
      version: legalMap.terms ?? legalMap.privacy,
    },
  };
}
