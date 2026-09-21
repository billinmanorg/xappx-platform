import type { Blueprint, Challenge, DiscoveryAIService, Industry, PrototypeSpec, SolutionDiscovery } from "./types";

/* Curated stand-in for the AI layer (brief §38). Structured industry knowledge
   with simulated latency so the "AI is working" UX is real. A live adapter can
   replace this behind the same DiscoveryAIService interface later. */

const INDUSTRIES: Industry[] = [
  { slug: "financial_services", label: "Financial Services" },
  { slug: "healthcare", label: "Healthcare" },
  { slug: "retail", label: "Retail" },
  { slug: "manufacturing", label: "Manufacturing" },
  { slug: "logistics", label: "Logistics" },
  { slug: "real_estate", label: "Real Estate" },
  { slug: "services", label: "Professional Services" },
  { slug: "education", label: "Education" },
  { slug: "tourism_hospitality", label: "Hospitality" },
  { slug: "it_bpm", label: "Technology" },
];

interface Ch { id: string; label: string; blurb?: string; outcomes: string[] }
interface Ind { stakeholders: string[]; challenges: Ch[] }

const GENERIC_OUTCOMES = [
  "Cut manual, repetitive work",
  "Respond to people faster",
  "Catch problems earlier",
  "Give staff more time for judgment calls",
  "Make the process easy to track",
];

const DATA: Record<string, Ind> = {
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
    const industryLabel = d.industry?.label ?? "your";
    const challenge = d.challenge ?? "the problem";
    const bp: Blueprint = {
      understood: `You told us the challenge is: “${challenge}”. XAPPX will tackle it with AI at the core, while keeping people in control of the decisions that matter.`,
      solutionName: `Your AI-assisted ${industryLabel} solution`,
      users: d.stakeholders.length ? d.stakeholders : ind(d.industry?.slug ?? "").stakeholders.slice(0, 3),
      workflow: ["Intake", "AI review & data extraction", "Exception handling", "Human decision", "Status update & follow-up"],
      aiOpportunities: [
        "Extract and summarize incoming information",
        "Detect missing or risky details",
        "Prioritize the queue by urgency",
        "Draft the recommended next action",
      ],
    };
    return delay(bp, 1100);
  },

  generatePrototype: (d: SolutionDiscovery) => {
    const slug = d.industry?.slug ?? "";
    const industryLabel = d.industry?.label ?? "Your";
    const noun = itemNoun(slug);
    const plural = `${noun}s`;
    const roles = d.stakeholders.length ? d.stakeholders : ind(slug).stakeholders.slice(0, 3);
    const statuses = ["New", "AI-reviewed", "Needs review", "In progress", "Approved"];
    const prios: Array<"High" | "Normal" | "Low"> = ["High", "Normal", "Normal", "Low", "Normal", "High"];
    const items = Array.from({ length: 6 }, (_, i) => ({
      id: `IT-${1040 + i}`,
      title: `${noun} #${1040 + i}`,
      assignee: roles[i % roles.length]!,
      status: statuses[i % statuses.length]!,
      priority: prios[i % prios.length]!,
    }));
    const firstOutcome = (d.outcomes[0] ?? "resolve it faster").toLowerCase();
    const spec: PrototypeSpec = {
      appName: `${industryLabel} Workspace`,
      workflowLabel: plural,
      nav: [
        { id: "dashboard", label: "Dashboard", locked: false },
        { id: "queue", label: plural, locked: false },
        { id: "reports", label: "Reports", locked: true },
        { id: "integrations", label: "Integrations", locked: true },
        { id: "automation", label: "Automation", locked: true },
        { id: "settings", label: "Settings", locked: true },
      ],
      stats: [
        { label: `Open ${plural.toLowerCase()}`, value: "42" },
        { label: "Auto-handled by AI", value: "68%", hint: "this week" },
        { label: "Avg. handling time", value: "2.4h", hint: "↓ from 3.1 days" },
        { label: "Needs your review", value: "7" },
      ],
      items,
      aiActionLabel: "Run AI review",
      aiResult: {
        summary: `XAPPY read this ${noun.toLowerCase()}, extracted the key details, and checked it against your rules.`,
        recommendation: `Recommended next step: fast-track to a human decision — this helps ${firstOutcome}.`,
        flags: ["1 document missing a signature", "Eligibility looks strong", "No fraud signals detected"],
      },
    };
    return delay(spec, 1200);
  },
};

export function getDiscoveryService(): DiscoveryAIService {
  // Swap here for a live adapter when the AI endpoint is ready.
  return mockService;
}
