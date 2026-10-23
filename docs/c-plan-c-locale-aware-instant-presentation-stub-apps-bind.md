# Locale-aware instant presentation (stub)

## Scope

`contract_change=NO`. This document uses the Constraints path, `docs/c-plan-c-locale-aware-instant-presentation-stub-apps-bind.md`; the Objective's shorter path names the same work.

The selected display language now reaches every `formatWhen`, `presentInstant`, and `presentDeadline` call outside their defining modules explicitly. `useDisplayLocale()` maps the existing locale context to `en-GB` or `ko-KR`. Both use medium date / short time and an explicit ` UTC` suffix.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. This change composes no writes. The locked commerce bindings, protocol pins, adapter implementation, CI, catalogues, and bundle budget remain unchanged.

## Standing limits

- Display only. UTC stays the only display time zone. There is no time-zone preference.
- Nothing on these screens decides expiry; the adapter `expired` flag stays the authority. `presentDeadline` does not compare against the current time. Existing tests continue to pair a past instant with `expired: false` and a future instant with `expired: true`.
- Every existing `<time dateTime>` retains the raw ISO instant. No amount or number formatting changes; amounts are untouched.
- Stub remains the default. The existing one-attempt, loopback-only HTTP boundary, explicit transport failures, no automatic resend, no redirect following, and false production/truth flags remain in force. Components add no network access.
- No real payment, public deployment, KYC, credit disbursement, venue scanning, bank rail, or live marketplace. No SLO, copied protocol math, or secret.

## Call sites

`locale-context.tsx` replaces the shadowing `useFormatWhen` hook with `useDisplayLocale`. BoxOffice, Buyer, Booking, ReservationPanel, Discovery, DiscoveryPanels, M02, M03, and M05 import `formatWhen` directly and pass the display locale. ResalePanel and DeadlineLine already supplied it and need no source change. `format.ts` and `a11y/present.ts` keep their compatible English defaults.

Inventory summary/page/selection builders and discovery list/detail builders now require the locale. Their hooks rebuild display models from retained outcomes during a language switch; locale changes neither effect dependencies nor port state. Stale watermark/floor lines and ready watermark metadata therefore change language without another read. Existing builder tests explicitly choose English.

## Files changed

- Source: `apps/web/src/i18n/locale-context.tsx`, `apps/web/src/inventory-venue.ts`, `apps/web/src/discovery-live.ts`.
- Pages: `apps/web/src/pages/BoxOffice.tsx`, `Buyer.tsx`, `Booking.tsx`, `ReservationPanel.tsx`, `Discovery.tsx`, `DiscoveryPanels.tsx`; and `apps/web/src/pages/marketing/M02Presale.tsx`, `M03Coupons.tsx`, `M05Consent.tsx`.
- Existing tests: `apps/web/test/inventory-venue.test.tsx`, `discovery-live.test.tsx`, `discovery-page.test.tsx`.
- Added tests/resources: `apps/web/test/clock-locale-audit.test.ts`, `locale-instant-presentation.test.tsx`, `locale-retained-read.test.tsx`, `support/clock-locale-audit.ts`, `fixtures/english-clock-base.json`.
- Evidence: this bind document. No baseline files changed.

## AST guard and render evidence

`test/support/clock-locale-audit.ts` uses the TypeScript AST, scans all web `.ts`/`.tsx` source, and exempts only root-relative `format.ts` and `a11y/present.ts`. It covers bare calls, named import aliases, namespace properties, and string element accesses. Positional calls need a second argument; deadline calls need an object literal with a locale property. Explicit `undefined`, `null`, and `void` values are refused.

The scratch tree yields four deliberate violations plus a nested `format.ts` violation, while actual violations seeded at the two exempt paths are ignored. Namespace/missing-value fixtures yield ten findings; valid fixtures and the real source tree yield zero.

The jsdom suite renders BoxOffice, Buyer, Booking through `/booking/:eventId`, Discovery list/static detail/live detail, Resale, and the actual M02Page/M03Page/M05Page exports under URL-selected `en` and `ko`. It freezes timestamp creation, resets the adapter and marketing session between cases, records presale interest, applies a coupon, saves consent, creates a Booking deadline, and adopts a populated mock resale right. Expected clock counts are 3/3/2/48/2/2/1/4/1/1 respectively. Assertions check specific fixture ISO values, every time attribute, the Korean AM/PM clock words and UTC suffix, and the untagged marketing/resale clocks.

`test/fixtures/english-clock-base.json` was captured by running these deterministic screen cases against **unchanged source from base `a0c6f89ec15fdecbaea74c5a64d3ce99c586f9a4`**, with the instant `2026-10-03T12:00:00.000Z`. The source migration was saved outside the repository, base source restored for recording, and the migration reapplied afterward. All ten base cases passed before removing the recording branch from the test. English clock/deadline text and ISO attributes compare exactly to that saved base output, rather than to another post-change render. No generated container IDs enter this comparison.

Four further jsdom cases switch retained ready and stale inventory/discovery models between locales, checking watermark/floor clocks, retained row IDs, and unchanged read/factory counts. The focused suite also includes existing expiry authority, i18n-coverage, i18n, display-preferences, and user-guides tests.

## Visual baselines

Comparison was run **before any recording** on the existing `linux-d29b2e9b` profile. All 32 shots and all 42 tests passed. All 16 Korean shots had **zero differing pixels**. Inventory is outside the visual matrix; discovery's changed live-read metadata is below the 2000px screenshot cut. Existing top-of-screen clocks already consumed the locale context.

| Pictures | Result / change |
| --- | --- |
| All 16 Korean shots, including discovery phone/desktop/light/dark | Exact pixel match; no affected PNG to re-record |
| All 16 English shots | MATCH within the existing tolerance; committed PNG bytes unchanged |
| `manifest.json` | Unchanged; accurately retains the existing recording provenance |

No update-mode run was needed and no baseline files were rewritten. The existing manifest continues to identify its original Chrome 155 recording; this comparison used Chrome 156, with the same font/render profile. The original compare record is `/tmp/kix-visual-before.json`, with the original artifact output directory `/tmp/kix-visual-before`. There were no failed pictures to retain. Eleven English shots had 14–125 ppm of existing-tolerance differences; none was re-recorded. This pixel tolerance is not the English byte-regression proof: the saved base clock fixture provides that proof for exercised clock/deadline text, and a direct base-object byte comparison separately proves all English PNGs unchanged.

## Local verification

Commands below were run in the node worktree; single-file Vitest commands were run from `apps/web`. Local versions (`node --version`, `npm --version`, `/usr/bin/google-chrome --version`) were Node 20.19.2, npm 11.21.1, and Chrome 156.0.8078.47; CI selects Node 22. These are the closest installed local equivalents, and the repository permits Node >=20. Browser commands used `/usr/bin/google-chrome`, `KIX_E2E_NO_SANDBOX=1`, loopback stub builds, and foreground execution. Logs/records named below are local temporary evidence, not release qualification.

| Command | Result |
| --- | --- |
| `npm ci` | PASS on initial and final clean installs; 534 packages installed. npm reported five development-inclusive advisories; production audit below reported zero. |
| `RECORD_BASE_CLOCKS=1 npx vitest run test/locale-instant-presentation.test.tsx` (temporary recorder, unchanged base source) | PASS: 10 tests. Earlier setup attempts failed on a wrong working directory, jsdom URL handling, mock initialization, and an unissued resale right; all corrected before this successful base recording. |
| `npx vitest run test/clock-locale-audit.test.ts test/locale-instant-presentation.test.tsx test/locale-retained-read.test.tsx test/inventory-venue.test.tsx test/discovery-live.test.tsx test/discovery-page.test.tsx test/a11y-baseline.test.tsx test/i18n-coverage.test.ts test/i18n.test.tsx test/display-preferences.test.tsx test/user-guides.test.tsx` | PASS: 11 files, 144 tests. Initial run found a missing discovery watermark in the test's known-instant list; corrected and rerun. |
| `npm run typecheck` | PASS on initial and final clean-install runs |
| `npm run build` | PASS on initial and final clean-install runs; existing large-chunk advisory only |
| `KIX_REQUIRE_GATE=0 npm test` | PASS on initial and final clean-install runs: adapter 65 files / 1335 tests (5 files / 23 gate-dependent tests skipped); web 84 files / 1096 tests |
| `npm run lint` | PASS |
| `npm run cycle-check` | PASS |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Initial run: two existing web tests exceeded their 5000ms timeout during concurrent verification (async-state-matrix box-office UNKNOWN and a bundle-budget fixture test). Coverage percentages exceeded the floors. The final isolated rerun PASSED all tests and floors with unchanged timeouts: adapter lines/statements 91.22%, functions 97.44%, branches 84.59%; web lines/statements 92.32%, functions 78.08%, branches 88.52%. |
| `npm run budget` | PASS: initial JS gzip 288528 bytes <= 290000; total gzip 783256 bytes; route limits unchanged |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries |
| `npm run audit:warn` | PASS: zero production vulnerabilities |
| `npm run typecheck:e2e` | PASS |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-e2e.json npm run test:e2e` | PASS: 43 files, 174 tests; ledger nonLoopback/nonGet/appNetworkCalls all zero |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-a11y.json npm run test:a11y` | PASS: 15 files, 269 tests; existing known-findings policy unchanged |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-browser-budget.json npm run test:budget` | PASS: 3 files, 9 tests |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-visual-before.json KIX_VISUAL_OUT=/tmp/kix-visual-before npm run test:visual` | PASS: 3 files, 42 tests, 32 MATCH shots; no non-loopback requests, non-GET requests, or app network calls |
| Python byte comparison: `git show a0c6f89ec15fdecbaea74c5a64d3ce99c586f9a4:<path>` against file bytes for locked bindings, budget, all baseline PNGs and manifest | PASS: 35 files byte-identical; 16 English PNGs unchanged |
| `npx vitest run test/locale-retained-read.test.tsx` | PASS: 4 tests after strengthening the ready selection assertion with its actual fixture unit ID |
| `git diff a0c6f89ec15fdecbaea74c5a64d3ce99c586f9a4 --exit-code -- .aiops docs/aiops .github packages/protocol-adapter apps/web/bundle-budget.json apps/e2e/visual-baselines` | PASS: all protected paths, adapter bytes, budgets, and visual files unchanged |
| `git diff --check` | PASS |

Locked bindings SHA256 (base and worktree): `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

The private live-gate/token CI job is **SKIPPED locally**, not passed. No protocol contract or gate change is consumed by this display-only node. No credentials were requested or used.

## Deviations and decision boundaries

Local Node 20.19.2 differs from CI Node 22 (the repository supports >=20); all local equivalents passed. No visual files changed because comparison established exact Korean picture identity before any recording. The implementation adds a separate retained-read test file and a saved deterministic English base fixture to meet the design review's stronger regression requirements. The recording-only test branch was removed after capture. No catalogue keys, budgets, CI rules, protocol files, `.aiops/`, or `docs/aiops/` were edited.

A need for an unmerged protocol contract, unmerged dependency content, hardware/equipment, money/paid services, secrets/credentials, production runtime, product-policy value, new protocol command, or any standing-rule violation remains a STOP condition. It would require root `DECISION_REQUIRED.md` explaining what is needed, options, recommendation, and who decides. Ordinary English-output regressions are fixed within scope. No such decision boundary was encountered.
