// Copy and option lists for /data-licensing, taken from the build brief's
// XAPPX draft text (not from the public reference). Owner-approved copy can be
// mapped onto these same slots later.

export const NOTICE_VERSION = "2026-11-25";
export const CONTACT_EMAIL = "info.xappx@gmail.com";

export const BENEFITS = [
  { title: "Keep your originals.", body: "This does not replace your existing systems." },
  { title: "Agree on what is shared.", body: "The information and safeguards are agreed before any transfer." },
  { title: "Review potential compensation.", body: "If a proposal is made, review the amount and terms before deciding." },
];

export const PROCESS = [
  { title: "Check initial fit.", body: "Tell us about your business in five questions." },
  { title: "Describe your systems.", body: "Share what kinds of records are available, not the records themselves." },
  { title: "Review any proposal.", body: "Decide only after you understand the scope, safeguards and terms." },
];

export const CATEGORIES = ["Email", "Documents", "Chat", "Calls", "CRM", "Billing"];

export const FAQ: { q: string; a: string }[] = [
  { q: "What is a data license?", a: "An agreement grants defined rights to use an approved copy of eligible records. Your business keeps its originals." },
  { q: "Who may qualify?", a: "US businesses with operating history and rights to the records. Screening does not guarantee acceptance." },
  { q: "What could we earn?", a: "The estimate is illustrative. Any offer depends on the records, rights, quality, relevance and buyer review." },
  { q: "How is privacy handled?", a: "Before any transfer, review what will be excluded, what safeguards apply and who would be allowed to receive it." },
  { q: "Do I need to send files or log in?", a: "No. This inquiry only asks you to describe your business and systems." },
  { q: "Why is this data valuable?", a: "Historical records can help AI developers learn how real business workflows operate. Confirm permitted uses in any proposed agreement." },
  { q: "Do I keep running my business as usual?", a: "The inquiry does not change how you operate or require you to give up your original records." },
  { q: "How long does it take?", a: "You can start with the short check. Review and any later licensing timeline depend on the scope and agreement." },
  { q: "Is it binding?", a: "No. Submitting an inquiry does not grant a license or authorize data access." },
  { q: "Who handles the inquiry?", a: "XAPPX reviews it first. Before proceeding, ask who would receive the records, how they could use them and whether any onward sharing is permitted." },
];

/** Systems offered as selectable cards (plus search over the same list). */
export const SYSTEMS: { id: string; label: string; kind: string }[] = [
  { id: "gmail", label: "Gmail / Google Workspace", kind: "Email" },
  { id: "m365", label: "Microsoft 365 / Outlook", kind: "Email" },
  { id: "slack", label: "Slack", kind: "Chat" },
  { id: "teams", label: "Microsoft Teams", kind: "Chat" },
  { id: "salesforce", label: "Salesforce", kind: "CRM" },
  { id: "hubspot", label: "HubSpot", kind: "CRM" },
  { id: "gdrive", label: "Google Drive", kind: "Documents" },
  { id: "dropbox", label: "Dropbox", kind: "Documents" },
  { id: "sharepoint", label: "SharePoint / OneDrive", kind: "Documents" },
  { id: "zoom", label: "Zoom / call recordings", kind: "Calls" },
  { id: "ringcentral", label: "RingCentral / phone system", kind: "Calls" },
  { id: "quickbooks", label: "QuickBooks", kind: "Billing" },
  { id: "xero", label: "Xero", kind: "Billing" },
  { id: "stripe", label: "Stripe", kind: "Billing" },
  { id: "zendesk", label: "Zendesk / help desk", kind: "Chat" },
  { id: "notion", label: "Notion / Confluence", kind: "Documents" },
];

export const DATA_TYPES = ["Email", "Documents", "Chat", "Calls", "CRM", "Billing", "Other"];
export const COUNT_UNITS = ["messages", "threads", "documents", "files", "calls", "hours of recordings", "records", "invoices"];
export const COVERAGE = ["All", "Partial", "Excluded"] as const;
export const OWNERSHIP_TYPES = ["Privately held", "Partnership", "Franchise", "Nonprofit", "Public company", "Other"];
export const DECISION_ROLES = ["Owner / founder", "Executive", "Manager", "Other"];
export const RIGHTS_KNOWN = ["Yes, we own these records", "Mostly, with some exceptions", "Unsure", "No"];
export const RESTRICTIONS = ["None known", "Some contracts restrict sharing", "Unsure"];
export const RETENTION = ["Kept indefinitely", "Auto-deleted after a period", "Mixed", "Unsure"];
export const SENSITIVE_FLAGS = ["Health information", "Financial account details", "Information about minors", "Biometric data", "None of these", "Unsure"];
export const REVENUE_RANGES = ["Prefer not to say", "Under $1M", "$1M to $5M", "$5M to $25M", "$25M to $100M", "Over $100M"];
export const OPERATING_STATUS = ["Operating", "Winding down", "Closed", "Acquired / merged"];
export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
