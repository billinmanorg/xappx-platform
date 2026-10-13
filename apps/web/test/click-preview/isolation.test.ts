import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const entry = join(webRoot, "preview/main.tsx");
const verifier = join(webRoot, "tools/verify-click-preview.mjs");
const temporaryArtifacts: string[] = [];
const originalBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");

afterEach(async () => {
  temporaryArtifacts.forEach((path) => rmSync(path, { recursive: true, force: true }));
  temporaryArtifacts.length = 0;
  if (originalBeacon) Object.defineProperty(navigator, "sendBeacon", originalBeacon);
  else Reflect.deleteProperty(navigator, "sendBeacon");
  // Artifact checks use synchronous subprocesses. Let Vitest's pending worker
  // updates drain between tests instead of starving RPC during this long file.
  await yieldToEventLoop();
});

function inspectLocalImports(path: string, visited = new Set<string>()): string {
  if (visited.has(path)) return "";
  visited.add(path);
  const source = readFileSync(path, "utf8");
  let combined = source;
  for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    const base = resolve(dirname(path), match[1]!);
    const target = [base, `${base}.tsx`, `${base}.ts`, `${base}.css`, join(base, "index.ts")]
      .find((candidate) => existsSync(candidate));
    if (target && /\.(?:[cm]?[jt]sx?|css)$/.test(target)) combined += `\n${inspectLocalImports(target, visited)}`;
  }
  return combined;
}

// Importing a legacy entry/script would make this test fail.
it("isolated_entry_has_no_legacy_scripts", () => {
  expect(existsSync(entry), "dedicated preview entry exists").toBe(true);
  const html = readFileSync(join(webRoot, "preview/index.html"), "utf8");
  const sources = inspectLocalImports(entry);
  expect(html).toMatch(/<script\s+type="module"\s+src="\/main\.tsx"/);
  expect(`${html}\n${sources}`).not.toMatch(/xappy-widget|cookies\.js|fonts\.(?:googleapis|gstatic)|<iframe|\.netlify\/functions|liveService|leadService|LeadForm|BuildPage|PrototypeShell|from\s*["'][^"']*\/App["']/i);
  expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i);
});

async function loadPreview() {
  expect(existsSync(entry), "dedicated preview entry exists").toBe(true);
  // The bootstrap is exercised in Playwright; this imports its real view.
  const modulePath = "../../preview/main.tsx";
  return import(/* @vite-ignore */ modulePath);
}

// Any content API call or storage mutation in the real view fails this test.
it("preview_load_has_no_content_requests", async () => {
  const requests: string[] = [];
  const writes: string[] = [];
  const reads: string[] = [];
  vi.stubGlobal("fetch", vi.fn(() => { requests.push("fetch"); return Promise.reject(new Error("Content requests are disabled")); }));
  for (const api of ["XMLHttpRequest", "WebSocket", "EventSource"]) {
    vi.stubGlobal(api, class { constructor() { requests.push(api); throw new Error("Content requests are disabled"); } });
  }
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn(() => { requests.push("beacon"); return false; }) });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => { reads.push(key); return null; });
  for (const method of ["setItem", "removeItem", "clear"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => { writes.push(method); });
  }
  const { Preview } = await loadPreview();
  await act(async () => { render(createElement(Preview)); });
  expect(screen.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
  expect(screen.getByText("Sample data · Preview")).toBeVisible();
  expect(screen.getByText("Vault: Not connected")).toBeVisible();
  expect(screen.getByText("Live Xappy chat is not connected in this preview.")).toBeVisible();
  expect(requests).toEqual([]);
  expect(writes).toEqual([]);
  expect(reads.every((key) => key === "xappx_discovery")).toBe(true);
});

// Denied storage access must never prevent the isolated view from rendering.
it("preview_renders_when_storage_throws_security_error", async () => {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    vi.spyOn(window, name, "get").mockImplementation(() => { throw new DOMException("Storage denied", "SecurityError"); });
  }
  const { Preview } = await loadPreview();
  render(createElement(Preview));
  expect(screen.getByRole("heading", { name: "What would you like to improve?" })).toBeVisible();
});

function artifact(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "xappx-click-artifact-"));
  temporaryArtifacts.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function verify(dir: string) {
  return spawnSync(process.execPath, [verifier, dir], { encoding: "utf8" });
}

const requiredCsp = {
  "default-src": "'none'", "script-src": "'self'", "style-src": "'self'", "img-src": "'self'", "font-src": "'self'",
  "connect-src": "'none'", "form-action": "'none'", "object-src": "'none'", "base-uri": "'none'", "frame-src": "'none'", "worker-src": "'none'",
};
const safePolicy = Object.entries(requiredCsp).map(([name, value]) => `${name} ${value}`).join("; ");
const safeCspMeta = `<meta http-equiv="Content-Security-Policy" content="${safePolicy}">`;
const safeHtml = `<!doctype html><html><head>${safeCspMeta}</head><body><script type="module" src="/app.js"></script></body></html>`;

describe("artifact safety verifier", () => {
  // Rejecting the safe static artifact would make this test fail.
  it("accepts a local static artifact", () => {
    expect(existsSync(verifier), "artifact verifier exists").toBe(true);
    expect(verify(artifact({ "index.html": safeHtml, "app.js": "console.log('sample preview');" })).status).toBe(0);
  });

  it("rejects an entry without a production CSP", () => {
    expect(verify(artifact({ "index.html": safeHtml.replace(safeCspMeta, "") })).status).toBe(1);
  });

  it.each(Object.entries(requiredCsp))("rejects a missing or weakened %s directive", (name, value) => {
    for (const replacement of ["", `${name} *`, `${name} ${value} 'unsafe-inline'`]) {
      const html = safeHtml.replace(`${name} ${value}`, replacement);
      expect(verify(artifact({ "index.html": html })).status).toBe(1);
    }
  });

  it.each([
    "script-src-elem * 'unsafe-inline'",
    "script-src-attr 'unsafe-inline'",
    "style-src-elem * 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "script-src-elem 'self'",
    "future-source-directive *",
  ])("rejects additional CSP directives outside the approved policy: %s", (override) => {
    for (const policy of [`${safePolicy}; ${override}`, `${override}; ${safePolicy}`]) {
      const html = safeHtml.replace(safePolicy, policy)
        .replace("</body>", '<script>window.syntheticInline = true</script></body>');
      const result = verify(artifact({ "index.html": html }));
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).not.toContain(override);
    }
  });

  it("rejects noncanonical CSP whitespace instead of normalizing a different policy", () => {
    const html = safeHtml.replace(safePolicy, safePolicy.replace(/ /g, "\u00a0"));
    expect(verify(artifact({ "index.html": html })).status).toBe(1);
  });

  it("rejects an otherwise safe policy that appears after executable content", () => {
    const html = safeHtml.replace(safeCspMeta, "").replace("</body>", `${safeCspMeta}</body>`);
    expect(verify(artifact({ "index.html": html })).status).toBe(1);
  });

  it("rejects duplicate directives instead of guessing which the browser enforces", () => {
    const html = safeHtml.replace(safePolicy, `script-src *; ${safePolicy}`);
    expect(verify(artifact({ "index.html": html })).status).toBe(1);
  });

  // Allowing any listed forbidden artifact makes its corresponding test fail.
  it.each<[string, Record<string, string>]>([
    ["widget asset", { "xappy-widget.js": "/* forbidden legacy asset */" }],
    ["cookie asset", { "cookies.js": "/* forbidden legacy asset */" }],
    ["live discovery endpoint", { "app.js": 'fetch("/.netlify/functions/discovery")' }],
    ["live webhook", { "app.js": 'fetch("https://example.invalid/webhook/chat")' }],
    ["bearer credential", { "app.js": 'const authorization = "Bearer synthetic-test-credential-12345"' }],
    ["assigned secret", { "app.js": 'const api_key = "synthetic-test-credential-12345"' }],
    ["external script", { "index.html": safeCspMeta + '<script src="https://example.invalid/script.js"></script>' }],
    ["protocol-relative script", { "index.html": safeCspMeta + '<script src="//example.invalid/script.js"></script>' }],
    ["classification-base absolute script", { "index.html": safeCspMeta + '<script src="https://click-preview-relative.invalid/app.js"></script>' }],
    ["same-protocol scheme script", { "index.html": safeCspMeta + '<script src="https:assets/app.js"></script>' }],
    ["source map", { "app.js.map": "{}" }],
    ["frame", { "index.html": safeCspMeta + '<iframe src="/legacy"></iframe>' }],
  ])("rejects %s without printing content", (_name, files) => {
    expect(existsSync(verifier), "artifact verifier exists").toBe(true);
    const result = verify(artifact({ "index.html": safeHtml, ...files }));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain("synthetic-test-credential-12345");
    expect(`${result.stdout}${result.stderr}`).not.toContain("example.invalid");
  });


  // HTML parsing decodes these attributes before the browser classifies the URL.
  it.each([
    ["numeric C0-prefixed scheme", "&#1;https://example.invalid/app.js"],
    ["numeric upper-C0-prefixed scheme", "&#31;https://example.invalid/app.js"],
    ["decimal scheme", "https&#58;//example.invalid/app.js"],
    ["hexadecimal scheme", "https&#x3a;//example.invalid/app.js"],
    ["named scheme", "https&colon;//example.invalid/app.js"],
    ["decimal leading slashes", "&#47;&#47;example.invalid/app.js"],
    ["named leading slashes", "&sol;&sol;example.invalid/app.js"],
    ["encoded backslash network path", "&#92;&#92;example.invalid/app.js"],
  ])("rejects a character-reference external script: %s", (_name, source) => {
    const result = verify(artifact({ "index.html": safeCspMeta + `<script src="${source}"></script>` }));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain("example.invalid");
    expect(`${result.stdout}${result.stderr}`).not.toContain(source);
  });

  it.each([
    "/assets/app.js",
    "./assets/app.js",
    "assets/app.js",
    "&#47;assets/app.js",
    "&#1;/assets/app.js",
    "/assets/app.js?label=A&amp;B",
  ])("accepts an ordinary safe local script source: %s", (source) => {
    expect(verify(artifact({ "index.html": safeCspMeta + `<script src="${source}"></script>` })).status).toBe(0);
  });

  // Quoting an ordinary credential field must not hide its nonempty value.
  it.each([
    ["api_key", '"api_key"'],
    ["access_token", "'access_token'"],
    ["client_secret", '"client_secret"'],
    ["authorization", "'authorization'"],
  ])("rejects a quoted credential field: %s", (_name, key) => {
    const content = `const config = {${key}: "synthetic-test-credential-12345"}`;
    const result = verify(artifact({ "index.html": safeHtml, "app.js": content }));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain("synthetic-test-credential-12345");
    expect(`${result.stdout}${result.stderr}`).not.toContain(content);
  });

  it.each([
    'const labels = ["API key", "Access token", "Client secret", "Authorization"]',
    'const labels = {"label": "api_key", "api_key_label": "API key configuration"}',
    'const config = {"api_key": "", "access_token": "", "client_secret": "", "authorization": ""}',
  ])("accepts public credential labels or empty placeholders: %s", (content) => {
    expect(verify(artifact({ "index.html": safeHtml, "app.js": content })).status).toBe(0);
  });

  it("rejects a missing root entry without printing the supplied path", () => {
    expect(existsSync(verifier), "artifact verifier exists").toBe(true);
    const dir = artifact({ "app.js": "/* empty */" });
    const result = verify(dir);
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain(dir);
  });
});
