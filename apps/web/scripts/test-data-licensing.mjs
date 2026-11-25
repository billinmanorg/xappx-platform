#!/usr/bin/env node
// Tests for /data-licensing: calculator gate + fixtures, qualifier bounds,
// intake validation and payload, and the server endpoint's contract.
// Run: npm run test:data-licensing
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const out = mkdtempSync(join(tmpdir(), "xappx-dl-"));
const esbuild = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "esbuild.cmd" : "esbuild");
for (const f of ["calculator", "intake"]) {
  execFileSync(esbuild, [`src/dataLicensing/${f}.ts`, "--bundle", "--format=esm", "--platform=neutral", `--outfile=${join(out, f + ".mjs")}`], { stdio: "pipe", shell: process.platform === "win32" });
}
const calc = await import(pathToFileURL(join(out, "calculator.mjs")).href);
const intake = await import(pathToFileURL(join(out, "intake.mjs")).href);
const fn = await import(pathToFileURL(join(process.cwd(), "netlify", "functions", "data-licensing.mjs")).href);
process.on("exit", () => rmSync(out, { recursive: true, force: true }));

test("calculator: no dollar result without owner-authorized rules", () => {
  assert.equal(calc.RULES, null);
  assert.equal(calc.estimate({ industry: "legal", desk: 30, nonDesk: 5, years: 5 }), null);
});

test("calculator: rounding and USD formatting match the reference style", () => {
  assert.equal(calc.roundTo(164_999, 10_000), 160_000);
  assert.equal(calc.roundTo(165_000, 10_000), 170_000);
  assert.equal(calc.formatUsd(160_000), "$160K");
  assert.equal(calc.formatUsd(3_770_000), "$3.77M");
  assert.equal(calc.formatUsd(1_060_000), "$1.06M");
  assert.equal(calc.formatUsd(5_240_000), "$5.24M");
  assert.equal(calc.clampInt(999, 1, 500), 500);
  assert.equal(calc.clampInt(-3, 0, 500), 0);
  assert.equal(calc.clampInt(Number.NaN, 1, 30), 1);
});

test("calculator: recorded fixtures are the parity gate for the rules", (t) => {
  assert.equal(calc.FIXTURES.length, 11);
  if (!calc.RULES) { t.diagnostic("RULES pending: fixtures recorded, parity check skipped"); return; }
  for (const f of calc.FIXTURES) {
    assert.deepEqual(calc.estimate(f.inputs, calc.RULES), f.expect, JSON.stringify(f.inputs));
  }
});

test("qualifier bounds and limits", () => {
  assert.equal(calc.QUALIFY_LIMITS.desk.max, 100_000);
  assert.equal(calc.QUALIFY_LIMITS.years.max, 200);
  assert.deepEqual(calc.HOME_LIMITS.desk, { min: 1, max: 500, default: 30 });
  assert.deepEqual(calc.HOME_LIMITS.nonDesk, { min: 0, max: 500, default: 5 });
  assert.deepEqual(calc.HOME_LIMITS.years, { min: 1, max: 30, default: 5 });
  assert.equal(calc.QUALIFY_INDUSTRIES.find((i) => i.id === "medical_accounting_finance").home, "finance");
});

function filled() {
  const i = intake.emptyIntake();
  Object.assign(i, { businessName: "Test Company", contactName: "QA Person", email: "qa@example.test", usDomicile: "yes", hqState: "NV", industry: "Legal", authority: true, privacyAck: true });
  i.systems = [intake.newSystem("Gmail / Google Workspace", false, "gmail")];
  return i;
}

test("intake: step 1 requires company, contact, work email, US domicile and systems", () => {
  const i = intake.emptyIntake();
  const e = intake.validateStep1(i);
  for (const k of ["businessName", "contactName", "email", "usDomicile", "hqState", "industry", "systems"]) assert.ok(e[k], k);
  const ok = filled();
  assert.deepEqual(intake.validateStep1(ok), {});
  ok.desk = "12.5"; assert.ok(intake.validateStep1(ok).desk);
  ok.desk = "100001"; assert.ok(intake.validateStep1(ok).desk);
  ok.desk = "100000"; assert.equal(intake.validateStep1(ok).desk, undefined);
  ok.recordsFrom = "2020"; ok.recordsTo = "2010"; assert.ok(intake.validateStep1(ok).recordsTo);
  const help = filled(); help.systems = []; help.needHelpIdentifying = true; assert.equal(intake.validateStep1(help).systems, undefined);
});

test("intake: step 2 allows unknown, rejects bad numbers and years", () => {
  const i = filled();
  i.systems[0].count = "12k"; assert.ok(intake.validateStep2(i)["gmail.count"]);
  i.systems[0].count = "12000"; i.systems[0].historyFrom = "99"; assert.ok(intake.validateStep2(i)["gmail.historyFrom"]);
  i.systems[0].unknown = true; assert.deepEqual(intake.validateStep2(i), {});
});

test("intake: submit needs authority and privacy acknowledgement; payload is flat and carries the submission id", () => {
  const i = filled();
  i.authority = false; i.privacyAck = false;
  const e = intake.validateSubmit(i);
  assert.ok(e.authority && e.privacyAck);
  i.authority = true; i.privacyAck = true;
  assert.deepEqual(intake.validateSubmit(i), {});
  const p = intake.toPayload(i, "11111111-2222-3333-4444-555555555555", { estimateIndustry: "legal", estimateDesk: 30, estimateNonDesk: 0, estimateYears: 5, rightsAnswer: "yes", noticeVersion: "2026-11-25" });
  assert.equal(p.submissionId, "11111111-2222-3333-4444-555555555555");
  assert.equal(typeof p.systems, "string");
  assert.equal(JSON.parse(p.systems)[0].id, "gmail");
  assert.equal(p.authority, "yes");
  assert.equal(intake.unknownFields(i).length > 0, true);
});

test("endpoint: record ids are random and well-formed; validation and CORS contract", async () => {
  const ids = new Set(Array.from({ length: 50 }, () => fn.newRecordId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^DL-[A-HJ-NP-Z2-9]{10}$/);

  const call = (b, method = "POST") => fn.default(new Request("http://x/f", { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(b) : undefined }));
  const pre = await call(null, "OPTIONS");
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "*");

  const bad = await call({ businessName: "X" });
  assert.equal(bad.status, 400);
  const bj = await bad.json();
  assert.equal(bj.retry, false);
  assert.ok(bj.fields.includes("email") && bj.fields.includes("authority"));

  // Valid record but no site URL configured -> store fails -> recoverable error, no receipt.
  delete process.env.URL;
  const good = filled();
  const payload = intake.toPayload(good, "11111111-2222-3333-4444-555555555555", { estimateIndustry: "legal", estimateDesk: 30, estimateNonDesk: 0, estimateYears: 5, rightsAnswer: "yes", noticeVersion: "2026-11-25" });
  const r = await call(payload);
  assert.equal(r.status, 502);
  const rj = await r.json();
  assert.equal(rj.ok, false);
  assert.equal(rj.retry, true);
  assert.equal(rj.recordId, undefined);
});
