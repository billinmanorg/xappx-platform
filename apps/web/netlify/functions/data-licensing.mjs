// XAPPX-owned intake endpoint for /data-licensing.
//
// Durable store: Netlify Forms (form "xappx-data-licensing", visible only to
// people signed in to the XAPPX Netlify account). Internal notice: a short
// email to the team inbox carrying the record ID and a private link to the
// form, NOT the full submission. Nothing is forwarded anywhere else.
//
// Rules from the brief this enforces:
//   - server-side validation; required = company, contact name, valid work
//     email, authority, privacy acknowledgement, US domicile;
//   - a non-enumerable record ID (random), never a counter;
//   - a client-generated submissionId travels with the record so a retried
//     submission can be recognised as a duplicate by the team;
//   - a receipt (200 + recordId) only after the store accepted the record;
//   - no field values in logs.
import { randomBytes } from "node:crypto";
import { send } from "./notify.mjs";

const FORM_NAME = "xappx-data-licensing";
const FORMS_LINK = "https://app.netlify.com/projects/xappx-app/forms";
const TEAM_INBOX = process.env.NOTIFY_TO || process.env.SMTP_USER || "info.xappx@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
const clean = (s, max) => String(s == null ? "" : s).replace(/\r/g, "").trim().slice(0, max);

/** "DL-" + 10 characters from an unambiguous alphabet: ~50 bits, not guessable, not sequential. */
export function newRecordId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `DL-${out}`;
}

const FIELDS = [
  "submissionId", "noticeVersion", "completedBy", "completedByRole",
  "businessName", "legalName", "relatedEntities", "hqState", "usDomicile", "ownershipType", "industry", "subVertical", "franchise",
  "contactName", "contactTitle", "email", "phone", "decisionRole", "referral",
  "website", "linkedin", "description", "customerTypes", "engagement",
  "desk", "nonDesk", "totalHeadcount", "peakHeadcount", "operatingStatus", "foundedYear", "earliestRecords", "recordsFrom", "recordsTo",
  "staffGeography", "dataLanguage", "coverageEmail", "coverageChat", "coverageFiles",
  "rightsKnown", "restrictions", "sensitive", "retention", "priorLicensing", "revenueRange", "currency", "fiscalYear",
  "needHelpIdentifying", "systems", "estimateIndustry", "estimateDesk", "estimateNonDesk", "estimateYears", "rightsAnswer", "authority", "privacyAck",
];
const LONG = new Set(["description", "systems"]);

/** Validate + normalise. Returns { ok, errors, record }. */
export function validate(body) {
  const r = {};
  for (const k of FIELDS) r[k] = clean(body?.[k], LONG.has(k) ? (k === "systems" ? 40000 : 4000) : 300);
  const errors = {};
  if (r.businessName.length < 2) errors.businessName = "required";
  if (r.contactName.length < 2) errors.contactName = "required";
  if (!EMAIL_RE.test(r.email)) errors.email = "invalid";
  if (r.usDomicile !== "yes") errors.usDomicile = "us_only";
  if (r.authority !== "yes") errors.authority = "required";
  if (r.privacyAck !== "yes") errors.privacyAck = "required";
  if (!/^[0-9a-f-]{8,64}$/i.test(r.submissionId)) errors.submissionId = "invalid";
  let systems = [];
  try { systems = JSON.parse(r.systems || "[]"); } catch { errors.systems = "invalid"; }
  if (!Array.isArray(systems) || systems.length > 60) errors.systems = "invalid";
  else r.systems = JSON.stringify(systems.map((s) => ({
    id: clean(s?.id, 60), label: clean(s?.label, 120), custom: Boolean(s?.custom), dataType: clean(s?.dataType, 40), count: clean(s?.count, 20), unit: clean(s?.unit, 40),
    historyFrom: clean(s?.historyFrom, 4), historyTo: clean(s?.historyTo, 4), teams: clean(s?.teams, 200), restrictions: clean(s?.restrictions, 300), notes: clean(s?.notes, 1000), unknown: Boolean(s?.unknown),
  })));
  return { ok: Object.keys(errors).length === 0, errors, record: r, systemCount: Array.isArray(systems) ? systems.length : 0 };
}

async function storeInNetlifyForms(record, recordId) {
  const site = (process.env.URL || "").replace(/\/+$/, "");
  if (!site) throw new Error("site_url_missing");
  const params = new URLSearchParams();
  params.set("form-name", FORM_NAME);
  params.set("bot-field", "");
  params.set("record-id", recordId);
  for (const k of FIELDS) params.set(k, record[k]);
  const res = await fetch(`${site}/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`forms_${res.status}`);
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json", retry: false }, 400); }

  const v = validate(body);
  if (!v.ok) return json({ ok: false, error: "invalid", fields: Object.keys(v.errors), retry: false }, 400);

  const recordId = newRecordId();
  try {
    await storeInNetlifyForms(v.record, recordId);
  } catch (e) {
    console.log(`data-licensing: store failed (${clean(e?.message, 40)}) submission=${v.record.submissionId}`);
    return json({ ok: false, error: "store_failed", retry: true }, 502);
  }

  // Internal notice: record ID + private link, not the form contents.
  try {
    await send({
      from: `XAPPX <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to: TEAM_INBOX,
      replyTo: TEAM_INBOX,
      subject: `[XAPPX data licensing] ${v.record.businessName} · ${recordId}`,
      text: [
        "New data-licensing inquiry received on xappx.ai.",
        "",
        `Record ID:      ${recordId}`,
        `Submission ID:  ${v.record.submissionId}  (same ID again = a retry, not a new inquiry)`,
        `Business:       ${v.record.businessName}${v.record.hqState ? ` (${v.record.hqState})` : ""}`,
        `Industry:       ${v.record.industry || "not given"}`,
        `Contact:        ${v.record.contactName} <${v.record.email}>`,
        `Systems listed: ${v.systemCount}${v.record.needHelpIdentifying === "yes" ? " (asked for help identifying)" : ""}`,
        `Notice version: ${v.record.noticeVersion}`,
        "",
        `Full record (Netlify sign-in required): ${FORMS_LINK}`,
        "XAPPX reviews first. No onward sharing without separate approval.",
      ].join("\n"),
    });
  } catch (e) {
    console.log(`data-licensing: notice failed (${clean(e?.message, 40)}) record=${recordId}`);
  }

  console.log(`data-licensing: stored record=${recordId} submission=${v.record.submissionId}`);
  return json({ ok: true, recordId });
};
