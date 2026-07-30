/**
 * The App Factory is a pure API client (ADR-011): it talks to the platform only
 * through the same public APIs an external client would use, and connects to no
 * database of its own. This module is that client for clients-service — brands,
 * products, publish. If a screen needs something this API can't do, the gap is
 * in the API, not here.
 */
const base = () => {
  let b = (process.env.CLIENTS_API_BASE ?? "http://localhost:8081").trim().replace(/\/$/, "");
  // Tolerate a bare host (e.g. a cloud service address) — default to https.
  if (!/^https?:\/\//.test(b)) b = "https://" + b;
  return b;
};

export interface ApiResult<T = any> {
  status: number;
  data: T;
}

async function call<T = any>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const r = await fetch(base() + path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Generous timeout: a free-tier platform API may be asleep and take ~30s to wake.
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: r.status, data: data as T };
}

export interface Client { client_id: string; name: string; slug: string }
export interface AppIntake {
  roles?: string[];
  problem?: string; user_goal?: string; admin_goal?: string; onboarding?: string; workflows?: string;
}
export interface Application {
  app_id: string; client_id: string; name: string; slug: string; status: string;
  primary_domain?: string | null;
  application_type?: string | null;
  audience_model?: string | null;
  intake?: AppIntake | null;
}
export interface ProductRow { code: string; name: string; requires: string[]; billable: boolean; enabled: boolean; display_name: string | null; status?: string }
export interface ModuleRow {
  code: string; name: string; description: string | null; requires: string[];
  billable: boolean; admin_only: boolean; status: string; sort_order: number; app_count: number;
}

export interface AppFilters { client_id?: string; status?: string; application_type?: string; audience_model?: string }

export const listClients = () => call<{ data: Client[] }>("GET", "/api/v1/clients");
export const listApplications = (filters: AppFilters = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  const qs = p.toString();
  return call<{ data: Application[] }>("GET", "/api/v1/applications" + (qs ? `?${qs}` : ""));
};
export const getApplication = (slug: string) =>
  call<Application>("GET", `/api/v1/applications/${encodeURIComponent(slug)}`);
export const listModules = () => call<{ data: ModuleRow[] }>("GET", "/api/v1/products");
export const updateModule = (code: string, body: {
  status?: string; name?: string; description?: string | null; sort_order?: number;
}) => call<ModuleRow>("PUT", `/api/v1/products/${encodeURIComponent(code)}`, body);
export const getProducts = (slug: string) =>
  call<{ data: ProductRow[] }>("GET", `/api/v1/applications/${encodeURIComponent(slug)}/products`);
export const createApplication = (body: {
  client_id: string; name: string; slug: string; products?: string[];
  application_type?: string | null; audience_model?: string | null;
  intake?: AppIntake; theme?: unknown; copy?: unknown;
}) => call<Application>("POST", "/api/v1/applications", body);
export const toggleProduct = (slug: string, code: string, enabled: boolean) =>
  call<any>("PUT", `/api/v1/applications/${encodeURIComponent(slug)}/products/${encodeURIComponent(code)}`, { enabled });
export const publish = (slug: string) =>
  call<any>("POST", `/api/v1/applications/${encodeURIComponent(slug)}/publish`, {});
export const updateApplication = (slug: string, body: {
  name?: string; primary_domain?: string | null;
  application_type?: string | null; audience_model?: string | null; intake?: AppIntake;
}) => call<Application>("PUT", `/api/v1/applications/${encodeURIComponent(slug)}`, body);
export const setStatus = (slug: string, status: string) =>
  call<any>("POST", `/api/v1/applications/${encodeURIComponent(slug)}/status`, { status });
