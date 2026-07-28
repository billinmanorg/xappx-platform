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
export interface Application { app_id: string; client_id: string; name: string; slug: string; status: string; primary_domain?: string | null }
export interface ProductRow { code: string; name: string; requires: string[]; billable: boolean; enabled: boolean; display_name: string | null }

export const listClients = () => call<{ data: Client[] }>("GET", "/api/v1/clients");
export const listApplications = () => call<{ data: Application[] }>("GET", "/api/v1/applications");
export const getProducts = (slug: string) =>
  call<{ data: ProductRow[] }>("GET", `/api/v1/applications/${encodeURIComponent(slug)}/products`);
export const createApplication = (body: {
  client_id: string; name: string; slug: string; products?: string[]; theme?: unknown; copy?: unknown;
}) => call<Application>("POST", "/api/v1/applications", body);
export const toggleProduct = (slug: string, code: string, enabled: boolean) =>
  call<any>("PUT", `/api/v1/applications/${encodeURIComponent(slug)}/products/${encodeURIComponent(code)}`, { enabled });
export const publish = (slug: string) =>
  call<any>("POST", `/api/v1/applications/${encodeURIComponent(slug)}/publish`, {});
