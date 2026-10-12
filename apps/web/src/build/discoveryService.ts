import type { Blueprint, Challenge, DiscoveryAIService, Industry, SolutionDiscovery } from "./types";
import type { AppSpec, AppEntity, AppRole, AppView, VaultBinding } from "./appSpec";
import { prototypeFromSpec } from "./appSpec";

/* Curated stand-in for the AI layer (brief §38). Structured industry knowledge
   with simulated latency so the "AI is working" UX is real. A live adapter can
   replace this behind the same DiscoveryAIService interface later. */

// Comprehensive industry list (IBEF taxonomy). The most common sit first; the
// full set is searchable, and the /build step also lets people type their own —
// so any industry is covered (the AI tailors to whatever it's given).
const INDUSTRIES: Industry[] = [
  { slug: "events_conferences", label: "Events & Conferences" },
  { slug: "financial_services", label: "Financial Services" },
  { slug: "healthcare", label: "Healthcare" },
  { slug: "retail", label: "Retail" },
  { slug: "ecommerce", label: "E-Commerce" },
  { slug: "manufacturing", label: "Manufacturing" },
  { slug: "logistics", label: "Logistics" },
  { slug: "real_estate", label: "Real Estate" },
  { slug: "services", label: "Professional Services" },
  { slug: "education", label: "Education & Training" },
  { slug: "tourism_hospitality", label: "Hospitality & Tourism" },
  { slug: "it_bpm", label: "IT & Software" },
  { slug: "media", label: "Media & Entertainment" },
  { slug: "insurance", label: "Insurance" },
  { slug: "banking", label: "Banking" },
  { slug: "fmcg", label: "Consumer Goods (FMCG)" },
  { slug: "food_processing", label: "Food & Beverage" },
  { slug: "agriculture", label: "Agriculture & Allied" },
  { slug: "automobiles", label: "Automobiles" },
  { slug: "auto_components", label: "Auto Components" },
  { slug: "electric_vehicle", label: "Electric Vehicle" },
  { slug: "aviation", label: "Aviation" },
  { slug: "pharmaceuticals", label: "Pharmaceuticals" },
  { slug: "biotechnology", label: "Biotechnology" },
  { slug: "medical_devices", label: "Medical Devices" },
  { slug: "telecommunications", label: "Telecommunications" },
  { slug: "esdm", label: "Electronics Manufacturing" },
  { slug: "engineering", label: "Engineering & Capital Goods" },
  { slug: "construction", label: "Construction & Infrastructure" },
  { slug: "energy", label: "Energy & Power" },
  { slug: "renewable_energy", label: "Renewable Energy" },
  { slug: "oil_gas", label: "Oil & Gas" },
  { slug: "metals_mining", label: "Metals & Mining" },
  { slug: "chemicals", label: "Chemicals" },
  { slug: "textiles", label: "Textiles & Apparel" },
  { slug: "gems_jewellery", label: "Gems & Jewellery" },
  { slug: "consumer_durables", label: "Consumer Durables" },
  { slug: "paper_packaging", label: "Paper & Packaging" },
  { slug: "cement", label: "Cement & Building Materials" },
  { slug: "transport", label: "Transport & Mobility" },
  { slug: "government", label: "Government & Public Sector" },
  { slug: "nonprofit", label: "Nonprofit & NGO" },
  { slug: "legal", label: "Legal Services" },
  { slug: "marketing", label: "Marketing & Advertising" },
  { slug: "gaming", label: "Gaming & Esports" },
];

// A per-challenge blueprint keeps the generated solution concrete instead of
// boilerplate — each challenge names its own solution, workflow and AI work.
interface BP { solutionName: string; understood?: string; workflow: string[]; aiOpportunities: string[] }
interface Ch { id: string; label: string; blurb?: string; outcomes: string[]; blueprint?: BP }
interface Ind { stakeholders: string[]; challenges: Ch[] }

// Every XAPPX app is built on the Twin Vault — the secure, per-party data vault
// each person/organization owns; the AI only ever acts on what's authorized.
const TWIN_VAULT =
  "Built on the Twin Vault: every attendee, sponsor and organizer keeps their own data in a secure Twin Vault, and XAPPX's AI only acts on what each party has authorized — no central data grab.";

const GENERIC_OUTCOMES = [
  "Cut manual, repetitive work",
  "Respond to people faster",
  "Catch problems earlier",
  "Give staff more time for judgment calls",
  "Make the process easy to track",
];

const DATA: Record<string, Ind> = {
  events_conferences: {
    stakeholders: ["Attendee", "Event organizer", "Exhibitor / sponsor", "Speaker", "Registration & check-in", "Venue & operations", "Marketing team"],
    challenges: [
      {
        id: "registration", label: "Registration & check-in is slow and manual",
        outcomes: ["Cut check-in lines", "Auto-issue badges & QR passes", "Catch duplicate or unpaid registrations", "Give organizers a live headcount"],
        blueprint: {
          solutionName: "Smart Registration & Check-in",
          understood: "You're solving slow, manual registration and check-in for your event. Here's a Twin-Vault-based solution that gets attendees through the door in seconds.",
          workflow: ["Attendee registers or imports an existing ticket", "Identity & ticket verified against their Twin Vault", "AI issues a personalized badge and QR pass", "Self-serve check-in at the door in seconds", "Live headcount & no-show tracking for organizers"],
          aiOpportunities: ["Match each registration to an existing Twin Vault profile", "Flag duplicate, unpaid or suspicious sign-ups", "Auto-generate badges and personalized agendas", "Predict no-shows and walk-in load by session"],
        },
      },
      {
        id: "engagement", label: "Attendees don't engage during the event",
        outcomes: ["Drive session attendance", "Answer attendee questions instantly", "Capture live feedback & polls", "Grow networking and activity participation"],
        blueprint: {
          solutionName: "Attendee Engagement Companion",
          understood: "You want attendees doing more than showing up. Here's a Twin-Vault-based companion that guides each attendee and feeds engagement back to you.",
          workflow: ["Attendee opens their Twin-Vault-backed event profile", "XAPPY concierge answers questions & suggests sessions", "Live Q&A, polls and networking nudges in-session", "Personalized schedule reminders throughout the day", "Engagement scored and shared with organizers & sponsors"],
          aiOpportunities: ["Personalized session & people recommendations from Vault interests", "24/7 multilingual attendee concierge (XAPPY)", "Summarize sessions and surface highlights in real time", "Read sentiment from polls and chat as it happens"],
        },
      },
      {
        id: "matchmaking", label: "Sponsors & exhibitors want better leads",
        outcomes: ["Match attendees to the right sponsors", "Capture qualified leads", "Prove sponsor ROI", "Enable warm intros, not cold badge scans"],
        blueprint: {
          solutionName: "Sponsor & Exhibitor Matchmaking",
          understood: "You need sponsors to leave with real, qualified leads. Here's a consent-based, Twin-Vault matchmaking solution that proves ROI.",
          workflow: ["Attendee and sponsor goals read from their Twin Vaults (with consent)", "AI matches attendees to the most relevant exhibitors", "Consent-based intros and meeting booking", "Captured leads written back to each party's Vault", "Live sponsor ROI dashboard"],
          aiOpportunities: ["Interest-based attendee ↔ sponsor matching", "Score and qualify leads automatically", "Draft personalized outreach and meeting agendas", "Measure booth, session and spend ROI"],
        },
      },
      {
        id: "agenda", label: "Attendees can't navigate a packed agenda",
        outcomes: ["Personalize each attendee's schedule", "Balance overcrowded sessions", "Surface must-see sessions", "Keep everyone on time"],
        blueprint: {
          solutionName: "Personalized Agenda Builder",
          understood: "A packed multi-track agenda is overwhelming your attendees. Here's a Twin-Vault-based planner that builds each person their own schedule.",
          workflow: ["Attendee interests & goals pulled from their Twin Vault", "AI drafts a personalized, conflict-free agenda", "Attendee edits and locks their schedule", "Smart reminders and room-change alerts", "Organizers see demand per session and rebalance rooms"],
          aiOpportunities: ["Build a personalized agenda from Vault interests", "Predict and smooth session overcrowding", "Recommend must-see sessions and speakers", "Re-route attendees live when rooms fill up"],
        },
      },
      {
        id: "followup", label: "Post-event follow-up & ROI is weak",
        outcomes: ["Automate thank-you & recap", "Deliver session recordings & summaries", "Nurture leads after the event", "Report ROI to every stakeholder"],
        blueprint: {
          solutionName: "Post-Event Follow-up & ROI",
          understood: "The value leaks away after the doors close. Here's a Twin-Vault-based follow-up solution that turns the event into lasting outcomes.",
          workflow: ["Each attendee's sessions & contacts recorded in their Twin Vault", "AI drafts personalized recaps, summaries and thank-yous", "Session recordings & notes delivered to the right people", "Leads routed and nurtured with consent", "ROI report generated for organizers and sponsors"],
          aiOpportunities: ["Summarize each attendee's personal event journey", "Draft tailored follow-ups per attendee and sponsor", "Prioritize and nurture the warmest leads", "Compile attendance, engagement and ROI reports"],
        },
      },
      {
        id: "logistics", label: "Organizer comms & logistics are chaotic",
        outcomes: ["Centralize schedules & changes", "Alert staff & attendees instantly", "Track tasks, vendors & rooms", "React to issues in real time"],
        blueprint: {
          solutionName: "Event Operations Command Center",
          understood: "Running the event day is chaos across chats and spreadsheets. Here's a Twin-Vault-based command center that keeps everyone in sync.",
          workflow: ["Schedule, staff, vendors and rooms in one shared view", "Change made once, pushed to everyone affected", "AI alerts the right staff and attendees instantly", "Tasks and vendor SLAs tracked to completion", "Incidents triaged and escalated in real time"],
          aiOpportunities: ["Turn a change into the right targeted notifications", "Draft staff and attendee comms automatically", "Flag at-risk tasks, vendors and rooms early", "Summarize the day's incidents and resolutions"],
        },
      },
    ],
  },
  financial_services: {
    stakeholders: ["Customer / applicant", "Relationship manager", "Credit analyst", "Underwriter", "Compliance officer", "Operations team", "Branch manager"],
    challenges: [
      { id: "loan", label: "Loan approvals take too long", outcomes: ["Speed up eligibility checks", "Auto-flag incomplete applications", "Give applicants real-time status", "Prioritize urgent cases"] },
      { id: "onboarding", label: "Manual customer onboarding", outcomes: ["Auto-verify identity documents", "Cut data re-entry", "Shorten time-to-account", "Keep an audit trail"] },
      { id: "support", label: "High support volume", outcomes: ["Answer common questions 24/7", "Route complex cases to people", "Reduce wait times", "Log every interaction"] },
      { id: "fraud", label: "Fraud & risk review bottlenecks", outcomes: ["Surface risky cases first", "Summarize the evidence", "Reduce false positives", "Keep humans on final calls"] },
    ],
  },
  healthcare: {
    stakeholders: ["Patient", "Front-desk staff", "Nurse", "Physician", "Care coordinator", "Billing team", "Administrator"],
    challenges: [
      { id: "intake", label: "Patient intake is slow", outcomes: ["Capture patient data before the visit", "Cut paperwork at the desk", "Reduce no-shows", "Flag missing information"] },
      { id: "scheduling", label: "Appointments & no-shows", outcomes: ["Automate reminders & rescheduling", "Fill cancelled slots", "Reduce no-shows", "Free up front-desk time"] },
      { id: "records", label: "Records scattered across systems", outcomes: ["Bring records into one view", "Summarize a patient's history", "Cut time searching", "Keep access controlled"] },
      { id: "followup", label: "Follow-up falls through the cracks", outcomes: ["Automate post-visit follow-up", "Prioritize at-risk patients", "Track outcomes", "Loop in the care team"] },
    ],
  },
  retail: {
    stakeholders: ["Shopper", "Store associate", "E-commerce manager", "Merchandiser", "Support agent", "Marketing team", "Operations"],
    challenges: [
      { id: "conversion", label: "Shoppers leave without buying", outcomes: ["Answer product questions instantly", "Recommend the right items", "Recover abandoned carts", "Guide to checkout"] },
      { id: "support", label: "Support can't keep up", outcomes: ["Handle FAQs 24/7", "Track orders automatically", "Escalate real issues to staff", "Cut response time"] },
      { id: "inventory", label: "Inventory & demand guesswork", outcomes: ["Forecast demand", "Flag low stock early", "Reduce overstock", "Give staff clear signals"] },
      { id: "loyalty", label: "Weak repeat purchase & loyalty", outcomes: ["Personalize offers", "Automate win-back", "Reward the right customers", "Grow repeat sales"] },
    ],
  },
  manufacturing: {
    stakeholders: ["Operator", "Line supervisor", "Quality inspector", "Maintenance tech", "Plant manager", "Procurement", "Planner"],
    challenges: [
      { id: "quality", label: "Quality issues caught too late", outcomes: ["Flag defects earlier", "Summarize root causes", "Reduce rework", "Keep an inspection trail"] },
      { id: "downtime", label: "Unplanned downtime", outcomes: ["Predict maintenance needs", "Prioritize urgent repairs", "Cut downtime", "Guide technicians"] },
      { id: "planning", label: "Production planning is manual", outcomes: ["Balance the schedule", "Flag material shortages", "React to changes faster", "Give planners clarity"] },
      { id: "orders", label: "Slow order & quote handling", outcomes: ["Auto-draft quotes", "Extract order details", "Cut turnaround", "Reduce errors"] },
    ],
  },
  logistics: {
    stakeholders: ["Customer", "Dispatcher", "Driver", "Warehouse staff", "Operations manager", "Support team", "Planner"],
    challenges: [
      { id: "tracking", label: "Status updates eat the whole day", outcomes: ["Update customers automatically", "Track shipments end to end", "Flag delays early", "Cut inbound calls"] },
      { id: "routing", label: "Routing & scheduling is manual", outcomes: ["Optimize routes", "React to disruptions", "Balance driver loads", "Improve on-time rate"] },
      { id: "exceptions", label: "Exceptions handled by hand", outcomes: ["Detect exceptions automatically", "Prioritize what matters", "Draft the resolution", "Keep customers informed"] },
      { id: "docs", label: "Paperwork & customs friction", outcomes: ["Extract document data", "Flag missing paperwork", "Speed up clearance", "Reduce manual entry"] },
    ],
  },
  services: {
    stakeholders: ["Client", "Account manager", "Consultant", "Project lead", "Operations", "Finance", "Partner"],
    challenges: [
      { id: "intake", label: "Client intake & scoping is slow", outcomes: ["Capture needs up front", "Draft scopes faster", "Reduce back-and-forth", "Qualify leads automatically"] },
      { id: "knowledge", label: "Knowledge is hard to find", outcomes: ["Search past work instantly", "Summarize documents", "Reuse what works", "Onboard faster"] },
      { id: "followup", label: "Follow-up & proposals lag", outcomes: ["Automate follow-up", "Draft proposals", "Prioritize hot leads", "Never miss a deadline"] },
      { id: "reporting", label: "Reporting eats billable time", outcomes: ["Auto-compile updates", "Summarize status", "Cut admin time", "Keep clients informed"] },
    ],
  },
};

const GENERIC: Ind = {
  stakeholders: ["Customer", "Front-line staff", "Team lead", "Manager", "Operations", "Administrator"],
  challenges: [
    { id: "leads", label: "Get more leads & sell online", outcomes: GENERIC_OUTCOMES },
    { id: "support", label: "Answer customers 24/7", outcomes: GENERIC_OUTCOMES },
    { id: "automate", label: "Automate follow-up & scheduling", outcomes: GENERIC_OUTCOMES },
    { id: "knowledge", label: "Organize knowledge & documents", outcomes: GENERIC_OUTCOMES },
    { id: "onboard", label: "Onboard customers or members", outcomes: GENERIC_OUTCOMES },
    { id: "internal", label: "Streamline internal operations", outcomes: GENERIC_OUTCOMES },
  ],
};

const ITEM: Record<string, string> = {
  events_conferences: "Registration",
  financial_services: "Loan application",
  healthcare: "Patient case",
  retail: "Order",
  manufacturing: "Work order",
  logistics: "Shipment",
  services: "Client request",
};
const itemNoun = (slug: string) => ITEM[slug] ?? "Request";

const ind = (slug: string): Ind => DATA[slug] ?? GENERIC;
const delay = <T,>(v: T, ms = 700): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

// ---- App Spec generation -------------------------------------------------
// The concrete data model + AI behavior per challenge. Today curated (mock);
// the live AI will generate the same AppSpec shape later. Keyed by challenge id.
type EntitySpec = { entity: AppEntity; primaryAIAction: string; aiResult: { summary: string; recommendation: string; flags: string[] } };

const NAMES = ["Priya Sharma", "Marcus Lee", "Aisha Khan", "Tom Becker", "Lena Ortiz", "Raj Patel"];
const COMPANIES = ["Acme", "Globex", "Initech", "Hooli", "Stark", "Umbrella"];

const ENTITY_SPECS: Record<string, EntitySpec> = {
  registration: {
    entity: {
      name: "registration", label: "Registration", labelPlural: "Registrations", statusField: "status",
      fields: [
        { name: "attendee", label: "Attendee", type: "text", vaultOwned: true, samples: NAMES },
        { name: "email", label: "Email", type: "email", vaultOwned: true, samples: ["priya@acme.io", "marcus@globex.com", "aisha@initech.co", "tom@hooli.com", "lena@stark.io", "raj@umbrella.co"] },
        { name: "ticket", label: "Ticket", type: "select", options: ["General", "VIP", "Speaker", "Exhibitor"] },
        { name: "company", label: "Company", type: "text", samples: COMPANIES },
        { name: "status", label: "Status", type: "status", options: ["New", "Verified", "Checked-in", "Needs review"] },
      ],
    },
    primaryAIAction: "Verify & issue badge",
    aiResult: {
      summary: "XAPPY matched this registration to the attendee's Twin Vault, verified the ticket, and generated a badge and QR pass.",
      flags: ["Ticket valid · paid", "Matched to an existing Twin Vault profile", "No duplicate registration found"],
      recommendation: "Recommended: auto-issue the badge & QR pass — this helps cut check-in lines.",
    },
  },
  engagement: {
    entity: {
      name: "attendee", label: "Attendee", labelPlural: "Attendees", statusField: "status",
      fields: [
        { name: "attendee", label: "Attendee", type: "text", vaultOwned: true, samples: NAMES },
        { name: "interests", label: "Interests", type: "text", vaultOwned: true, samples: ["AI · Fintech", "Web3 · Payments", "Healthtech", "Martech", "Climate", "Gaming"] },
        { name: "saved", label: "Sessions saved", type: "number" },
        { name: "status", label: "Engagement", type: "status", options: ["Invited", "Active", "Highly engaged", "At risk"] },
      ],
    },
    primaryAIAction: "Suggest sessions & intros",
    aiResult: {
      summary: "XAPPY read this attendee's Twin Vault interests and suggested the most relevant sessions and people to meet.",
      flags: ["3 must-see sessions matched", "2 high-value intros available", "Prefers afternoon tracks"],
      recommendation: "Recommended: send a personalized agenda and 2 intro requests — this helps drive engagement.",
    },
  },
  matchmaking: {
    entity: {
      name: "lead", label: "Lead", labelPlural: "Leads", statusField: "status",
      fields: [
        { name: "attendee", label: "Attendee", type: "text", vaultOwned: true, samples: NAMES },
        { name: "sponsor", label: "Sponsor", type: "text", samples: COMPANIES },
        { name: "fit", label: "Fit", type: "select", options: ["Hot", "Warm", "Exploratory"] },
        { name: "status", label: "Status", type: "status", options: ["Suggested", "Intro sent", "Meeting booked", "Followed up"] },
      ],
    },
    primaryAIAction: "Score & draft intro",
    aiResult: {
      summary: "XAPPY matched this attendee and sponsor from their Twin Vault goals, scored the fit, and drafted a meeting agenda.",
      flags: ["Strong interest overlap", "Budget & authority signals present", "Consent to share granted"],
      recommendation: "Recommended: send a warm intro with a 15-minute meeting slot — this helps capture qualified leads.",
    },
  },
  agenda: {
    entity: {
      name: "session", label: "Session", labelPlural: "Sessions", statusField: "status",
      fields: [
        { name: "session", label: "Session", type: "text", samples: ["Keynote: The AI Shift", "Workshop: Agents 101", "Panel: Web3 Payments", "Fireside: Scaling AI", "Track: Healthtech", "Deep-dive: Twin Vault"] },
        { name: "room", label: "Room", type: "text", samples: ["Hall A", "Room 2", "Room 3", "Hall B", "Room 4", "Studio"] },
        { name: "time", label: "Time", type: "text", samples: ["09:00", "10:30", "11:45", "14:00", "15:30", "16:45"] },
        { name: "status", label: "Capacity", type: "status", options: ["Open", "Filling", "Full", "Overflow"] },
      ],
    },
    primaryAIAction: "Balance & recommend",
    aiResult: {
      summary: "XAPPY checked demand from attendees' Twin-Vault interests and flagged overcrowding and must-see gaps.",
      flags: ["Projected 120% capacity", "2 clashing must-see sessions", "Larger room available"],
      recommendation: "Recommended: move to a larger room and nudge 40 attendees to an alternate — this helps balance sessions.",
    },
  },
  followup: {
    entity: {
      name: "followup", label: "Follow-up", labelPlural: "Follow-ups", statusField: "status",
      fields: [
        { name: "attendee", label: "Attendee", type: "text", vaultOwned: true, samples: NAMES },
        { name: "sessions", label: "Sessions attended", type: "number" },
        { name: "owner", label: "Owner", type: "text", samples: ["Dana", "Omar", "Kim", "Lee", "Dana", "Omar"] },
        { name: "status", label: "Status", type: "status", options: ["Pending", "Recap sent", "Nurturing", "Converted"] },
      ],
    },
    primaryAIAction: "Draft recap & next step",
    aiResult: {
      summary: "XAPPY summarized this attendee's event journey from their Twin Vault and drafted a personalized recap and next step.",
      flags: ["Attended 4 sessions", "2 sponsor meetings", "High intent signals"],
      recommendation: "Recommended: send the personalized recap and a tailored offer — this helps nurture leads after the event.",
    },
  },
  logistics: {
    entity: {
      name: "task", label: "Task", labelPlural: "Tasks", statusField: "status",
      fields: [
        { name: "task", label: "Task", type: "text", samples: ["AV check – Hall A", "Catering setup", "Speaker green room", "Signage install", "Registration desks", "Wi-Fi load test"] },
        { name: "owner", label: "Owner", type: "text", samples: ["Ops", "AV vendor", "Catering", "Facilities", "Front desk", "IT"] },
        { name: "due", label: "Due", type: "text", samples: ["08:00", "09:30", "10:00", "12:00", "13:30", "16:00"] },
        { name: "status", label: "Status", type: "status", options: ["To do", "In progress", "Blocked", "Done"] },
      ],
    },
    primaryAIAction: "Alert owners & triage",
    aiResult: {
      summary: "XAPPY turned this change into targeted alerts and flagged at-risk tasks and vendors.",
      flags: ["2 tasks at risk", "Vendor SLA tight", "3 staff to notify"],
      recommendation: "Recommended: notify the 3 owners now and escalate the blocked task — this helps keep the day on track.",
    },
  },
};

function genericEntitySpec(slug: string): EntitySpec {
  const noun = itemNoun(slug);
  return {
    entity: {
      name: noun.replace(/\s+/g, "").toLowerCase() || "record", label: noun, labelPlural: `${noun}s`, statusField: "status",
      fields: [
        { name: "title", label: noun, type: "text", vaultOwned: true },
        { name: "owner", label: "Owner", type: "text" },
        { name: "status", label: "Status", type: "status", options: ["New", "AI-reviewed", "Needs review", "Approved"] },
      ],
    },
    primaryAIAction: "Run AI review",
    aiResult: {
      summary: `XAPPY read this ${noun.toLowerCase()} using only the data authorized in the Twin Vault, extracted the key details, and checked it against your rules.`,
      flags: ["Key details extracted", "Looks complete", "No issues detected"],
      recommendation: "Recommended next step: fast-track to a human decision.",
    },
  };
}

// Turn a completed discovery into a full, backend-ready App Spec.
export function buildAppSpec(d: SolutionDiscovery): AppSpec {
  const slug = d.industry?.slug ?? "";
  const industryLabel = d.industry?.label ?? "Your industry";
  const challenge = d.challenge ?? "the problem";
  const ch = ind(slug).challenges.find((c) => c.label === challenge);
  const bp = ch?.blueprint;
  const es = (ch && ENTITY_SPECS[ch.id]) || genericEntitySpec(slug);
  const entity = es.entity;

  const people = d.stakeholders.length ? d.stakeholders : ind(slug).stakeholders.slice(0, 3);
  const roles: AppRole[] = people.slice(0, 4).map((label, i, arr) => ({
    name: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    label,
    access: i === 0 ? "admin" : i === arr.length - 1 ? "member" : "staff",
  }));
  const memberLabel = roles[roles.length - 1]?.label ?? "Member";

  const views: AppView[] = [
    { id: "dashboard", label: "Dashboard", kind: "dashboard", locked: false },
    { id: "queue", label: entity.labelPlural, kind: "list", entity: entity.name, locked: false },
    { id: "vault", label: "Twin Vault", kind: "vault", locked: false },
    { id: "reports", label: "Reports", kind: "reports", locked: true },
    { id: "integrations", label: "Integrations", kind: "integrations", locked: true },
    { id: "automation", label: "Automation", kind: "automation", locked: true },
    { id: "settings", label: "Settings", kind: "settings", locked: true },
  ];
  const vaultBindings: VaultBinding[] = [{
    entity: entity.name, owner: memberLabel,
    note: `${entity.label} data lives in each ${memberLabel.toLowerCase()}'s Twin Vault; the app reads and writes only what's authorized.`,
  }];

  return {
    name: bp?.solutionName ?? `Your ${industryLabel} app`,
    industry: industryLabel,
    challenge,
    summary: bp?.understood ?? `You're solving “${challenge}” in ${industryLabel}.`,
    foundation: TWIN_VAULT,
    entities: [entity],
    roles,
    views,
    workflow: (bp?.workflow ?? ["Capture the request", "AI review & checks", "Exception handling", "Human decision", "Follow-up"]).map((label) => ({ label })),
    aiActions: (bp?.aiOpportunities ?? ["Extract & summarize", "Detect issues", "Prioritize the queue", "Draft the next action"]).map((label) => ({ label })),
    primaryAIAction: es.primaryAIAction,
    vaultBindings,
    aiResult: es.aiResult,
  };
}

export const mockService: DiscoveryAIService = {
  getIndustries: () => INDUSTRIES,

  getChallenges: (slug) =>
    delay(ind(slug).challenges.map(({ id, label, blurb }): Challenge => ({ id, label, blurb })), 800),

  getStakeholders: (slug) => delay(ind(slug).stakeholders, 750),

  getOutcomes: (slug, challenge) => {
    const found = ind(slug).challenges.find((c) => c.label === challenge);
    return delay(found ? found.outcomes : GENERIC_OUTCOMES, 750);
  },

  generateBlueprint: (d: SolutionDiscovery) => {
    const slug = d.industry?.slug ?? "";
    const industryLabel = d.industry?.label ?? "your";
    const challenge = d.challenge ?? "the problem";
    const users = d.stakeholders.length ? d.stakeholders : ind(slug).stakeholders.slice(0, 4);
    // Use the challenge's own concrete blueprint when we have one; otherwise a
    // smarter generic that still names the challenge and the Twin Vault.
    const spec = ind(slug).challenges.find((c) => c.label === challenge)?.blueprint;
    const bp: Blueprint = spec
      ? {
          understood: spec.understood ?? `You're solving: “${challenge}” in ${industryLabel}. Here's how XAPPX would build it — AI at the core, people in control, all on the Twin Vault.`,
          solutionName: spec.solutionName,
          users,
          workflow: spec.workflow,
          aiOpportunities: spec.aiOpportunities,
          foundation: TWIN_VAULT,
        }
      : {
          understood: `You're solving: “${challenge}” in ${industryLabel}. XAPPX puts AI at the core while keeping people in control of the decisions that matter.`,
          solutionName: `Your ${industryLabel} AI solution`,
          users,
          workflow: ["Capture the request or data", "AI reviews, extracts and checks it against your rules", "Exceptions flagged for a person", "Human makes the decision", "Status update, follow-up and record in the Twin Vault"],
          aiOpportunities: ["Extract and summarize incoming information", "Detect missing or risky details", "Prioritize the queue by urgency", "Draft the recommended next action"],
          foundation: TWIN_VAULT,
        };
    return delay(bp, 1100);
  },

  // The prototype is now a projection of the App Spec — same definition that
  // will drive the real web-runtime app, so preview and production stay in sync.
  generatePrototype: (d: SolutionDiscovery) => delay(prototypeFromSpec(buildAppSpec(d)), 1200),
};
