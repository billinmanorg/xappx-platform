/** Illustrative comparison only. These are not approved commercial offers. */
export const PREVIEW_PLANS: readonly {
  id: "starter" | "professional" | "agency";
  name: string;
  monthlyUsd: number;
  activeApps: number;
  editors: number;
}[] = [
  { id: "starter", name: "Starter", monthlyUsd: 49, activeApps: 1, editors: 2 },
  { id: "professional", name: "Professional", monthlyUsd: 129, activeApps: 5, editors: 5 },
  { id: "agency", name: "Agency", monthlyUsd: 299, activeApps: 15, editors: 15 },
];
