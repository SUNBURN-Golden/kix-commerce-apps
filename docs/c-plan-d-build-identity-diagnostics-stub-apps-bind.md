# Build identity and diagnostics binding

`contract_change=NO`. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The §8 diagnostic-record requirement is in `docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md`, not the integrated journey design. This implements only `c-plan-d-build-identity-diagnostics-stub`. The checkout's `.aiops/program.json` has 60 nodes while the brief says 18; that discrepancy grants no authorization to implement other nodes. Neither that file nor any aiops document is changed.

The build identity and JSON are app-internal presentation, not a public `BUILD_ID`, producer manifest, command, schema, or contract. Version plus an ordered SHA-256 digest covers the existing adapter pin tuple, including SDK producerSourceSha256. The integration-gate contract-only alias is checked against the included contract pin. Identity inputs have no clock, environment, randomness or checkout revision. Pin changes intentionally change the identity and require new diagnostic pictures; pins are unchanged here.

The lazy `/diagnostics` route is a Help section in Verification. Help remains its current navigation link and breadcrumb parent. It is intentionally excluded from role onboarding: the three workspace entry points remain buyer, organizer and receipts. The route has no workspace surface or browser-journey denominator row; its independent keyboard/network checks are shared checks. Guide, accessibility, async-state and visual inventories include it. D11 now counts 38 of 38 screens with acceptance PENDING. These observations grant no acceptance or release.

Only read-only journal inspection is added to the adapter. It reuses envelope validation, inspects quarantine (including malformed markers), and calls getItem only. Diagnostics never opens or verifies a journal. Known live evidence loss survives inspection; deletion or corruption after leaving the session desk overrides cached ready state. WRITE_REFUSED remains UNAVAILABLE with its original cause, since it does not prove quota. QUOTA means a valid stored journal reaches its existing byte or record budget. Retention stays `SESSION_RETENTION_POLICY = UNDETERMINED`.

The desk attempt module holds counters. Each of the four desks now publishes terminal changes into one bounded page-lifetime record before diagnostics opens. Its shared monotonic ordinal tracks completion order across interleaved desks and repeated attempts; only the last ten are retained, with an omitted count. Reload creates a fresh record. No timestamp or new storage key is added. Actor labels attached to the ten retained completions stay private to that bounded recorder; learning an actor also re-redacts earlier retained identifiers. Snapshot comparison uses a reference index and actor substitution deduplicates labels. Transport probes and in-flight/UI-only changes are not outcomes.

The exact-key JSON projects only build identity, mode/origin class, locale, display preferences, connectivity, journal summary, and redacted outcomes with journey/operation/request/correlation identifiers. It excludes actor fields, bodies, receipt fields, session IDs, storage text and URLs. Identifier values are bounded and filtered; known actor strings are replaced case-insensitively, then the receipt explorer's shared export sweep removes credential/contact/account shapes. Reasons use fixed redacted codes rather than arbitrary free text. Both the view and export consume these sanitized records. The copy button selects a labelled read-only field and attempts the clipboard, retaining a manual-copy note on refusal. It remains usable offline.

This view sends nothing and writes no browser storage. Diagnostics JSON is not evidence, approval or production readiness. The adapter remains stub by default. Integration HTTP is represented only by the word `loopback`; no origin value is read or exported. No request, probe, retry, redirect, fallback, payment, live marketplace or readiness claim is introduced. No limits or budget tests are raised or weakened.

Stop boundaries remain: a needed unmerged protocol contract, unmerged dependency content, hardware/equipment, money or paid service, secrets/credentials, production runtime, product policy value, new protocol command, locked-decision change, or crossing any stated rule requires DECISION_REQUIRED.md with need/options/recommendation/decider. None is needed here. No real KYC, credit disbursement, venue scanning, bank rail, public deployment, SLO, copied Move/kernel/settlement math, or kix-protocol mutation is authorized. commerce-bindings.ts, pin files, vendor, CI and aiops paths stay unchanged.

## Deviations and local evidence

Review corrections adopted: chronological bounded record rather than traversal sequence; actor-aware redaction; read-only storage/live reconciliation and quarantine handling; full digest input coverage; onboarding exclusion and executed UNKNOWN reference; tests for adapter observation stay under apps/web/test. The receipt export sweep is extracted unchanged into a shared module to avoid an import cycle. Redacted reason codes deliberately discard more free text than the proposed receipt-note projection. The visual harness's exact expected count increases from 92 to 94 shots and 37 to 38 routes for the additions; thresholds stay unchanged.

Local commands and results follow. Live-gate tests are skipped with KIX_REQUIRE_GATE=0, not passed. Hosted CI and supervisor Git/GitHub actions have not been run by this builder.


Local environment: Node v20.19.2 (repository engine >=20; hosted CI uses Node 22), npm 11.21.1, installed Google Chrome; screenshot profile linux-d29b2e9b. No Node 22 binary was available locally. Browser jobs ran in the foreground tool sessions, without background shell jobs or altered timeouts.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; 534 packages installed. Install audit reported five development-tree vulnerabilities; the separate production audit below reports zero. Lockfile unchanged. |
| `npm run typecheck` | Initial run found the copy-note state's broad string type; fixed with the exact three-key union. Subsequent runs pass, including the final recorder. |
| `npx vitest run test/route-registry.test.tsx test/i18n-coverage.test.ts test/storage-allow-list.test.ts` (apps/web) | PASS: 35 tests. |
| `npx vitest run test/build-identity.test.ts test/diagnostics.test.tsx` (apps/web) | PASS: initially 12 + one dist-only skip before building; after build and final cross-desk redaction, 14 tests pass with no skip. |
| `npx vitest run test/build-identity.test.ts test/diagnostics.test.tsx test/route-registry.test.tsx test/i18n-coverage.test.ts test/i18n.test.tsx test/user-guides.test.tsx test/first-run-onboarding.test.tsx test/local-evidence-matrix.test.ts test/connectivity-write-guard.test.ts test/untrusted-render-static.test.ts test/storage-allow-list.test.ts` (apps/web) | PASS: 132 tests before the added cross-desk regression; that regression also passes in the final focused run above. |
| Partial web run including `test/async-state-matrix.test.tsx` | FAIL as required by its evidence reporter: all 225 selected assertions passed, but referenced tests outside the selected files were not executed. The complete stub suite subsequently passes all references. |
| Root-level `npx vitest run --root apps/web ...` focused run | FAIL: workspace-relative raw-module resolution. Repeated from apps/web using the exact command above: PASS. Some implementation helper invocations likewise initially used the wrong workspace cwd, made no edits, and were rerun from the repository root successfully. |
| `KIX_REQUIRE_GATE=0 npm test` | Initial FAIL: source guard rejected a forbidden command literal in the redaction regex. Fixed the regex grouping without changing its redaction. Second FAIL: the existing locale migration table needed the new route. Added its registry row. Third PASS: adapter 1421 passed / 23 live-gate skipped, web 1236 passed, cold entry 6 passed. Final post-hardening rerun recorded below. |
| `npx vitest run test/no-bypass.test.ts` (adapter workspace) | Initial FAIL before the regex correction; the complete adapter run after correction passes this guard. |
| `npm run build` | PASS on multiple clean Vite builds (default empty output directory), including the final recorder. |
| `node /tmp/cdiag-extract-identity.mjs apps/web/dist/assets /tmp/cdiag-identity-a.json`; same extraction for b/final, then `cmp /tmp/cdiag-identity-a.json /tmp/cdiag-identity-b.json` and `cmp /tmp/cdiag-identity-a.json /tmp/cdiag-identity-final.json` | PASS: complete serialized identity extracted from clean compiled diagnostics chunks, byte-identical across all three. Extraction accepts only the complete fixed-shape object literal and serializes it. Version 0.0.1; pin digest 400515c6d64ed463872824eb5c5b89fa69ec40042c64781ab307493b5136aa6f. |
| `npm run budget` | PASS before the final localized preference labels: initial JS 160934, CSS 4984, total 782230 gzip bytes. Diagnostics chunk 4049 gzip bytes; existing total/initial/route limits and tighter entry graph targets unchanged. |
| `npm run lint` | PASS before the final recorder hardening. Final lint initially caught one unnecessary character-class escape; removed without changing the filter and reran successfully below. |
| `npm run typecheck:e2e` | PASS; final rerun below. |
| `npm run deps:check` | PASS: four manifests, 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular imports. |
| `npm run audit:warn` | PASS: production audit found zero vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS before final recorder hardening: adapter lines/statements 91.18%, functions 97.40%, branches 84.77%; web lines/statements 92.92%, functions 80.98%, branches 89.35%. All unchanged floors pass. Final rerun below. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/cdiag-e2e.json npm run test:e2e` | First FAIL: 176 passed, one existing box-office one-attempt test timed out at the unchanged 60s limit. Both diagnostics checks/tests passed, including copy offline, completion before route load and reload reset. Ledger counters all zero. Full repeat below. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/cdiag-visual-update.json KIX_VISUAL_OUT=/tmp/cdiag-visual-update-out npm run test:visual` | First FAIL: an additional exact registry count still expected 37. Corrected to 38 without changing tolerances. Manifest intentionally was not hand-edited. |
| Same visual update command with `/tmp/cdiag-visual-update-2.json` and `/tmp/cdiag-visual-update-2-out` | PASS: 109 tests. Recorded the two diagnostics shots and four Help updates through the harness; 94-shot manifest generated on linux-d29b2e9b. Both diagnostics originals visually inspected. All network ledger counters zero. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/cdiag-visual.json KIX_VISUAL_OUT=/tmp/cdiag-visual-out npm run test:visual` | First comparison FAIL: existing buyer phone load timeout and resale phone test timeout. All 93 recorded shots MATCH (including diagnostics), all network counters zero. No tolerance or timeout changed. Complete repeat below. |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/vendor packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts .github .aiops docs/aiops` | PASS: no difference in locked paths. |
| `git diff --check` | PASS. |


Final static checks, after cross-desk redaction and localized preference values:

| Command actually run | Result |
| --- | --- |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; clean Vite build, no limit/config change. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1421 passed / 23 live-gate tests skipped, web 1237 passed, cold entry 6 passed. |
| `npm run lint` | PASS after removing the unnecessary regex escape. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines/statements 91.18%, functions 97.40%, branches 84.77%; web lines/statements 92.93%, functions 80.99%, branches 89.33%. All unchanged floors pass. |
| `npm run build`, then `npm run budget` | PASS: initial JS 160935, CSS 4984, total 782370 gzip bytes; diagnostics chunk 4097 gzip bytes. Both the 790000 repository ceiling and 785000 entry-graph test target pass; no budget changed. |
| `node /tmp/cdiag-extract-identity.mjs apps/web/dist/assets /tmp/cdiag-identity-ready.json`, then `cmp /tmp/cdiag-identity-a.json /tmp/cdiag-identity-ready.json` | PASS: complete identity still byte-identical after final implementation changes. |
| `git show origin/main:packages/protocol-adapter/src/commerce-bindings.ts \| cmp - packages/protocol-adapter/src/commerce-bindings.ts` | PASS: byte-identical locked binding, independently of diff normalization. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/cdiag-a11y.json npm run test:a11y` | Initial FAIL: 275 passed, one Korean full-body copy assertion found the raw preference value no. Diagnostics axe at 390 and 1280, desktop/320 scans, keyboard, structure and reflow all passed. Displayed yes/no values are now translated; JSON enum values stay unchanged. Full repeat below. |


## Files changed

- `README.md`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/src/journey-matrix.ts`
- `apps/e2e/src/visual-matrix.ts`
- `apps/e2e/tests/a11y/diagnostics.a11y.test.ts`
- `apps/e2e/tests/diagnostics.e2e.test.ts`
- `apps/e2e/tests/visual/harness.visual.test.ts`
- `apps/e2e/visual-baselines/linux-d29b2e9b/diagnostics.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/diagnostics.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/help.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/help.desktop.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/help.phone.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/help.phone.ko.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/manifest.json`
- `apps/web/build-identity.ts`
- `apps/web/src/async-state/matrix.ts`
- `apps/web/src/consent-desk.ts`
- `apps/web/src/diagnostics/build-identity.ts`
- `apps/web/src/diagnostics/display-prefs.ts`
- `apps/web/src/diagnostics/model.ts`
- `apps/web/src/diagnostics/outcomes.ts`
- `apps/web/src/gift-desk.ts`
- `apps/web/src/i18n/catalogue.ts`
- `apps/web/src/i18n/generated-catalogue.ts`
- `apps/web/src/i18n/messages/pages--Diagnostics.ts`
- `apps/web/src/journey-desk.ts`
- `apps/web/src/organizer-desk.ts`
- `apps/web/src/pages/Diagnostics.tsx`
- `apps/web/src/pages/Help.tsx`
- `apps/web/src/receipt-explorer.ts`
- `apps/web/src/receipt-redaction.ts`
- `apps/web/src/screens.ts`
- `apps/web/src/session-recovery.ts`
- `apps/web/src/shell/route-registry.ts`
- `apps/web/src/vite-env.d.ts`
- `apps/web/test/build-identity.test.ts`
- `apps/web/test/diagnostics.test.tsx`
- `apps/web/test/route-registry.test.tsx`
- `apps/web/vite.config.ts`
- `apps/web/vitest.config.ts`
- `docs/c-a11y-acceptance-stub-apps-bind.md`
- `docs/c-async-state-patterns-stub-apps-bind.md`
- `docs/c-local-evidence-matrix-stub-apps-bind.md`
- `docs/c-locale-ko-en-stub-apps-bind.md`
- `docs/c-plan-c-visual-baseline-coverage-stub-apps-bind.md`
- `docs/c-plan-d-build-identity-diagnostics-stub-apps-bind.md`
- `docs/c-route-registry-navigation-stub-apps-bind.md`
- `docs/guide/screens-ko.md`
- `packages/protocol-adapter/src/index.ts`
- `packages/protocol-adapter/src/session-journal.ts`


## Frozen implementation checks

The stronger identifier fixture uses sensitive values between underscores, in references as well as codes and reasons. It exposed a word-boundary gap for embedded banned words; the diagnostic filter now also removes embedded account shapes and banned words. The receipt explorer's existing sweep remains unchanged and shared. `npx vitest run test/diagnostics.test.tsx test/build-identity.test.ts test/i18n-coverage.test.ts` (apps/web) then passed all 27 tests. The implementation was frozen after this fix; subsequent edits are evidence documentation only.

| Command actually run on the frozen implementation | Result |
| --- | --- |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: 1421 adapter + 1237 web + 6 cold-entry tests; 23 live-gate tests explicitly skipped, not passed. |
| `npm run lint` | PASS. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter 91.18% lines/statements, 97.40% functions, 84.77% branches; web 92.93% lines/statements, 80.99% functions, 89.34% branches. All existing floors pass. |
| `npm run budget` | PASS: initial JS 160949, CSS 4984, total 782371 gzip bytes; diagnostics 4100 gzip bytes. Limits unchanged. |
| `node /tmp/cdiag-extract-identity.mjs apps/web/dist/assets /tmp/cdiag-identity-last.json`, then `cmp /tmp/cdiag-identity-a.json /tmp/cdiag-identity-last.json` | PASS: full serialized identity unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/cdiag-a11y-ready.json npm run test:a11y` (before the final data-only filter tightening) | PASS: 276 tests, 38 screen records, all network ledger counters zero. Includes the Korean full-route copy check and diagnostics axe at 390/1280, keyboard, structure, narrow reflow and root-font checks. The frozen implementation is rerun below. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/cdiag-last-e2e.json npm run test:e2e` | PASS: 177 tests / 44 files on frozen implementation. All network ledger counters zero; diagnostics copy/reload checks pass. No timeout or test retry setting changed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/cdiag-last-visual.json KIX_VISUAL_OUT=/tmp/cdiag-last-visual-out npm run test:visual` | PASS: 109 tests; all 94 shots MATCH on linux-d29b2e9b, including diagnostics phone/ko and desktop/en. All network ledger counters zero. Update mode unset; no tolerance/timeout change. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/cdiag-last-browser-budget.json npm run test:budget` | PASS: 9 tests / 3 files; all network ledger counters zero. Route loading, chunk failure and long-list checks pass; limits unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/cdiag-last-a11y.json npm run test:a11y` | PASS on frozen implementation: 276 tests / 16 files, 38 screen records; diagnostics axe clean at 390/1280 and matrix desktop/320, keyboard/structure/reflow checks pass. All network ledger counters zero. |
| Final `git diff --check`, locked-path diff, byte comparison of commerce-bindings.ts, and changed-file inventory comparison | PASS. All 50 changed/new files are listed above; locked paths, pins, vendor, CI, aiops, bundle limits and coverage floors remain unchanged. |

All local workflow equivalents are green. The run records retain false production/qualification/release claims. The 23 live-gate tests are skipped, not passed; hosted CI has not been triggered. No Git commit, push, PR, issue or comment was created by this builder. No STOP condition was encountered, so no decision file is needed.

Diagnostics has zero recorded axe violations. The matrix desktop/320 scans retain color-contrast in the incomplete list; automated observations do not establish conformance or user acceptance. The existing acceptance facet remains PENDING.
