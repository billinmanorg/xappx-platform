// Acknowledgement email to a client who sent a build request or a Solutions
// enquiry, plus a copy to the team inbox. Called by the browser right after
// the lead is stored in Netlify Forms; the form submission never depends on
// this succeeding.
//
// Provider (first that is configured wins):
//   1. Resend REST  — RESEND_API_KEY + EMAIL_FROM (a verified xappx.ai address)
//   2. Gmail SMTP   — SMTP_USER (info.xappx@gmail.com) + SMTP_PASS (a Google
//      "App password"; the account needs 2-Step Verification on). Optional
//      SMTP_HOST / SMTP_PORT (default smtp.gmail.com:465).
// Optional: NOTIFY_TO (team inbox; defaults to the sender), EMAIL_FROM_NAME.
// Nothing configured → { configured:false } and the page simply doesn't
// promise an email.
//
// POST { name, email, company, product, challenge?, message?, blueprintName?, kind }
//   -> { ok, configured, sent: { client, team } }
import nodemailer from "nodemailer";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, max) => String(s == null ? "" : s).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const multiline = (s, max) => String(s == null ? "" : s).replace(/\r/g, "").trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TEAM_INBOX_DEFAULT = "info.xappx@gmail.com";

function provider() {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}
function fromAddress() {
  const name = process.env.EMAIL_FROM_NAME || "XAPPX";
  const addr = process.env.EMAIL_FROM || process.env.SMTP_USER;
  return { name, addr, header: `${name} <${addr}>` };
}
function teamInbox() {
  return process.env.NOTIFY_TO || process.env.SMTP_USER || TEAM_INBOX_DEFAULT;
}

/** Plain-text + HTML acknowledgement for the client. */
function clientEmail(lead) {
  const first = lead.name.split(" ")[0] || "there";
  const isBuild = lead.kind === "build";
  const subject = isBuild ? `We've got your ${lead.product} build request` : `Thanks for reaching out to XAPPX about ${lead.product}`;
  const lines = [
    `Hi ${first},`,
    "",
    isBuild
      ? `Thanks for designing your solution with XAPPX. Your blueprint${lead.blueprintName ? ` for "${lead.blueprintName}"` : ""} and the answers you gave are already with our team.`
      : `Thanks for getting in touch about ${lead.product}. Your message is with our team.`,
    "",
    "What we received",
    `  Company: ${lead.company}`,
    `  Interest: ${lead.product}`,
    lead.challenge ? `  Problem: ${lead.challenge}` : null,
    lead.message ? `  Your note: ${lead.message}` : null,
    "",
    "What happens next",
    "  A XAPPX solution expert replies within one business day with questions, a plan, or both.",
    "  You can reply to this email at any time; it reaches a person.",
    "",
    "Until then, you can explore what else we build at https://xappx.ai/solutions",
    "",
    "XAPPY, for the XAPPX team",
    "https://xappx.ai",
  ].filter((l) => l !== null);
  const text = lines.join("\n");
  const rows = [
    ["Company", lead.company], ["Interest", lead.product],
    lead.challenge ? ["Problem", lead.challenge] : null, lead.message ? ["Your note", lead.message] : null,
  ].filter(Boolean).map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#0f172a">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="font-weight:800;letter-spacing:.12em;font-size:14px;margin-bottom:20px"><span style="color:#00B4E6">X</span>APP<span style="color:#7A2BFF">X</span></div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
    <p style="margin:0 0 14px;font-size:17px">Hi ${esc(first)},</p>
    <p style="margin:0 0 18px;line-height:1.55">${esc(isBuild
      ? `Thanks for designing your solution with XAPPX. Your blueprint${lead.blueprintName ? ` for "${lead.blueprintName}"` : ""} and the answers you gave are already with our team.`
      : `Thanks for getting in touch about ${lead.product}. Your message is with our team.`)}</p>
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">What we received</p>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:18px">${rows}</table>
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">What happens next</p>
    <p style="margin:0 0 18px;line-height:1.55">A XAPPX solution expert replies within one business day with questions, a plan, or both. You can reply to this email at any time; it reaches a person.</p>
    <a href="https://xappx.ai/solutions" style="display:inline-block;background:#00C2FF;color:#00131F;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:999px">See everything XAPPX builds</a>
  </div>
  <p style="margin:18px 0 0;font-size:12px;color:#64748b">XAPPY, for the XAPPX team · <a href="https://xappx.ai" style="color:#64748b">xappx.ai</a></p>
</div></body></html>`;
  return { subject, text, html };
}

/** Internal copy so the team hears about the lead even before Netlify notifications are set. */
function teamEmail(lead) {
  const subject = `[XAPPX lead] ${lead.product} · ${lead.company} (${lead.name})`;
  const text = [
    `New ${lead.kind === "build" ? "build request" : "Solutions enquiry"} from xappx.ai`,
    "",
    `Name:     ${lead.name}`, `Email:    ${lead.email}`, `Company:  ${lead.company}`, `Interest: ${lead.product}`,
    lead.challenge ? `Problem:  ${lead.challenge}` : null,
    lead.blueprintName ? `Blueprint: ${lead.blueprintName}` : null,
    lead.message ? `\nMessage:\n${lead.message}` : null,
    "", "Reply directly to the client's address above. The full record is also in Netlify Forms.",
  ].filter((l) => l !== null).join("\n");
  return { subject, text };
}

async function sendViaResend(msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: msg.from, to: [msg.to], reply_to: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

let transporter;
function smtp() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
    });
  }
  return transporter;
}
async function sendViaSmtp(msg) {
  await smtp().sendMail({ from: msg.from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html });
}

export async function send(msg) {
  const p = provider();
  if (p === "resend") return sendViaResend(msg);
  if (p === "smtp") return sendViaSmtp(msg);
  throw new Error("not_configured");
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!provider()) return json({ ok: true, configured: false, sent: { client: false, team: false } });

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const lead = {
    kind: body?.kind === "build" ? "build" : "solutions",
    name: clean(body?.name, 80),
    email: clean(body?.email, 120),
    company: clean(body?.company, 120),
    product: clean(body?.product, 80) || "XAPPX",
    challenge: clean(body?.challenge, 300) || "",
    blueprintName: clean(body?.blueprintName, 80) || "",
    message: multiline(body?.message, 2000),
  };
  if (!lead.name || !lead.company || !EMAIL_RE.test(lead.email)) return json({ error: "invalid_lead" }, 400);

  const from = fromAddress();
  const team = teamInbox();
  const c = clientEmail(lead);
  const t = teamEmail(lead);
  const results = await Promise.allSettled([
    send({ from: from.header, to: lead.email, replyTo: team, subject: c.subject, text: c.text, html: c.html }),
    send({ from: from.header, to: team, replyTo: lead.email, subject: t.subject, text: t.text }),
  ]);
  const sent = { client: results[0].status === "fulfilled", team: results[1].status === "fulfilled" };
  const errors = results.filter((r) => r.status === "rejected").map((r) => clean(r.reason?.message || "failed", 80));
  if (errors.length) console.log("notify: send failed", errors.join("; "));
  return json({ ok: sent.client || sent.team, configured: true, sent, error: errors[0] });
};
