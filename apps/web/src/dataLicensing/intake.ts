// Intake model + validation for /data-licensing. Kept in memory only (never
// browser storage, never the URL): it carries contact details.
import { QUALIFY_LIMITS } from "./calculator";

export type Coverage = "All" | "Partial" | "Excluded" | "";

export interface SystemDetail {
  id: string;            // stable row id (catalog id or custom-<random>)
  label: string;
  custom: boolean;
  dataType: string;
  count: string;         // free text number
  unit: string;
  historyFrom: string;   // year
  historyTo: string;     // year
  teams: string;
  restrictions: string;
  notes: string;
  unknown: boolean;      // "we don't know the details for this system yet"
}

export interface Intake {
  // completed by
  completedBy: string; completedByRole: string;
  // company
  businessName: string; legalName: string; relatedEntities: string; hqState: string; usDomicile: "" | "yes" | "no";
  ownershipType: string; industry: string; subVertical: string; franchise: string;
  // contact
  contactName: string; contactTitle: string; email: string; phone: string; decisionRole: string; referral: string;
  // profile
  website: string; linkedin: string; description: string; customerTypes: string; engagement: string;
  // scale / history
  desk: string; nonDesk: string; totalHeadcount: string; peakHeadcount: string; operatingStatus: string;
  foundedYear: string; earliestRecords: string; recordsFrom: string; recordsTo: string; staffGeography: string; dataLanguage: string;
  coverageEmail: Coverage; coverageChat: Coverage; coverageFiles: Coverage;
  // rights / background
  rightsKnown: string; restrictions: string; sensitive: string[]; retention: string; priorLicensing: "" | "yes" | "no";
  revenueRange: string; currency: string; fiscalYear: string;
  // systems
  systems: SystemDetail[]; needHelpIdentifying: boolean;
  // submit
  authority: boolean; privacyAck: boolean;
}

export const emptyIntake = (): Intake => ({
  completedBy: "", completedByRole: "",
  businessName: "", legalName: "", relatedEntities: "", hqState: "", usDomicile: "",
  ownershipType: "", industry: "", subVertical: "", franchise: "",
  contactName: "", contactTitle: "", email: "", phone: "", decisionRole: "", referral: "",
  website: "", linkedin: "", description: "", customerTypes: "", engagement: "",
  desk: "", nonDesk: "", totalHeadcount: "", peakHeadcount: "", operatingStatus: "",
  foundedYear: "", earliestRecords: "", recordsFrom: "", recordsTo: "", staffGeography: "", dataLanguage: "",
  coverageEmail: "", coverageChat: "", coverageFiles: "",
  rightsKnown: "", restrictions: "", sensitive: [], retention: "", priorLicensing: "",
  revenueRange: "", currency: "USD", fiscalYear: "",
  systems: [], needHelpIdentifying: false,
  authority: false, privacyAck: false,
});

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail)\./i;

export const isWorkEmail = (e: string) => EMAIL_RE.test(e.trim());
export const looksPersonalEmail = (e: string) => FREE_MAIL.test(e.trim());

export const intOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
};

export function newSystem(label: string, custom = false, id?: string): SystemDetail {
  return {
    id: id ?? `custom-${Math.random().toString(36).slice(2, 9)}`,
    label, custom, dataType: "", count: "", unit: "", historyFrom: "", historyTo: "", teams: "", restrictions: "", notes: "", unknown: false,
  };
}

/** Step 1 (company, contact, systems). Returns field -> message. */
export function validateStep1(i: Intake): Record<string, string> {
  const e: Record<string, string> = {};
  if (i.businessName.trim().length < 2) e.businessName = "Enter the business name.";
  if (i.contactName.trim().length < 2) e.contactName = "Enter your name.";
  if (!isWorkEmail(i.email)) e.email = "Enter a valid work email.";
  if (i.usDomicile !== "yes") e.usDomicile = "This program is open to US businesses only.";
  if (!i.hqState) e.hqState = "Choose the headquarters state.";
  if (!i.industry) e.industry = "Choose the industry.";
  for (const k of ["desk", "nonDesk", "totalHeadcount", "peakHeadcount"] as const) {
    const v = i[k];
    if (v.trim() && intOrNull(v) === null) e[k] = "Whole numbers only.";
  }
  if (i.desk.trim() && (intOrNull(i.desk) ?? 0) > QUALIFY_LIMITS.desk.max) e.desk = `Up to ${QUALIFY_LIMITS.desk.max.toLocaleString()}.`;
  for (const k of ["foundedYear", "earliestRecords", "recordsFrom", "recordsTo"] as const) {
    const v = i[k].trim();
    if (v && !/^(19|20)\d{2}$/.test(v)) e[k] = "Enter a four-digit year.";
  }
  if (i.recordsFrom && i.recordsTo && Number(i.recordsFrom) > Number(i.recordsTo)) e.recordsTo = "End year is before the start year.";
  if (!i.systems.length && !i.needHelpIdentifying) e.systems = "Select at least one system, or tick \"I need help identifying our systems\".";
  return e;
}

/** Step 2: per-system details. Unknown is allowed; numbers must be numbers. */
export function validateStep2(i: Intake): Record<string, string> {
  const e: Record<string, string> = {};
  for (const s of i.systems) {
    if (s.unknown) continue;
    if (s.count.trim() && intOrNull(s.count) === null) e[`${s.id}.count`] = "Whole numbers only.";
    for (const k of ["historyFrom", "historyTo"] as const) {
      const v = s[k].trim();
      if (v && !/^(19|20)\d{2}$/.test(v)) e[`${s.id}.${k}`] = "Four-digit year.";
    }
  }
  return e;
}

/** Step 3: what must be true to submit the inquiry. */
export function validateSubmit(i: Intake): Record<string, string> {
  const e = validateStep1(i);
  if (!i.authority) e.authority = "Confirm you are authorized to make this inquiry.";
  if (!i.privacyAck) e.privacyAck = "Please acknowledge the privacy notice.";
  return e;
}

/** Unknown / blank fields to show on the review screen. */
export function unknownFields(i: Intake): string[] {
  const labels: [keyof Intake, string][] = [
    ["legalName", "Legal name"], ["ownershipType", "Ownership type"], ["desk", "Desk employees"], ["nonDesk", "Non-desk employees"],
    ["foundedYear", "Founded year"], ["earliestRecords", "Earliest records"], ["rightsKnown", "Rights to the records"],
    ["restrictions", "Third-party restrictions"], ["retention", "Retention"], ["coverageEmail", "Email coverage"],
    ["coverageChat", "Chat coverage"], ["coverageFiles", "Files coverage"],
  ];
  const out = labels.filter(([k]) => !String(i[k] ?? "").trim()).map(([, l]) => l);
  for (const s of i.systems) if (s.unknown) out.push(`${s.label}: details`);
  return out;
}

/** Payload sent to the XAPPX-owned endpoint. Flat strings; systems as JSON. */
export function toPayload(i: Intake, submissionId: string, extras: { estimateIndustry: string; estimateDesk: number; estimateNonDesk: number; estimateYears: number; rightsAnswer: string; noticeVersion: string }) {
  return {
    submissionId,
    noticeVersion: extras.noticeVersion,
    completedBy: i.completedBy, completedByRole: i.completedByRole,
    businessName: i.businessName, legalName: i.legalName, relatedEntities: i.relatedEntities, hqState: i.hqState, usDomicile: i.usDomicile,
    ownershipType: i.ownershipType, industry: i.industry, subVertical: i.subVertical, franchise: i.franchise,
    contactName: i.contactName, contactTitle: i.contactTitle, email: i.email.trim(), phone: i.phone, decisionRole: i.decisionRole, referral: i.referral,
    website: i.website, linkedin: i.linkedin, description: i.description, customerTypes: i.customerTypes, engagement: i.engagement,
    desk: i.desk, nonDesk: i.nonDesk, totalHeadcount: i.totalHeadcount, peakHeadcount: i.peakHeadcount, operatingStatus: i.operatingStatus,
    foundedYear: i.foundedYear, earliestRecords: i.earliestRecords, recordsFrom: i.recordsFrom, recordsTo: i.recordsTo,
    staffGeography: i.staffGeography, dataLanguage: i.dataLanguage,
    coverageEmail: i.coverageEmail, coverageChat: i.coverageChat, coverageFiles: i.coverageFiles,
    rightsKnown: i.rightsKnown, restrictions: i.restrictions, sensitive: i.sensitive.join(", "), retention: i.retention, priorLicensing: i.priorLicensing,
    revenueRange: i.revenueRange, currency: i.currency, fiscalYear: i.fiscalYear,
    needHelpIdentifying: i.needHelpIdentifying ? "yes" : "no",
    systems: JSON.stringify(i.systems),
    estimateIndustry: extras.estimateIndustry, estimateDesk: String(extras.estimateDesk), estimateNonDesk: String(extras.estimateNonDesk), estimateYears: String(extras.estimateYears),
    rightsAnswer: extras.rightsAnswer,
    authority: i.authority ? "yes" : "no", privacyAck: i.privacyAck ? "yes" : "no",
  };
}
