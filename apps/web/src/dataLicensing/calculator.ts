/**
 * Data-licensing estimator (shared by the landing estimator and the results
 * view). The formula is NOT invented here: the brief forbids guessing a dollar
 * model or extrapolating from the recorded examples. The module runs only when
 * owner-authorized rules are supplied (RULES below); until then `estimate()`
 * returns null and the UI shows a "pending approval" state.
 *
 * When the owner sends the rules, fill in RULES (version it), run
 * `npm run test:data-licensing` (fixtures below must match), and ship.
 */

export type HomeIndustry = "legal" | "real_estate" | "finance" | "small_business" | "other";
/** The qualifier's industry list differs from the home estimator's. */
export type QualifyIndustry = "legal" | "real_estate" | "medical_accounting_finance" | "small_business" | "other";

export interface EstimateInputs {
  industry: HomeIndustry;
  /** Full-time desk employees. */
  desk: number;
  /** Non-desk (field) employees. */
  nonDesk: number;
  /** Years of operating history. */
  years: number;
}

export interface EstimateRange { low: number; high: number }

/**
 * Owner-provided rules. The shape is deliberately generic: a per-industry
 * weight, per-employee weights, an operating-history curve, floor/cap and the
 * rounding step. Replace or extend once the authorized export arrives.
 */
export interface EstimatorRules {
  version: string;
  source: string;
  roundTo: number;
  industryWeight: Record<HomeIndustry, number>;
  compute: (inputs: EstimateInputs, rules: EstimatorRules) => EstimateRange;
}

/** Authorized rules. null = not yet provided by the owner (release gate). */
export const RULES: EstimatorRules | null = null;

export const HOME_LIMITS = {
  desk: { min: 1, max: 500, default: 30 },
  nonDesk: { min: 0, max: 500, default: 5 },
  years: { min: 1, max: 30, default: 5 },
} as const;

export const QUALIFY_LIMITS = {
  desk: { min: 0, max: 100_000 },
  years: { min: 0, max: 200 },
} as const;

export const HOME_INDUSTRIES: { id: HomeIndustry; label: string }[] = [
  { id: "legal", label: "Legal" },
  { id: "real_estate", label: "Real Estate" },
  { id: "finance", label: "Finance" },
  { id: "small_business", label: "Small Business" },
  { id: "other", label: "Other" },
];

export const QUALIFY_INDUSTRIES: { id: QualifyIndustry; label: string; home: HomeIndustry }[] = [
  { id: "legal", label: "Legal", home: "legal" },
  { id: "real_estate", label: "Real Estate", home: "real_estate" },
  { id: "medical_accounting_finance", label: "Medical, Accounting & Finance", home: "finance" },
  { id: "small_business", label: "Small Business", home: "small_business" },
  { id: "other", label: "Other", home: "other" },
];

export const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

/** Round to the nearest `step` (the reference says nearest $10K). */
export const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function estimate(inputs: EstimateInputs, rules: EstimatorRules | null = RULES): EstimateRange | null {
  if (!rules) return null;
  const r = rules.compute(inputs, rules);
  return { low: roundTo(r.low, rules.roundTo), high: roundTo(r.high, rules.roundTo) };
}

/** "$160K", "$3.77M" — the reference's display style. */
export function formatUsd(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${(Math.round(m * 100) / 100).toString().replace(/\.?0+$/, "")}M`;
  }
  return `$${Math.round(v / 1000)}K`;
}

/**
 * QA fixtures recorded from the public reference (brief, page 6). They are
 * acceptance tests for the authorized rules, NOT a lookup table: the UI never
 * reads them.
 */
export const FIXTURES: { inputs: EstimateInputs; expect: EstimateRange }[] = [
  { inputs: { industry: "small_business", desk: 30, nonDesk: 5, years: 5 }, expect: { low: 160_000, high: 640_000 } },
  { inputs: { industry: "other", desk: 30, nonDesk: 5, years: 5 }, expect: { low: 160_000, high: 640_000 } },
  { inputs: { industry: "legal", desk: 30, nonDesk: 5, years: 5 }, expect: { low: 210_000, high: 840_000 } },
  { inputs: { industry: "finance", desk: 30, nonDesk: 5, years: 5 }, expect: { low: 210_000, high: 840_000 } },
  { inputs: { industry: "real_estate", desk: 30, nonDesk: 5, years: 5 }, expect: { low: 200_000, high: 810_000 } },
  { inputs: { industry: "other", desk: 499, nonDesk: 0, years: 30 }, expect: { low: 940_000, high: 3_770_000 } },
  { inputs: { industry: "legal", desk: 1, nonDesk: 0, years: 1 }, expect: { low: 60_000, high: 220_000 } },
  { inputs: { industry: "legal", desk: 500, nonDesk: 0, years: 1 }, expect: { low: 970_000, high: 3_890_000 } },
  { inputs: { industry: "legal", desk: 500, nonDesk: 500, years: 1 }, expect: { low: 1_060_000, high: 4_230_000 } },
  { inputs: { industry: "legal", desk: 500, nonDesk: 500, years: 30 }, expect: { low: 1_310_000, high: 5_240_000 } },
  { inputs: { industry: "finance", desk: 500, nonDesk: 500, years: 30 }, expect: { low: 1_310_000, high: 5_240_000 } },
];
