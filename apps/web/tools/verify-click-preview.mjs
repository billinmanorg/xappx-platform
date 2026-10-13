import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { JSDOM } from "jsdom";

// Never include artifact content, matched strings, or user-supplied paths in output.
const unsafeContent = [
  /\.netlify\/functions\b/i,
  /\b(?:liveService|leadService|xappy-widget|BuildPage|PrototypeShell)\b/i,
  /(?:https?:\/\/|\/)(?:[^\s"'`<>]*\/)?webhooks?\//i,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|authorization)\b["']?\s*[=:]\s*["'][^"']{8,}["']/i,
  /\b(?:sk[-_](?:live[-_]|test[-_])?|gh[pousr]_|AKIA)[A-Za-z0-9_-]{16,}\b/,
  /<\s*(?:iframe|object|embed)\b/i,
];

function hasExternalScript(content) {
  if (!/<script\b/i.test(content)) return false;
  // Fragment parsing decodes HTML character references without a browsing
  // context: scripts cannot execute, and resources cannot load.
  const fragments = [JSDOM.fragment(content)];
  const relativeBases = [
    new URL("https://click-preview-relative.invalid/"),
    new URL("http://click-preview-relative-check.invalid/"),
  ];
  while (fragments.length) {
    const fragment = fragments.pop();
    for (const script of fragment.querySelectorAll("script[src]")) {
      const source = script.getAttribute("src");
      if (!source.trim() || source.includes("\\")) return true;
      // Native URL parsing applies browser-compatible control/whitespace
      // normalization. Only relative sources inherit both origins/protocols;
      // explicit schemes and network-path sources cannot inherit both.
      for (const base of relativeBases) {
        try {
          if (new URL(source, base).origin !== base.origin) return true;
        } catch {
          return true;
        }
      }
    }
    // Keep the same check for script markup stored in inert templates.
    for (const template of fragment.querySelectorAll("template")) fragments.push(template.content);
  }
  return false;
}

function assertProductionCsp(html) {
  // Parse inertly: no script execution or resource fetching is enabled.
  const document = new JSDOM(html).window.document;
  const policies = document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]');
  if (policies.length !== 1 || policies[0].parentElement !== document.head) throw new Error("unsafe");
  const policy = policies[0];
  const approvedPolicy = [
    "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "font-src 'self'",
    "connect-src 'none'", "form-action 'none'", "object-src 'none'", "base-uri 'none'", "frame-src 'none'", "worker-src 'none'",
  ].join("; ");
  // Match the fixed build policy exactly. Extra source directives can override
  // fallbacks; permissive normalization can also differ from browser parsing.
  if (policy.getAttribute("content") !== approvedPolicy) throw new Error("unsafe");
  for (const executable of document.querySelectorAll('script, link[rel="stylesheet"], link[rel="preload"], link[rel="modulepreload"]')) {
    if (policy.compareDocumentPosition(executable) & 2) throw new Error("unsafe");
  }
}

async function inspect(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error("unsafe");
    if (stat.isDirectory()) {
      await inspect(path);
    } else if (stat.isFile()) {
      if (/^(?:xappy-widget|cookies)(?:\.|$)/i.test(basename(name)) || /\.map$/i.test(name)) throw new Error("unsafe");
      const content = await readFile(path, "utf8");
      if (unsafeContent.some((pattern) => pattern.test(content)) || hasExternalScript(content)) throw new Error("unsafe");
    } else {
      throw new Error("unsafe");
    }
  }
}

try {
  if (process.argv.length !== 3 || !process.argv[2]) throw new Error("invalid");
  const output = resolve(process.argv[2]);
  if (!(await lstat(output)).isDirectory()) throw new Error("invalid");
  const entry = await lstat(join(output, "index.html"));
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("invalid");
  assertProductionCsp(await readFile(join(output, "index.html"), "utf8"));
  await inspect(output);
  console.log("Click-first preview artifact safety check passed.");
} catch {
  console.error("Click-first preview artifact safety check failed.");
  process.exitCode = 1;
}
