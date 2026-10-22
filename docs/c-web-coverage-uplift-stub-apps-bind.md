# Web function coverage uplift — local stub evidence

Node: `c-web-coverage-uplift-stub`. `contract_change=NO`. This change adds tests, an exact-pinned test-only DOM environment, a higher function floor, and this evidence record. It changes no runtime source, route, or screen. It consumes no protocol catalogue/gate change.

Source and tested worktree base: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`. The builder leaves all changes uncommitted as instructed; there is no new delivery commit SHA to report. The supervisor must record the eventual delivery SHA. Tests described here ran on this base plus the files listed below, under Node **22.23.3**. The first exploratory install/gate/knip invocation used the preinstalled Node 20.19.2; the clean baseline measurement and final checks used Node 22.

**M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.** The journey stops at `accept_trade`; `capture` and `settle_capture` are never composed, and `commit_trade`, `open_admission`, and `admit` remain recorded as uncomposed. `placeHold.consideredAction=reserve_listing` remains not-bound and is never mapped to `prepare_trade`.

## Measurements

The quality-gates bind's historical 60.49% is not used as a new measurement. A clean detailed baseline run measured **60.56% (957/1,580)** functions. The final positive coverage gate measured **76.12% (1,205/1,583)**, above the 75% target. The committed floor is **76.1%**, rounded down to one decimal; it is distinct from the attained value. V8 can discover additional nested functions/branches as effects execute; the three-function denominator increase occurred with identical runtime source and unchanged coverage inclusion/reporters. Branch counts varied slightly between repeated runs (87.69–87.70%); the table records the last positive run. Generated coverage is ignored and is not delivered.

| Workspace | Metric | Fresh baseline | Final positive gate | Old → new floor |
| --- | --- | --- | --- | --- |
| @kix/web | lines | 27412/32706 (83.81%) | 28727/32706 (87.83%) | 83.6% → 83.6% |
| @kix/web | functions | 957/1580 (60.56%) | 1205/1583 (76.12%) | 60.4% → 76.1% |
| @kix/web | branches | 6002/7089 (84.66%) | 6928/7900 (87.69%) | 84.6% → 84.6% |
| @kix/web | statements | 27412/32706 (83.81%) | 28727/32706 (87.83%) | 83.6% → 83.6% |
| @kix/protocol-adapter | lines | unchanged source/suites | 35663/39112 (91.18%) | 91.1% → 91.1% |
| @kix/protocol-adapter | functions | unchanged source/suites | 1791/1838 (97.44%) | 97.4% → 97.4% |
| @kix/protocol-adapter | branches | unchanged source/suites | 9101/10767 (84.52%) | 84.5% → 84.5% |
| @kix/protocol-adapter | statements | unchanged source/suites | 35663/39112 (91.18%) | 91.1% → 91.1% |

The floor comparison verified exact equality for every other field, including schema, policy, workspace names, all other metrics, and the e2e nulls and note. Adapter source and suites are unchanged. E2e coverage remains uncollected; browser passes below are observations rather than coverage percentages.

## Gaps closed

All source paths below are relative to `apps/web`; test names are relative to `apps/web/test`. The table uses report-observed function counts, not static estimates.

| Source | Functions covered/total, before → after | Behavior asserted | Tests |
| --- | --- | --- | --- |
| `src/session-store.ts` | 3/4 → 4/4 | journal wrapper getItem/setItem/removeItem; allow-list before access; missing/blocked storage | `web-helpers.test.ts` |
| `src/shell/route-focus.ts` | 1/3 → 4/4 | focusPrimaryHeading/onScreenReady/useRouteFocus; navigation, delayed readiness, temporary tabindex cleanup | `shell-interactions.test.tsx` |
| `src/i18n/LocaleSwitch.tsx` | 1/3 → 3/3 | choose; real locale switch updates document language and preference, preserves journal | `shell-interactions.test.tsx` |
| `src/pages/OrganizerWorkspace.tsx` | 3/14 → 14/14 | caller-field handlers, add/remove/preview/submit, result focus | `organizer-workspace-interactions.test.tsx; organizer-workspace-pending.test.tsx` |
| `src/pages/Inventory.tsx` | 2/7 → 7/7 | URL/quantity/selection callbacks; invalid GA input retained and focused | `inventory-interactions.test.tsx` |
| `src/pages/InventoryPanels.tsx` | 9/23 → 20/23 | page/filter/refresh/scenario/generation controls and keyboard list selection | `inventory-interactions.test.tsx` |
| `src/session-recovery.ts` | 10/15 → 16/17 | attach/refresh/deliverHeld/setScenario/onShow/onVisible and listener cleanup; pageRecovery isolated per case | `session-recovery-interactions.test.tsx` |
| `src/pages/SessionRecoveryPanels.tsx` | 2/9 → 8/9 | guarded attach and explicit scenario controls; held answer after resume never lifts UNKNOWN | `session-recovery-interactions.test.tsx` |
| `src/finance-operations.ts` | 13/25 → 25/25 | proposeCorrection/approveProposal/loadExport and source/scope/grant/session controls | `operations-interactions.test.tsx` |
| `src/pages/FinancePanels.tsx` | 16/30 → 30/30 | PickAndApply handlers, noteValue and maker/checker buttons | `operations-interactions.test.tsx` |
| `src/tenant-permissions.ts` | 10/26 → 23/26 | role/actor/tenant changes, direct open, maker/checker records, sensitive export | `operations-interactions.test.tsx` |
| `src/pages/TenantPermissionsPanels.tsx` | 16/31 → 31/31 | role-specific resource actions; explicit apply, denied direct open | `operations-interactions.test.tsx` |
| `src/notification-inbox.ts` | 10/24 → 24/24 | markRead/resolveAction/loadInquiry, grant generation, tenant/actor/role/source/session controls | `operations-interactions.test.tsx` |
| `src/pages/NotificationsPanels.tsx` | 14/30 → 30/30 | inbox read state, offered support material, direct-open and applied selections | `operations-interactions.test.tsx` |
| `src/credit-origination.ts` | 11/29 → 28/29 | submit/amend/rereview/acceptCommitment/requestDrawdown and synthetic consent/document/policy controls | `credit-interactions.test.tsx` |
| `src/pages/CreditOriginationPanels.tsx` | 17/35 → 34/35 | amountValue and request/correction handlers; invalid amount never sends | `credit-interactions.test.tsx` |
| `src/credit-servicing.ts` | 9/26 → 26/26 | proposeAllocation/proposeAdjustment/proposeCaseTransition/approveProposal and source controls | `credit-interactions.test.tsx` |
| `src/pages/CreditServicingPanels.tsx` | 18/37 → 37/37 | firstOpenInstallmentId/adjustmentKindValue/adjustmentTextValue; separate proposals/approvals | `credit-interactions.test.tsx` |
| `src/provider-journey.ts` | 14/27 → 27/27 | begin/landReturn/deliverReport/observe/issue/refund/abandon/deliverHeld/deliverLate/switchContext | `journey-interactions.test.tsx` |
| `src/pages/ProviderJourneyPanels.tsx` | 10/21 → 21/21 | checkout event and write controls; return is not payment; late result stays unknown | `journey-interactions.test.tsx` |
| `src/marketing-journey.ts` | 14/22 → 22/22 | apply/reclaim/simulate/refresh/switchScope/setScenario/deliverHeld/newSession | `journey-interactions.test.tsx` |
| `src/pages/MarketingJourneyPanels.tsx` | 17/29 → 28/29 | benefit/order/reclaim and synthetic source event handlers | `journey-interactions.test.tsx` |

Additional race tests in `inventory-stale-response.test.tsx` delay only existing read-port responses: a new scenario keeps its newer summary, and an explicit second page read keeps its rows when the older response arrives. `organizer-workspace-pending.test.tsx` delays/fails the existing local invoker, while using the real page, workspace hook, desk, batch and console: two submit events send one `create_event`; pending controls are disabled; rejection or timeout/UNKNOWN leaves the second row NOT_ATTEMPTED and restores input focus. Existing batch/controller/fault tests remain in place.

`support/render-dom.tsx` uses React `act` and `createRoot`, native DOM events, and reliable unmounting. Each mount rejects and counts any fetch, including caught requests. Cleanup restores spies/globals and clears test session storage. Recovery cases reset the module cache before loading the page to isolate the production `pageRecovery` singleton; the resume/late-response scenario keeps the same controller throughout. No runtime reset export or mocked hook is added. No new renderer/testing-library dependency is added. `jsdom` is pinned to `26.1.0`; only the interaction tests opt into it, with origin `http://127.0.0.1:5173`. Other tests keep Node and sequential screen preloading.

## Commands and results

Commands ran from the repository root unless stated otherwise. Node 22 was selected with:

```sh
export PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
```

| Actual command | Result |
| --- | --- |
| `npm ci` | PASS on initial Node 20, clean baseline Node 22, and final Node 22 installs. Final install: 530 packages added. npm reported 5 development-tree audit findings; no dependency-policy bypass or automatic upgrade. |
| `npm install -D -E jsdom@26.1.0 -w @kix/web` | PASS; exact test-only dependency and lockfile updated. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` (first exploration, Node 20) | INVALID/exit 1: overlapping reinstall removed dependencies from a still-running test. This was an orchestration error, not accepted baseline evidence. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/web -- --coverage --coverage.reporter=text --coverage.reporter=json --coverage.reporter=json-summary` (clean baseline, Node 22) | PASS; 61 files, 750 tests; captured detailed fnMap/f counts and fresh baseline summary before adding tests. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/web -- --coverage --coverage.reporter=json --coverage.reporter=json-summary` (interim) | PASS; 69 files, 774 tests, functions 76.12%; followed by four additional pending/race tests. |
| Narrow suite commands (exact invocations in the appendix) | Final PASS: 10 files, 28 tests. Earlier failures and corrections are recorded below. |
| `npm run typecheck` | Final PASS/exit 0. |
| `npm run build` | PASS/exit 0. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS/exit 0: adapter 1,306 passed and 23 pre-existing infrastructure-dependent skips; web 778 passed in 71 files. No skip was added. |
| `KIX_REQUIRE_GATE=0 node /tmp/kix-uplift-negative/scripts/coverage-check.mjs` | EXPECTED FAIL/exit 1: disposable script/floors copy with workspace symlinks and only web functions changed to 100%; suites passed, then 76.12% < 100% failed enforcement. Repository floor stayed 76.1%. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` (final Node 22) | PASS/exit 0: both measured workspaces meet every floor. |
| `npm run lint` | Final PASS/exit 0, zero warnings. |
| `npm run deps:check` | PASS/exit 0; production lock/license/exact-version gate, 625 lock entries. |
| `npm run cycle-check` | PASS/exit 0; no circular imports. |
| `npm run unused-exports` | PASS/exit 0 (report only); final findings compared, not merely exit status. |
| `npm run unused-exports --prefix /tmp/kix-uplift-baseline` | PASS/exit 0; Node 22 comparison over an untouched `git archive HEAD` copy with installed dependencies symlinked. Baseline report agrees with initial report. |
| `npm run audit:warn` | PASS/exit 0; production-only audit reports 0 vulnerabilities. |
| `npm run budget` | PASS/exit 0; initial JS gzip 289,741 bytes, CSS 4,758, total 623,021; all recorded limits met. |
| `npm run typecheck:e2e` | PASS/exit 0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-uplift-browser-record.json npm run test:e2e` | PASS/exit 0: 51 tests, 14 files. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-uplift-a11y-record.json npm run test:a11y` | PASS/exit 0: 230 tests, 10 files. Existing findings retained, no acceptance claim. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-uplift-budget-record.json npm run test:budget` | PASS/exit 0: 9 tests, 3 files; chunk failure, split and five cold loads per list scenario within existing caps. |
| `git diff --check` | PASS/exit 0. |
| Python comparison of HEAD/current floors, protected paths and binding bytes | PASS; only web functions increased, no protected/runtime source changes. |

Chrome **155.0.8059.84** journey and accessibility records each report nonLoopback=0, nonGet=0 and appNetworkCalls=0. The accessibility record covers 37 screens: 29 OBSERVED_CLEAN and 8 OBSERVED_WITH_FINDINGS, with 25 existing finding entries. All acceptance/conformance/release/production claims stay false. The browser budget record also has a zero network ledger and all claims false. Records are local `/tmp/kix-uplift-*-record.json` artifacts; the disposable baseline and negative-gate copies were discarded after their results were recorded.

Knip comparison: unused exports **165 → 164**, with `focusPrimaryHeading` now consumed by its test. All other findings, unused exported types, duplicate exports and configuration hints are unchanged. No new unused export or dependency appears. The report-only script's zero exit status alone was not treated as proof.

Earlier checks found test-only defects, which were corrected and rerun: the first inventory test used an unsupported `empty` scenario (replaced with the published synthetic `stale` scenario); mounted desk tests needed router context, real role capabilities, explicit post-write reads, and exact source states (`approval-recorded`, `loaded`, `none`). The pending invoker test needed to clear preloaded modules before installing its port mock and to use REQUEST_TIMEOUT for an outcome that may have applied. The delayed-page wrapper initially spread a class port and lost prototype methods; it now preserves the port and wraps only its bound read method. Typecheck initially rejected NodeList spread because this repository does not enable DOM.Iterable; tests now use Array.from. Lint initially rejected a heading tabindex=0 fixture; it now uses the existing programmatic tabindex=-1 convention. Final self-review tightened the servicing source controls from alternative outcomes to exact expected outcomes; the focused three-test credit suite passed again, followed by renewed typecheck, build, full stub tests, coverage and lint checks. No production change, skip, ignore directive, floor decrease, or weakened existing assertion was used to resolve these failures.

## Boundaries, deviations and handoff

The report justified expanding beyond the initial five test areas into finance, permissions, notifications, synthetic credit, provider and marketing interactions, as permitted by the plan. Existing display/model helpers already had coverage, so no redundant display test or test-only runtime export was added. The attained floor exceeds the requested target. No UI source changed, and no route/screen matrix update is needed. Existing Chrome journeys/a11y/budget suites provide browser regression evidence; the new DOM tests provide focused pending/empty/error and keyboard behavior assertions. Reduced-motion testing here exercises the preference reader; existing browser display-preference observations remain the evidence for the full shell behavior.

Session retention/TTL remains **UNDETERMINED**; existing sessionStorage behavior is unchanged. Default stub mode, explicit loopback HTTP only, one attempt, no fallback/retry/Idempotency-Key/redirect following, production/truth flags false, and no UI fetch remain unchanged. No provider/SDK/producer connection, real money/KYC/credit/venue/bank/public-marketplace operation, deployment, SLO, copied protocol calculation, secret, or new public contract is introduced. No `.aiops/`, `docs/aiops/`, CI, adapter/vendor source, pin, PINNED_ACTIONS, protocolMergeSha, or gate SHA changed; `kix-protocol` is untouched.

The locked `commerce-bindings.ts` is byte-identical to source HEAD: git blob `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`; SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

Live integration-gate infrastructure and production environments were not exercised. The existing 23 adapter skips remain unverified, not passed. These synthetic and loopback browser results do not establish integration completion, qualification, user acceptance, conformance, or release. No commit, push, PR, issue, comment, or ASTRA marker was created. Independent review and hosted CI are supervisor handoff work.

Changed files: `coverage-floors.json`, `apps/web/package.json`, `package-lock.json`, `apps/web/vitest.config.ts`, this bind, ten new `apps/web/test/*.test.ts[x]` files, and `apps/web/test/support/render-dom.tsx` (full test names below).

## Changed files

- `apps/web/package.json`
- `apps/web/vitest.config.ts`
- `coverage-floors.json`
- `package-lock.json`
- `apps/web/test/credit-interactions.test.tsx`
- `apps/web/test/inventory-interactions.test.tsx`
- `apps/web/test/inventory-stale-response.test.tsx`
- `apps/web/test/journey-interactions.test.tsx`
- `apps/web/test/operations-interactions.test.tsx`
- `apps/web/test/organizer-workspace-interactions.test.tsx`
- `apps/web/test/organizer-workspace-pending.test.tsx`
- `apps/web/test/session-recovery-interactions.test.tsx`
- `apps/web/test/shell-interactions.test.tsx`
- `apps/web/test/support/render-dom.tsx`
- `apps/web/test/web-helpers.test.ts`
- `docs/c-web-coverage-uplift-stub-apps-bind.md`

## Narrow-command appendix

Each row is an actual `KIX_REQUIRE_GATE=0 npm test -w @kix/web -- …` invocation under Node 22. Repeated invocations are retained to make the failure/fix trail explicit. Development logs are in `/tmp/kix-uplift-*` on the builder host and are not repository artifacts.

| Run | Exact arguments after `--` | Result |
| --- | --- | --- |
| narrow-1 | `test/web-helpers.test.ts test/shell-interactions.test.tsx test/organizer-workspace-interactions.test.tsx` | PASS: Tests  9 passed (9) |
| narrow-2 | `test/inventory-interactions.test.tsx test/session-recovery-interactions.test.tsx` | FAIL: Tests  1 failed | 4 passed (5) |
| narrow-3 | `test/operations-interactions.test.tsx test/inventory-interactions.test.tsx` | FAIL: Tests  4 failed | 2 passed (6) |
| narrow-4 | `test/operations-interactions.test.tsx` | FAIL: Tests  3 failed | 1 passed (4) |
| narrow-5 | `test/credit-interactions.test.tsx` | FAIL: Tests  2 failed | 1 passed (3) |
| narrow-6 | `test/operations-interactions.test.tsx test/credit-interactions.test.tsx` | FAIL: Tests  5 failed | 2 passed (7) |
| narrow-7 | `test/operations-interactions.test.tsx test/credit-interactions.test.tsx` | FAIL: Tests  2 failed | 5 passed (7) |
| narrow-8 | `test/journey-interactions.test.tsx` | FAIL: Tests  3 failed (3) |
| narrow-9 | `test/operations-interactions.test.tsx test/journey-interactions.test.tsx` | FAIL: Tests  2 failed | 5 passed (7) |
| narrow-10 | `test/operations-interactions.test.tsx test/journey-interactions.test.tsx` | PASS: Tests  7 passed (7) |
| narrow-11 | `test/organizer-workspace-pending.test.tsx` | FAIL: Tests  2 failed (2) |
| narrow-12 | `test/organizer-workspace-pending.test.tsx` | FAIL: Tests  1 failed | 1 passed (2) |
| narrow-13 | `test/inventory-stale-response.test.tsx` | FAIL: Tests  1 failed | 1 passed (2) |
| narrow-final | `test/web-helpers.test.ts test/shell-interactions.test.tsx test/organizer-workspace-interactions.test.tsx test/organizer-workspace-pending.test.tsx test/inventory-interactions.test.tsx test/inventory-stale-response.test.tsx test/session-recovery-interactions.test.tsx test/operations-interactions.test.tsx test/credit-interactions.test.tsx test/journey-interactions.test.tsx` | FAIL: Tests  1 failed | 27 passed (28) |
| narrow-final-2 | `test/web-helpers.test.ts test/shell-interactions.test.tsx test/organizer-workspace-interactions.test.tsx test/organizer-workspace-pending.test.tsx test/inventory-interactions.test.tsx test/inventory-stale-response.test.tsx test/session-recovery-interactions.test.tsx test/operations-interactions.test.tsx test/credit-interactions.test.tsx test/journey-interactions.test.tsx` | PASS: Tests  28 passed (28) |
| narrow-servicing-review | `test/credit-interactions.test.tsx` | PASS: 3 tests after strengthening exact source-control outcomes |
