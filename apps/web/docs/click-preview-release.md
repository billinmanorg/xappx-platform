# Click-first preview release handoff

Verification session: 12–13 October 2026 (UTC). This is a local release candidate; publication, browser acceptance and deployment are pending.

## Source identity and release status

- Branch: `preview/xappx-click-first`
- Protected baseline: `096a27d024b572e1ae856ce7815e50dfa4859401`
- Locally tested implementation commit: `b5f687d29c9c9cac10383a80ebcf8c249bdb6733`
- This release record is a documentation-only follow-up to that tested implementation commit. Record the final remote commit separately when publishing; CI must run on that exact SHA.
- Verified remote SHA: **Pending publication**
- Draft PR: **Pending publication**
- Browser CI run/result: **Pending publication and real execution**
- Render service ID and actual HTTPS URL: **Pending creation**
- Deployed commit SHA: **Not deployed**
- Manual visual/accessibility approval and reviewed screenshots: **Pending**

No placeholder hostname or planned SHA is evidence of a deployment. Do not mark browser acceptance passed from test discovery, build output or HTTP-only checks.

## Local command results

Commands ran from `apps/web` with Node `v22.23.3` and npm `11.9.0`.

| Command | Result |
| --- | --- |
| `npm ci` | Passed: fresh installation of 197 locked packages. Initial attempt hit a missing default npm cache path; retry with a writable task-local npm cache succeeded. No lockfile changes. |
| `npm run lint` | Passed |
| `npm run typecheck:click-preview` | Passed |
| `npm run test:click-preview` | Passed: 363 tests in 8 files after the final navigation corrections |
| `npm run build` | Passed: existing-site regression build only |
| `npm run build:preview` | Passed: existing single-file regression build only |
| `npm run build:click-preview` | Passed: isolated `dist-click-preview` output |
| `npm run check:click-preview` | Passed: isolated artifact safety and production CSP |
| `npm run test:e2e:click-preview -- --list` | Discovered 64 tests in 5 files; **not executed** |
| `npm run test:e2e:click-preview` | **Environment-blocked, not passed.** Browser download returned HTML and installed Chromium could not create required sockets. Known blocked launch routes were not retried. |
| Local Vite preview HTTP checks | `/` and `/build`, each directly loaded and reloaded: HTTP 200 and byte-identical isolated entry. JavaScript/browser behavior was not evaluated by these HTTP checks. |
| `git diff --check` | Passed |
| Protected baseline comparison | Zero diff for original HTML, public assets/widget, all `src/build` including non-Events definitions, original main/App entries, Netlify files and root `render.yaml`. |

The supplied artwork, source artwork, built image and HTTP-served image matched byte-for-byte. SHA-256: `4b86c5bd3a09586372afb4a8db341f7015c9aef1843b0d1b391d94e3d5708f6d`.

## Acceptance coverage and evidence limits

`test/click-preview/acceptance.spec.ts` adds 18 release-focused browser cases to the existing 44 cases:

- All three workflows at 375, 768 and 1440px with reduced motion; touch activation at 375px and keyboard activation at larger widths.
- Pre-bootstrap instrumentation for storage writes and fetch, XHR, beacon, WebSocket and EventSource attempts. Browser network interception permits only same-origin entry documents and built assets without query content.
- Supplied Xappy artwork bytes and rendered dimensions, axe violations, horizontal overflow, and at least 44px width and height for available controls.
- Preserved recommendation batches, three distinct ordered actions, visible third result before plans, locked mutations, disabled checkout, Back/Forward, reset cancellation/confirmation and clean reload.
- Optional inert text capped at 500 characters; repeated None fit/Back; honest empty results and broader browsing; corrupt/incomplete discovery and denied storage recovery.
- Direct `/` and `/build` entry/reload.

Existing browser cases additionally cover all nine categories, concepts, workflow-switch confirmation, stale/repeated actions, interrupted navigation, focus trapping and skip-link history. The final navigation corrections extend the three-workflow cases at every width with Overview-to-list keyboard focus before and after completion, including operations Tasks and Incidents. Two additional native Back/Forward cases cover stale goal routes after Something else with blank or populated notes, current selections, and unchanged history positions.

The new browser cases compile and are discoverable. They have not run in this environment. Screenshot calls are prepared, including third-result captures, but there are no reviewed screenshots from this verification session. Automated axe and dimension checks do not replace a visual review of focus, artwork, contrast, clipping or mobile layout.

Two scoped defense gaps were reproduced before fixing:

1. The artifact verifier previously accepted absent/weakened production CSP. It now requires the canonical approved production policy exactly, rejects all additional directives and requires the policy to precede executable content in the document head.
2. Supplied catalog data could demote a canonical working-preview ID and shadow the real entry. Invalid demotions are now rejected before de-duplication.

The focused suite showed 15 expected failures before those changes and passed 78/78 afterward; the full suite then passed 349/349.

Review correction on 13 October: additional script/style element/attribute source directives could override the checked fallback directives. Seven further regressions were observed failing first, covering all four override types, an extra self-only override, an unknown directive and non-ASCII separators. The verifier now compares decoded policy content directly to the canonical build policy, so extra directives and alternate serialization fail closed. Intentional future policy changes must update the build, verifier, tests and Render header together.

All seven new CSP regressions pass. That correction's full suite passed 356/356; lint, preview typecheck, all three builds and artifact verification were rerun successfully. A test-harness worker timeout was resolved by yielding between synchronous verifier subprocess checks; no assertions were relaxed. The final rebuilt HTML, verifier policy and Render CSP header are identical. Browser, manual and deployment gates remain pending.

Final navigation corrections on 13 October: Overview shortcuts now focus the destination list heading after it is visible, while persistent navigation buttons retain focus. Historical goal routes with no current category return to the problem screen without writing history or discarding Something else, notes, or current answers. Six added unit regressions failed before the changes and pass afterward; a seventh compatibility case preserves the current category and explicit goal. Both independent final-review probes also pass. The final full suite passed 363/363, and lint, preview typecheck, all three builds and artifact verification passed on the final source. Original-site build output names/sizes and all protected baseline source paths are unchanged. The 64 browser cases are listed only; browser execution and manual sign-off remain pending.


## Browser CI prepared for the isolated branch

`.github/workflows/click-preview.yml` runs only on pushes to `preview/xappx-click-first`, guarded to the public `billinmanorg/xappx-platform` repository. It uses standard `ubuntu-24.04`, a 20-minute job timeout, branch-specific concurrency, `contents: read`, and checkout without persisted credentials.

It installs locked dependencies, typechecks, runs unit tests, builds/verifies `dist-click-preview`, installs official Playwright Chromium with system dependencies, then runs all browser tests with one worker and a 15-minute global timeout. It has no artifact-upload, dependency-cache, deployment or secret-input steps. Screenshots remain ephemeral on that runner and are not a manual approval artifact.

Official action release pins were verified against their primary release/commit pages:

- [actions/checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1): `3d3c42e5aac5ba805825da76410c181273ba90b1`
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0): `949feb2413d6458794dcd2491c4babbbce0c15c1`

GitHub documents standard hosted-runner use as free for public repositories. The job guard skips private repositories; larger runners, caches and artifact uploads are not configured. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

After publication, verify the remote exact SHA and the CI run's `head_sha`, read the actual test conclusion, and address any failing browser assertion before acceptance. A skipped, cancelled or pending job is not a browser pass.

## Optional standalone Render configuration

`render.click-preview.yaml` is an optional Blueprint defining only the prospective new `xappx-click-preview` static site. It is separate from the repository-root `render.yaml`. Do not sync the root Blueprint or modify an existing service.

Intended new-site settings:

- Repository: `https://github.com/billinmanorg/xappx-platform`
- Branch: `preview/xappx-click-first`
- Type/runtime: `web` / `static`
- Root directory: `apps/web`
- Build command: `npm ci && npm run build:click-preview && npm run check:click-preview`
- Publish directory: `dist-click-preview`, relative to the root directory
- Automatic deployment: off
- Build-only environment values: `NODE_VERSION=22.23.3`, `SKIP_INSTALL_DEPS=true`
- Explicit `/build` rewrite to `/index.html`
- Production-equivalent CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy and X-Robots-Tag noindex/nofollow/noarchive
- No database, backend, secret, environment-group or custom-domain linkage

The file passed local PyYAML parsing, validation against Render's current official Draft 2020-12 JSON schema, and semantic checks for the exact service, root-relative paths, isolated branch and CSP parity. This validates configuration shape, not workspace limits, name availability or deployment readiness. No Render CLI/server-side validation, Blueprint sync or service creation was performed.

Before creation, inspect My Workspace's actual limits and billing for build minutes/bandwidth and ensure `xappx-click-preview` does not already name a service. Unexpected charges or additional credential/access scope require approval. A static-site label alone is not evidence that all usage will be free. Keep automatic deployment disabled initially and preserve production DNS and shared main.

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [official schema](https://render.com/schema/render.yaml.json), [root-relative monorepo settings](https://render.com/docs/monorepo-support), [static-site dependency installation](https://render.com/docs/static-sites).

## Remaining sign-off sequence

- [ ] Review this candidate and its changes.
- [ ] Publish only the isolated preview branch; verify the exact remote SHA and create a draft PR without merging.
- [ ] Record the real browser CI run for that SHA; require an actual passing result.
- [ ] Obtain/review screenshots and manually inspect 375/768/1440px, keyboard focus, touch controls, reduced motion, artwork, contrast, clipping and third-result visibility. This remains pending even after automated CI passes.
- [ ] Review Render workspace limits/name/configuration; create only the new isolated site using the reviewed settings.
- [ ] Deploy the verified branch SHA, then record the real returned service ID, HTTPS URL and deployed SHA.
- [ ] Verify deployed `/` and `/build` including direct reload, response security/noindex headers, artwork, gate/read-only inspection, and absence of storage writes/content transmission.
- [ ] Update the release record with real publication/deployment evidence and remaining limitations.

Only after the actual URL is verified should it be supplied for future allowlisting. Live chat, Vault, authentication and checkout remain disconnected in this sample preview; allowlisting alone cannot enable them.
