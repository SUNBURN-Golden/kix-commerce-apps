# Bound resale offer and trade-history presentation

## Scope and ruling

`contract_change=NO`. Standalone node `c-plan-c-market-history-pages-stub`: independent presentation pagination on `/resale/market/:productId`, with at most 50 offers and 50 trade-history rows at once. This checkout's `.aiops/program.json` contains **60 nodes** and lacks this node. The explicitly supplied standalone scope governs this work; no program metadata was changed or pending-node content implemented.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

No protocol command, binding, transport, write eligibility, producer mapping or claim flag changes. `commerce-bindings.ts` remains byte-identical, SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. Pagination grants no authority and introduces no persistence, eviction or retention policy. Accepted snapshots remain complete. Chart and marketplace search pagination remain outside scope.

Qualification **UNQUALIFIED**, acceptance **PENDING**, release **NOT_AUTHORIZED**. Browser and accessibility passes are local observations only; they grant no conformance, real-device, screen-reader, production or release claim.

## Interfaces

`apps/web/src/resale-market-pagination.ts` exports `MARKET_HISTORY_PAGE_SIZE = 50`, `MarketHistoryPage<T>` and `buildMarketHistoryPage<T>(records: readonly T[], requestedPage: number)`. The projection returns readonly rows, total count, one-based page, page count and inclusive start/end. Nonpositive, fractional, nonfinite or unsafe page numbers normalize to 1; oversized valid page numbers clamp to the last page. Empty input yields page/pageCount/start/end 0 and no rows. Record references and exact `mockUnits` strings remain intact.

`ResaleMarketPagination` receives a section, variant, projection, source snapshot, snapshot-announcement ownership flag and local page setter. It invokes no controller, port, storage or network operation. Record types in the fixture and panels derive from the controller's deeply readonly detail return type.

## Ordering and transitions

Each collection filters by selected variant, then slices in original source order. No sorting, deduplication, mutation or snapshot truncation occurs. Offers and trades have independent local page state. Variant selection resets both synchronously; the existing product-keyed mount resets product changes. Locale changes, appends and replacements preserve valid page positions. Shrinkage clamps and commits page state during rendering, before the DOM commit, preventing obsolete page requests from reappearing after later growth. Empty-to-populated starts on page 1. Snapshot identity and version changes alone never reset page state.

History pages add no URL/storage field and leave marketplace search `lang`, `q` and `page` context alone. Pagination leaves review state, blocked/connectivity logic, UNKNOWN and STALE feedback and every `MarketNotice` outside the sliced content.

## Accessibility

Each section has its own named navigation, content ID and atomic status containing section, localized variant, range, total and page count. Initial status mounting has `aria-live="off"`; user presentation changes and explicit read snapshots activate `polite`. The automatic read after CONFIRMED/REJECTED defers to the outcome region, preserving the existing single-announcement contract for a write. Page clamps caused by that automatic snapshot stay quiet; user paging, variant and locale changes still announce. First/Previous/Next/Last are native buttons with stable keys and `aria-controls`. Boundary buttons remain focusable with guarded `aria-disabled` handlers. Paging and refresh preserve control identity and focus; variant selection keeps focus. Neither pager moves focus to trading outcomes. Copy is in the existing ko/en resale catalogue and styles reuse the existing wrapping action layout.

## Acceptance evidence

- Deterministic, schema-valid fixture: 1,001 standard-variant offers and trades, 51 wide-variant records, unique stable IDs, fixed valid times and exact strings above Number precision. Fixture generation retains source claims, quotes and series.
- Pure tests cover totals 0, 1, 49, 50, 51, 1,000 and 1,001, every source record exactly once, immutable inputs/reference preservation and invalid page requests.
- Mounted tests traverse all 21 pages independently, count actual table/list rows, test boundaries, empty variants, variant reset, locale retention, append, equal-length reversed replacement, shrink, empty and repopulation. Read/submit spies show paging sends nothing; UNKNOWN remains visible and writes disabled through paging/read/locale changes.
- Browser tests use the existing test-only port substitution for large snapshots and read/dispatch counters; production receives no fault hooks. They check complete traversal, counts, URL stability, snapshot refresh and UNKNOWN fencing.
- Accessibility browser checks exercise Tab/Shift+Tab, Enter/Space, focusable boundaries, empty variants, ko/en atomic ranges, axe, 320px reflow, dark scheme and forced colours.

## Commands and results

Commands use Node 22.23.4 (the default container Node is 24), with its bin directory first on PATH; no VITE overrides. Heavy suites run sequentially in the foreground. The live protocol gate is intentionally skipped under `KIX_REQUIRE_GATE=0`, never counted as passing. Base HEAD: `a63bda10c0083d6b41007b484401034c714e114c`.

| Command actually run | Result |
| --- | --- |
| `npx --yes --package=node@22 node --version` | PASS: v22.23.4. |
| `npx --yes --package=node@22 -c 'node --version && npm ci'` | PASS: 535 packages installed. npm reported 24 audit findings (21 moderate, 1 high, 2 critical); no dependency/lock changes. |
| `npm exec -w @kix/web -- vitest run test/resale-market-pagination.test.ts test/resale-market-pagination-interactions.test.tsx test/resale-market.test.tsx` | Initial run: 25 passed, 2 failed because expected grouped counts differed from the existing formatter. Corrected expectations; reruns PASS, 27/27; after the announcement regression test was added, PASS 28/28 on the final implementation. |
| `npm run typecheck` | Initial run failed on dynamic translation typing and NodeList iteration in a test. Fixed both; subsequent runs PASS, including the announcement refinement. |
| `npm run build` | PASS before and after the shared-shell adjustment. |
| `KIX_REQUIRE_GATE=0 npm test` | Initial run failed only the stricter 785000-byte assertion (785627 bytes). Shared-shell run before the announcement refinement PASS: adapter 1981 passed / 23 live-gate tests skipped; web 1462 passed; cold entry 6 passed. Later default-concurrency timeouts and final verification are recorded below. |
| `npm exec -w @kix/web -- vite build` | PASS in three diagnostic runs: compact-section experiment, temporarily restored HEAD resale source for baseline comparison, then shared-shell implementation. Compact-section experiment discarded; HEAD component bodies preserved exactly in the final shared file. |
| `npm run budget` | PASS in all four diagnostic measurements: 785627, 785616, baseline 784977 and final shared-shell 784470 total gzip bytes. Initial JS final 160180; CSS 4974; largest route chunk 27516. All limits unchanged. |
| `npm run typecheck:e2e` | PASS. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Initial run failed when the existing locale AST audit exceeded its unchanged 5000 ms timeout. Unchanged full rerun PASS: adapter lines/statements 91.57%, functions 97.78%, branches 85.57%; web lines/statements 93.85%, functions 84.89%, branches 90.21%. All floors met. |
| `npm run deps:check` | PASS. |
| `npm run cycle-check` | PASS: no circular imports in any checked workspace. |
| `npm run audit:warn` | PASS: production audit reported 0 vulnerabilities. |
| `npm run budget` (shared-shell build before announcement refinement) | PASS: total 784470, initial JS 160180, initial CSS 4974, largest route chunk 27516 gzip bytes. Also meets the unchanged 785000-byte entry-graph test cap. |

The announcement-refined build also passed `npm run build` and `npm run budget`: total **784508**, initial JS **160179**, CSS **4974**, largest route chunk **27516** gzip bytes. A subsequent default-concurrency `KIX_REQUIRE_GATE=0 npm test` encountered four unrelated timeouts (async-state hooks/tests, route breadcrumb test and gallery production build) under shared-host load. Validation then used `taskset -c 0,1` for unit and coverage commands to limit Vitest worker fanout; test counts, assertions, timeout values, coverage floors and bundle limits remain unchanged. Browser commands use the normal harness without CPU affinity.

Browser commands set `KIX_E2E_CHROME=/usr/bin/google-chrome` and `KIX_E2E_NO_SANDBOX=1`, matching the CI container setting. Run records are written to `/tmp/market-history-*-record.json`. Completed verification results are recorded below and in the resumed builder table.

| Final/refined command | Result |
| --- | --- |
| `KIX_REQUIRE_GATE=0 taskset -c 0,1 npm test` | PASS: adapter 1981 passed / 23 skipped (5 live-gate files); web 1463 passed; cold entry 6 passed. No timeout/assertion changes. |
| `npm run lint` (after announcement refinement) | PASS. |
| `KIX_REQUIRE_GATE=0 taskset -c 0,1 npm run coverage:check` | PASS after the announcement refinement. Adapter lines/statements 91.57%, functions 97.78%, branches 85.57%; web lines/statements 93.85%, functions 84.89%, branches 90.21%. All floors met. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` (before announcement refinement) | PASS: 212 tests / 48 files, including all 11 resale-market tests. Ledger: nonLoopback 0, nonGet 0, appNetworkCalls 0. Final rerun follows below. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` (unchanged final rerun) | PASS: 212 tests / 48 files, complete journey matrix. The prior connectivity/session timeout cases pass. Ledger: nonLoopback 0, nonGet 0, appNetworkCalls 0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` (first announcement-refined rerun) | FAIL: 210 passed, 2 timed out (existing offline-connectivity all-screen navigation and session-recovery reload test). Matrix incomplete; not a pass. Resale-market 11/11 passed. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` (announcement-refined full run) | PASS: 395 tests / 21 files, including all 91 keyboard outcome tests and 4 resale tests. The previously failing SUCCESS/REJECT checks now observe exactly one announcement. Ledger: nonLoopback 0, nonGet 0, appNetworkCalls 0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 9 tests / 3 files; original split, failure, long-list render and size limits unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=0 npm run test:visual` (first comparison) | Expected failure: exactly the 10 affected resale-product captures differ; 113 tests passed / 10 failed (98 other captures matched, 15 harness checks passed). Visual matrix incomplete, not counted as a pass. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=1 npm run test:visual` (earlier attempt, completed log inspected on resume) | PASS: 123 tests / 3 files, 108 captures recorded or matched. Unrelated handoff/marketing PNG byte changes and hashes were subsequently restored to HEAD; the final comparison below validates the retained resale captures. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` (first attempt) | Failed observations: Chrome closed after four form tests; the existing outcome probe also found two duplicate-announcement regressions on resale-product SUCCESS/REJECT. Interrupted with SIGINT (exit 130) after known failures to rebuild and validate the fix. This attempt is not a passing or complete matrix. |

## UNDETERMINED and STOP conditions

Producer mappings, real pricing, fees, matching priority, expiry, settlement and retention remain **UNDETERMINED**. No real payment, marketplace, KYC, bank rail, venue scan or production runtime is added. No capture/settlement composition, desk remapping, protocol catalogue/gate consumption, UI fetch, retries, fallback or public transport is introduced. No dependencies, CI rules, budgets, protocol files, `.aiops/` or `docs/aiops/` are changed.

Stop for an unmerged contract/dependency, new protocol command, policy value, hardware, money/paid services, credentials, production runtime or locked-area edit. No such dependency is needed for this presentation work.

## Deviations

The explicit constraint-mandated bind filename is used. The standalone node scope is applied despite its absence from the 60-node checkout metadata. Counts follow the repository's existing ungrouped number formatter. The full stub suite exposed a stricter, pre-existing 785000-byte total-gzip assertion in `entry-import-graph.test.ts`, with only 23 bytes of baseline headroom. The first implementation measured 785627 bytes. A compacted-section experiment still measured 785616 and was discarded. `ResaleMarketPages.tsx` now holds the unchanged list/product route shells; the original route modules re-export them and retain their CSS imports. Sharing their lazy bundle removed duplicate chunk overhead while retaining the planned independent pagination state and `MarketNotice` reuse. Before the accessibility refinement, the resulting total was 784470 bytes, below both existing ceilings. No budget or assertion changed.

The existing browser live-region probe also exposed duplicate range announcements during the automatic post-submit read. Snapshot announcements now defer to the outcome for that read; presentation changes and explicit reads retain range announcements. The initial a11y attempt also lost Chrome in the form fixture and was interrupted after these known failures to validate the corrected implementation with the full suite. No test assertion, timeout, retry, matrix or budget was weakened.

## Changed-file inventory

- Web presentation and locale: `apps/web/src/resale-market-pagination.ts`; `apps/web/src/pages/ResaleMarketPagination.tsx`, `ResaleMarketPanels.tsx`, `ResaleMarketPages.tsx`, `ResaleMarket.tsx`, `ResaleProduct.tsx`; `apps/web/src/i18n/messages/pages--Resale.ts`.
- Web tests: `apps/web/test/resale-market-pagination.test.ts`, `resale-market-pagination-interactions.test.tsx`, `support/resale-market-history-fixture.ts`.
- Browser fixture, typing and checks: `apps/e2e/shell-fixtures/resale-market.ts`, `apps/e2e/src/resale-fault-types.ts`, `apps/e2e/tests/journeys/resale-market.e2e.test.ts`, `apps/e2e/tests/a11y/resale-market.a11y.test.ts`.
- Evidence: this document. Visual assets: the 10 `resale-product.*.png` files in `apps/e2e/visual-baselines/linux-d29b2e9b/` and that profile’s `manifest.json`; final recording/comparison evidence follows below.

## Visual review and limits

All 10 affected actual captures were inspected locally: desktop en/ko light, phone en/ko light, phone ko dark, desktop en forced colours, and desktop en / phone ko review/result. The added counts and controls wrap within the panels; source values, mock/no-funds notices, chart and review/result content remain intact. The harness's existing 2000-pixel capture cap remains unchanged: taller phone captures (and the desktop result capture) may stop before the lower content ends. These pictures are partial visual observations; the full DOM, both pagers, focus, axe and 320px reflow are covered by the browser tests. No screenshot tolerance, mask, capture cap or matrix was weakened.

## Resumed builder verification (2026-11-03)

Continued the earlier attempt's implementation and evidence above. Restored seven unrelated handoff/marketing PNGs and their manifest hashes to HEAD; only the ten affected resale-product captures remain changed. Re-inspected desktop English and phone Korean captures. Node **v22.23.4** is selected by `export PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH` for the following commands. No `VITE_*` overrides are set. Logs use `/tmp/market-history-resume-*` and are local artifacts, not committed evidence or release approval.

| Command actually run in resumed verification | Result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; 24 development-inclusive audit findings (21 moderate, 1 high, 2 critical). Dependencies and lockfile unchanged. |
| `npm exec -w @kix/web -- vitest run test/resale-market-pagination.test.ts test/resale-market-pagination-interactions.test.tsx test/resale-market.test.tsx` | PASS: 28 tests / 3 files. |
| `npm run typecheck` | PASS: adapter and web. |
| `npm run build` | PASS: clean stub production build; existing marketing circular-chunk warning retained. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS without CPU affinity: adapter 1,981 passed / 23 live-gate tests skipped (5 files); web 1,463 passed; cold entry 6 passed. |
| `npm run typecheck:e2e` | PASS. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS without CPU affinity. Adapter lines/statements 91.57%, functions 97.78%, branches 85.57%; web lines/statements 93.85%, functions 84.89%, branches 90.21%. All unchanged floors met. |
| `npm run deps:check` | PASS: 4 manifests and 630 lockfile entries checked. |
| `npm run cycle-check` | PASS: no circular imports in any checked workspace. |
| `npm run audit:warn` | PASS: production audit reports 0 vulnerabilities. |
| `npm run budget` | PASS: total 784,508; initial JS 160,179; initial CSS 4,974; largest chunk 27,516 gzip bytes. All limits unchanged. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | PASS: 212 tests / 48 files, complete journey matrix. Record: `/tmp/market-history-resume-e2e-record.json` (`KIX_E2E_RECORD_OUT`); ledger nonLoopback/nonGet/appNetworkCalls all 0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` | PASS: 395 tests / 21 files, complete matrix; all 91 keyboard outcome tests and 4 resale tests pass. Record: `/tmp/market-history-resume-a11y-record.json` (`KIX_A11Y_RECORD_OUT`); ledger nonLoopback/nonGet/appNetworkCalls all 0; no leaked pages, pending calls or cleanup errors. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 9 tests / 3 files, with existing size, split, chunk-failure and long-list render limits unchanged. Record: `/tmp/market-history-resume-browser-budget-record.json` (`KIX_BUDGET_RECORD_OUT`). |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=0 npm run test:visual` (first resumed comparison) | FAIL: Chrome unexpectedly closed at `permissions.desktop.en.light`; 104 tests passed / 19 failed, with 19 captures incomplete and no preceding screenshot mismatch. Matrix incomplete, not a pass. Record: `/tmp/market-history-resume-visual-record.json` (`KIX_VISUAL_RECORD_OUT`); actuals: `/tmp/market-history-resume-visual-out` (`KIX_VISUAL_OUT`). An unchanged full rerun follows. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=0 npm run test:visual` (unchanged resumed rerun) | PASS: 123 tests / 3 files, all 108 captures match; complete matrix. Record: `/tmp/market-history-resume-visual-rerun-record.json` (`KIX_VISUAL_RECORD_OUT`); actuals: `/tmp/market-history-resume-visual-rerun-out` (`KIX_VISUAL_OUT`). No tolerance, matrix, timeout or retry setting changed. |
| `python3` scope/locked-file check and manifest SHA-256 check | PASS: 26 changed files, none outside the permitted paths; locked binding bytes equal HEAD and the supervisor SHA-256; all 108 manifest PNG hashes match. |
| `git diff --check` | PASS. |

All requested local stub checks now have passing completed runs. The failed visual attempt remains recorded separately. No runtime source changed during the resumed verification; only the unrelated capture updates were restored and this evidence was completed. The earlier shared-shell and announcement adjustments remain the documented implementation deviations. Qualification **UNQUALIFIED**, acceptance **PENDING**, release **NOT_AUTHORIZED** remain unchanged. No git commit, push, PR, issue or comment was created.
