# Audit 9 blueprint alignment and local evidence

## Scope and recorded ruling

Tested workspace: `/workspace/commerce-run/wt/audit-9-fix`, branch `agent/kixc-audit-9-fix`, base/HEAD `9de5eeee3c890c432db9a214f25453fefc4eef21` plus the uncommitted changes listed below. This standalone task implements only the three explicitly authorized audit-9 findings. No program metadata is changed or executed. No commit, push, PR, issue, marker or comment is created. The supervisor owns the final delivery SHA and remote exact-head CI; local results are not remote CI evidence.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

`commerce-bindings.ts` remains byte-identical: SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, git blob `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. No binding, protocol command, catalogue, gate, SDK pin, CI configuration, dependency or budget change is consumed or introduced.

## Findings, implementation and acceptance matrix

| Finding | Fix and regression evidence |
| --- | --- |
| Pre-write responses could restore currentness | All six controllers retain a read-sequence barrier advanced at write settlement. Four refresh controllers advance it at confirmed writes and stale-class rejections; credit controllers advance it at applied/rejected/unknown/refused settlements. A captured response may publish stale evidence but cannot clear the barrier or reopen a dependent write. Existing context and older-read dropping, watermark handling, per-right/per-order serialization and independent UNKNOWN fences remain. Each corresponding suite captures and clones responses before delivery, settles writes, releases the old responses, checks no dependent dispatch, and then reads fresh evidence. Cases include reads started during writes, ready/empty responses, confirmed/applied and rejected settlements. Credit unknown/refused cases retain their fence after old and fresh reads. |
| Mobile repeated invalidation | Resume advances the barrier outside its existing snapshot/cause guard, including an already-stale view. Context switch still replaces the observable cause with `context-switch`; cached-copy invalidations preserve `existingCause ?? cached-read`. Repeated resume regressions cover ready and empty responses. |
| Credit freshness could advertise CURRENT while behind | Both ready and empty state projections report STALE while behind. `apply(outcome, seq)` clears behind only for a ready read started after the barrier. Scope/actor switches intentionally retain the existing reset: they change the context key, clear the snapshot, and block writes until a new ready read. |
| Malformed production/truth declarations escaped rejection | Recursive guards require every own, present recognized declaration to be literal false. The exact ten keys, depth limit and PRODUCTION_ENDPOINT precedence remain. HTTP tests exercise true, strings true/false, numbers 0/1, null, objects and arrays at root and nested object/array positions, for status 200/400/422. Each invocation asserts one dispatch, ProtocolError rather than GateRejectedError, and matching nonempty request/correlation traces. Omitted/false controls pass the guards without weakening receipt validation. |
| Resale confirmation and rejection leaked across products | Frozen `outcomeRequest` captures the submitted product, variant, action, expected version and units/quote at dispatch, or on local rejection/NOT_BOUND. Busy/fenced duplicates do not replace it; navigation and late-response UNKNOWN retain it. Product panels scope results, focus and rejection latching to product/variant/action. Global UNKNOWN remains visible through `data-market-outcome`, `#market-outcome` and AsyncState on every product. Adapter, mounted web and real browser navigation regressions cover confirmation/rejection/UNKNOWN isolation; immutability attacks include submitted identity. |

## Internal interfaces

- `behindAfterSeq` is private app-local ordering state. Every invalidation records the latest `readSeq`, even if already behind. Only `seq > behindAfterSeq` may clear a barrier. Read-result unions and public protocol bodies are unchanged.
- `outcomeRequest: ResaleMarketIntent | null` is app-internal state, exposed through existing DeepReadonly and detached structuredClone/freezeSnapshot publication. Equal repeated local refusals preserve the existing publication identity; identity changes participate in update equality. New confirmed requests carry their new expected version and receive their own terminal focus.
- The shared page-load resale controller, navigation generations and `/resale/market` routes remain. Reads cannot resolve UNKNOWN. No UI fetch, retry, automatic resend, redirect following, Idempotency-Key, stub fallback or gate proxy is added.

## Files changed

| Area | Paths |
| --- | --- |
| Read barriers | `packages/protocol-adapter/src/platform-controller.ts`, `provider-controller.ts`, `refund-return-controller.ts`, `installable-mobile-controller.ts`, `credit-origination-controller.ts`, `credit-servicing-controller.ts` |
| Read race regressions | Corresponding six `packages/protocol-adapter/test/*-controller.test.ts` suites |
| Transport claims | `packages/protocol-adapter/src/payload-guards.ts`, `packages/protocol-adapter/test/http-transport-hardening.test.ts` |
| Resale identity | `packages/protocol-adapter/src/resale-market-controller.ts`, `apps/web/src/pages/ResaleMarketPanels.tsx` |
| Resale regressions | `packages/protocol-adapter/test/resale-market.test.ts`, `resale-market-controller-isolation.test.ts`, `apps/web/test/resale-market.test.tsx`, `apps/e2e/tests/journeys/resale-market.e2e.test.ts` |
| Evidence | This document |

## Actual verification

All npm commands use Node `v22.20.0` with `PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH`. The initial environment discovery reported system Node v24.22.1; verification uses the existing Node 22 installation. Commands run in foreground sessions, with output collected in `/tmp/kix-audit9-*.log`. Browser jobs run sequentially with the repository's browser-path configuration (`KIX_E2E_NO_SANDBOX=1`). Chrome is `/usr/bin/google-chrome` (156.0.8078.47); the complete journey rerun uses the already-available `/opt/ungoogled-chromium/chrome` (139.0.7258.154) after the host-stall timeout documented below. Final command results are recorded below. The final application/test patch identity (`git diff --binary HEAD -- apps packages | sha256sum`) is `078080b59da415c12ccdf60922c12ae68fc95022b864191701d28e43fdabab4e`.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed. Existing deprecation/install-script warnings; dependency audit reported 24 findings (21 moderate, 1 high, 2 critical), with no dependency/lockfile changes. Production-only audit below reports zero. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/platform-controller.test.ts test/provider-controller.test.ts test/refund-return-controller.test.ts test/installable-mobile-controller.test.ts test/credit-origination-controller.test.ts test/credit-servicing-controller.test.ts test/http-transport-hardening.test.ts test/resale-market.test.ts test/resale-market-controller-isolation.test.ts` | PASS on final code: 9 files, 215 tests, including the internal before/during-write and ready/empty matrices. |
| `npm exec -w @kix/web -- vitest run test/resale-market.test.tsx` | PASS on final code: 1 file, 13 tests. |
| `npm run typecheck` | PASS on final code. Initial test-fixture type errors corrected. |
| `npm run build` | PASS on final code. Existing M05 manual-chunk circularity warning; source import cycle check passes separately. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS on the final sequential build/test run: adapter 2,015 passed / 23 live-gate skipped; web 1,468 passed (including built-entry checks); cold-entry 6 passed. Total 3,489 passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS on final code: adapter 91.60% lines/statements, 97.79% functions, 85.70% branches; web 93.86% lines/statements, 84.89% functions, 90.25% branches. Every unchanged floor met; adapter 23 live-gate skips, web 1,468 passed. |
| `KIX_E2E_CHROME=/opt/ungoogled-chromium/chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-audit9-e2e-chromium139-record.json npm run test:e2e` | PASS on final code: 48 files, 215 tests, complete 180-check journey matrix, all 14 marketplace tests. Record: zero non-loopback, non-GET or application network calls; zero leaked pages/contexts, survivors, pending API calls/routes, unreleased gates and cleanup errors. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-audit9-browser-budget-record.json npm run test:budget` | PASS: 3 files, 9 browser tests on Chrome 156. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-audit9-visual-record.json KIX_VISUAL_OUT=/tmp/kix-audit9-visual-out npm run test:visual` | PASS: 3 files, 123 tests on Chrome 156; existing baselines unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-audit9-a11y-chrome156-third-record.json npm run test:a11y` | PASS on the complete unchanged third Chrome 156 run: 21 files, all 395 tests; complete accessibility observation matrix and keyboard facet 89/89, zero non-loopback/non-GET/application network calls and zero lifecycle leaks or pending work. Earlier host-event timeouts and the stopped Chromium experiment are recorded under deviations; none is treated as a pass. |
| `npm run typecheck:e2e` | PASS. |
| `npm run lint` | PASS on final code. |
| `npm run budget` | PASS on final build: initial JS gzip 160,165 bytes, CSS 4,974, total gzip 784,694; largest route chunk 27,516. Limits unchanged. |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries. |
| `npm run cycle-check` | PASS: adapter, web and E2E source graphs have no cycles. |
| `npm run audit:warn` | PASS: production dependency audit reports 0 vulnerabilities. |
| `git diff --exit-code 9de5eeee3c890c432db9a214f25453fefc4eef21 -- .aiops docs/aiops .github packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/src/sdk-consumption-tuple.ts packages/protocol-adapter/vendor package-lock.json apps/web/bundle-budget.json` | PASS: protected metadata, CI, binding, pins/vendor, dependencies and budgets unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: matches the locked hash above. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | PASS: `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |
| `git diff --check` | PASS. |

Browser attempt records are kept separately: the completed Chrome 156 journey failure is `/tmp/kix-audit9-e2e-final.log` with `/tmp/kix-audit9-e2e-chrome156-record.json`; the passing Chromium journey run is `/tmp/kix-audit9-e2e-chromium139.log`. Accessibility attempts are `/tmp/kix-audit9-a11y.log` (record copied to `/tmp/kix-audit9-a11y-first-record.json`), `/tmp/kix-audit9-a11y-final.log`, the intentionally stopped `/tmp/kix-audit9-a11y-chromium139.log`, and the passing `/tmp/kix-audit9-a11y-chrome156-third.log`. Browser records describe local stub observations, never production qualification or screen-reader/real-device acceptance.

## Deviations and limits

- No production source-file deviation from the reviewed design; the already-listed resale isolation suite is also updated to attack `outcomeRequest`. Equal local refusal requests reuse the frozen identity to preserve the existing no-op publication regression; each new dispatch gets a new identity even when its fields are identical. A repeated-rejection mounted test checks focus and latching after draft edits return to the same values.
- Initial typecheck and narrow runs exposed incomplete synthetic test outcomes, class wrappers missing bound methods, a nonexistent origination remedy, and an overly broad substring assertion matching CONFIRMED inside UNCONFIRMED_RESPONSE. Fixtures/assertions were corrected to the existing contracts and source-offered actions. No production guard, eligibility rule, test floor, timeout or budget was weakened.
- The first browser run used the build from before the final repeated-rejection identity refinement. It was intentionally stopped with SIGINT (exit 130) and is not counted as a completed pass; the full final-code run is recorded in the command table above.
- One intermediate final-code stub run overlapped the build and reported the existing built-entry test skipped while dist was absent. Build and full tests are rerun in sequence for the final result in the command table above; no skip rule is changed.
- The first complete final-code journey run on Chrome 156 passed 214/215 tests (47/48 files), including all 14 marketplace tests and all three new cross-product cases. The unchanged provider.NOT_BOUND case timed out waiting for the home heading. The existing timing record attributes the only failure to a host event: 31,300 ms test duration, 30,655 ms loop stall, 68 ms CPU. The aggregate host watch also recorded a 2,758,949 ms wall-clock step. The run retained zero non-loopback, non-GET and application network calls; teardown correctly rejected its incomplete matrix. The complete rerun selects local Chromium 139 through the existing environment setting; assertions, timeouts, harness and baselines remain unchanged.
- The first complete Chrome 156 accessibility run passed 393/395 tests (20/21 files). The two unchanged gallery narrow-view checks timed out with recorded host events: English had a 43,344 ms loop stall; Korean had a 118,111 ms clock step and 16,314 ms loop stall. All marketplace and route axe checks passed. The complete passing third Chrome 156 run is recorded in the command table.
- The second complete Chrome 156 accessibility run also passed 393/395 tests, with different host-event failures: refund-stale timed out before its screen opened (36,983 ms loop stall, 65 ms CPU), and diagnostics at 1280px timed out across an 800,044 ms clock step. Gallery passed all seven cases in that rerun. The incomplete matrix was correctly rejected. No assertion or timeout is weakened; the next complete run uses the existing Chromium 139 browser-path override.
- The Chromium 139 accessibility attempt passed the preceding async/diagnostics cases but reproduced existing browser-version-specific keyboard and gallery target-size differences (eight keyboard-outcome failures and two gallery failures). It was intentionally stopped with SIGINT (exit 130), not counted as a pass, and Chrome 156 is retained for the full accessibility result; the following complete run passes all 395 tests. No gallery, keyboard assertion or known-finding baseline is changed.
- The repository delegation document describes 60 nodes. This task neither consumes pending nodes nor edits executable/non-executable program metadata; it follows the explicitly supplied standalone audit-9 scope.
- Live-gate skips under `KIX_REQUIRE_GATE=0` are skips, never live-gate passes. Remote exact-head Commerce apps CI, including “Typecheck, build, and test (stub)”, remains for the supervisor on its eventual delivery SHA.

## UNDETERMINED and STOP boundaries

Producer integration, pricing/fees, refund policy, persistence/recovery, authoritative resolution of UNKNOWN and production authority remain UNDETERMINED or outside scope. The stub remains default; HTTP remains explicit loopback `http://127.0.0.1` only, one attempt and fail-closed. No real payment, KYC, credit disbursement, bank rail, venue scanning, live marketplace, production runtime, public deployment, SLO, copied Move/kernel/settlement math or secret is introduced. `kix-protocol` remains read-only and untouched. No STOP condition or new owner decision is needed for these app-local fixes.
