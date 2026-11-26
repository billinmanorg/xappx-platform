// Site routes that more than one component needs to agree on.
// Data Licensing ships as an unlisted private preview until the estimator
// rules and launch checks pass (build brief, Nov 24). Flip PUBLIC at launch:
// the route, the nav link and the Solutions card all follow it.
export const DATA_LICENSING = {
  PUBLIC: false,
  path: "/data-licensing",
  previewPath: "/data-licensing-preview",
} as const;

/** Where a "Data Licensing" link should point right now, or null while unlisted. */
export const dataLicensingHref = (): string | null => (DATA_LICENSING.PUBLIC ? DATA_LICENSING.path : null);
