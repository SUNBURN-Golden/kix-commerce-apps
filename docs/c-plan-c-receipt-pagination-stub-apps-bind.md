# Receipt timeline pagination (local stub presentation)

## Scope and ruling

Node `c-plan-c-receipt-pagination-stub`, based on `5be78541968af937c22abdd1fcc0899155ce1e54`.

**M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce**.
The journey remains bounded at `accept_trade`; this change sends nothing and changes no binding, command, receipt contract, pin, or gate. Wave 6 gate record: https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343; roadmap context: producer `docs/decisions/PROGRAM_ROADMAP_20260930.md`. No producer change is consumed.

The page filters and pages only adjudicated, authorized evidence from `buildReceiptExplorer`. It retains all evidence and the complete existing redacted support diagnostic. UNKNOWN remains UNKNOWN; no display operation confirms an outcome or lifts a fence. Retention, refund and price policies remain `UNDETERMINED`. No storage, TTL, eviction, network, command, retry, dependency, CI or budget change is introduced.

## Readiness

Implementation and acceptance checks are complete. The required stub desk commands, static quality/budget checks and all four full browser suites pass on this host: complete `npm run test:e2e` (47 files / 197 tests), `npm run test:a11y` (19 files / 371 tests), `npm run test:budget` (9 tests) and `npm run test:visual` (109 tests / 94 MATCH shots), each with a clean matrix/lifecycle teardown and a zeroed network ledger. Earlier full-run failures were unrelated-test timeouts during recorded host stalls; the ledger retains every failed attempt and its teardown result, and no results from separate attempts are combined into a full-suite pass. Production/readiness/acceptance claims remain false or PENDING.

## Interfaces and filtering

`receipt-pagination.ts` provides `RECEIPT_PAGE_SIZE = 50`, `ReceiptTimelineQuery`, `ReceiptTimelinePage`, `buildReceiptTimelinePage(model, query)` and `receiptSelectionKey(model, entry)`.

Projection order is paths followed by groups in their original order. Status and context filters intersect before a single global slice of at most 50 entries, including `adapter_path` observations. Visible groups retain their original heading, last-confirmed and unconfirmed explanations, even when the receipts named by those explanations are outside the page or filter.

The context control consumes the model's existing `ROLE_CONTEXTS` authorization table; it adds no new authorization rule. The status control offers existing `TrackState` words, with `unknown` labeled “Unresolved (UNKNOWN)” / “미확인 (UNKNOWN)”. Other states receive no new business classification.

Counts explicitly distinguish authorized total, matching entries before paging, visible range, and all authorized UNKNOWN entries independent of filters. Empty results have range 0–0, page 0 of 0 and guarded, focusable pagination buttons. Filter changes reset page 1. Evidence updates clamp a page only if it becomes invalid; arrivals do not navigate to new entries.

All query and selection state stays in React memory. Existing timeline, detail, export and diagnostic IDs remain. The single polite `#receipt-timeline-status` reports counts, selection and off-page selection. On the initial route mount it has `aria-live="off"`, letting the existing shell title announce navigation once; the first receipt presentation/evidence change enables `polite` permanently for that view. Role/session boundary transitions enable the new status immediately. Locale-only changes do not activate a quiet receipt status. Empty-state children delegate announcements to that parent.

## Selection and focus transitions

Identity contains screen session, screen role, entry role, context, reference, action and operation ID; it excludes mutable sequence, status and page position. The same stable identity drives selection, row reconciliation and keyboard selection. Ambiguous candidates get distinct per-object rendering tokens, preventing DOM reuse across competing observations without treating a token as receipt identity.

Initial selection considers only the first entry and requires its identity to be unique. An initially empty or ambiguous model stays unselected until an explicit selection. A missing or ambiguous selected identity is permanently cleared: later matching or newly unique evidence does not restore it. Filters and paging retain an authorized selected detail with an explicit explanation when its row is outside the current page/filter.

Role/session boundaries synchronously remount presentation state, reset filters/page and clear detail without selecting another receipt. Initial selection is allowed only on the first mount of the explorer, never on a later boundary transition. Role-tab keyboard focus survives the remount. Focused timeline nodes are tracked across the boundary as well as normal updates; when a focused node is removed, focus moves to the new timeline status. A surviving node retains focus through sequence changes. Background arrivals do not otherwise steal focus.

Arrow keys and Home/End traverse mounted entry buttons across all visible groups and paths. The pager uses native Tab and Enter/Space behavior; boundaries use `aria-disabled` plus guarded handlers and remain focusable. Filter/pager focus remains on its initiating control. Existing 44px target and global focus styles are reused; no CSS is added.

The locked `commerce-bindings.ts` was also compared byte-for-byte with the planning base: SHA256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` on both. The protected-path diff is empty.

## Export boundaries

Textarea and clipboard input remain exactly `model.exportText`. Filters and pagination never modify diagnostic construction or `sweepExport`. The full export includes all authorized entries, existing quarantine metadata, recorded-not-sent reasons and all existing false flags. Foreign-session evidence remains dropped; disallowed contexts never enter timeline/detail or diagnostic entries. Existing sanitized quarantine reason/action/operation-ID metadata is preserved, rather than weakened or reclassified as evidence.

The deterministic fixture uses `ReceiptExplorerInput.extra`, 1,250 entries in each non-transport context, with five cycling states. Role fixtures mirror ordinary desk projection by supplying only their permitted contexts; separate adversarial tests inject disallowed contexts and foreign sessions through the adjudication boundary. Operator total/UNKNOWN counts are 5,000/1,000; buyer 3,750/750; organizer 1,250/250. Transport variants verify the global slice boundary.

## Acceptance evidence

| Requirement | Evidence |
| --- | --- |
| 5,000 entries, 50 mounted maximum, all pages and first/last | Pure projection test covers all 100 pages in order exactly once; mounted/browser tests check first/last and the timeline DOM count; transport variant spans 101 pages. |
| Filter counts, UNKNOWN discoverability and empty results | Pure, mounted and browser tests check combined context/status filters, independent UNKNOWN totals, empty ranges and page guards. |
| Stable identities and permanent invalidation | Mounted tests cover initial ambiguity, missing→matching, duplicate→unique, empty→populated, earlier-group arrivals and sequence changes. Browser tests focus a transport row while preceding path observations are inserted/removed, then remove it; missing and duplicate selections stay cleared after arrivals. |
| Role/session isolation | Pure adversarial adjudication tests and existing explorer tests; mounted role/session changes reset filters/detail, remove forbidden options and drop foreign evidence. Browser organizer transition checks counts, empty detail and permitted options. |
| Complete redacted export | Pure immutability/cardinality checks, mounted textarea/clipboard byte equality before/after display operations, browser full diagnostic equality across filters/pages and ko/en. Existing redaction and false-flag regression checks remain. |
| Keyboard, focus and accessibility | Mounted cross-group arrows/Home/End, pager focus, invalidated focus recovery and role-tab keys; browser Tab/Enter/Space, large-fixture axe, 320px ko/en reflow and dark/forced-colour focus/44px probes. |
| Presentation-only boundary | Existing source guard extended to the new helper; mounted network trap and storage-write spy; browser loopback/non-GET/app-network ledgers. |
| Source/profile and full-group explanations | Existing explorer contract tests plus filtered projection summary assertions. |

## Visual review

Reviewed the recorded `receipts.phone.ko.light.png` and `receipts.desktop.en.light.png` on profile `linux-d29b2e9b`, Chrome 156.0.8078.47. Only those two PNGs changed; 92 other shots matched exactly. The new labels, native selects, count/selection line and pager fit without overlap. The phone controls stack and the count wraps within the viewport; the existing screenshot height cap is unchanged. The per-load session paragraph and diagnostic masks, 8-channel delta and 200ppm tolerances remain unchanged. Recording is not comparison-pass evidence. The normal comparison passed in run 41: 109 tests passed and all 94 screenshots matched, with zero application-network, non-GET or non-loopback calls. Run 36's clock-jump timeout remains recorded as a failure.

## Commands and results

Validation uses local Node 22.20.0, with `PATH=/tmp/kix-node22/node_modules/node/bin:$PATH`. Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome` and `KIX_E2E_NO_SANDBOX=1`. Long jobs run in the foreground through the terminal session and are polled until complete.

<!-- COMMAND_RESULTS -->

Initial exploratory `npm ci` and `npm run typecheck` used the preselected Node 20.19.2 and passed; dependency installation was then repeated with Node 22.20.0. All subsequent validation below uses Node 22.20.0. No `VITE_*` environment variables were set.

| Earlier command | Actual result |
| --- | --- |
| `npm ci` (Node 22) | PASS; 535 packages installed. Full dependency audit reported 5 existing findings (2 moderate, 1 high, 2 critical); the production-only audit below reports zero. No dependency/lock changes. |
| `npm exec -w @kix/web -- vitest run test/receipt-pagination.test.ts test/receipt-pagination-interactions.test.tsx test/receipt-explorer.test.tsx` (first run) | 27 passed, 1 failed: the default role fixture included disallowed-context quarantine metadata. Corrected the default fixture to mirror role-filtered desk projection; dedicated adversarial tests still inject forbidden contexts. |
| `npm run typecheck && npm run typecheck:e2e` (early run) | Typecheck failed on unused `act` test import; removed it. The second command did not execute. |
| Same focused receipt test command (second run) | PASS, 28 tests. |

Full sequential validation ledger (each command ran in the repository root; workspace commands select their workspace). Logs are local `/tmp/receipt-check-N.log`; browser records are local temporary evidence, not committed artifacts.

| Run | Command | Actual result |
| --- | --- | --- |
| 1 | `npm run typecheck` | PASS; 18.0s |
| 2 | `npm run typecheck:e2e` | FAIL (exit 2); 2.7s |
| 3 | `npm run typecheck:e2e` | PASS; 2.5s |
| 4 | `npm run build` | PASS; 23.7s |
| 5 | `KIX_REQUIRE_GATE=0 npm test` | PASS; 70 passed / 5 skipped (75); 1659 passed / 23 skipped (1682); 95 passed (95); 1311 passed (1311); 1 passed (1); 6 passed (6); 40.9s |
| 6 | `npm run lint` | FAIL (exit 1); 8.5s |
| 7 | `npm exec -w @kix/web -- vitest run test/receipt-pagination.test.ts test/receipt-pagination-interactions.test.tsx test/receipt-explorer.test.tsx` | PASS; 3 passed (3); 28 passed (28); 6.3s |
| 8 | `npm run lint` | PASS; 8.2s |
| 9 | `npm run typecheck` | PASS; 17.5s |
| 10 | `npm run build` | PASS; 25.4s |
| 11 | `KIX_REQUIRE_GATE=0 npm test` | PASS; 70 passed / 5 skipped (75); 1659 passed / 23 skipped (1682); 95 passed (95); 1311 passed (1311); 1 passed (1); 6 passed (6); 48.1s |
| 12 | `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; 70 passed / 5 skipped (75); 1659 passed / 23 skipped (1682); 95 passed (95); 1311 passed (1311); all unchanged coverage floors met; 67.4s |
| 13 | `npm run deps:check` | PASS; dependency/license gate passed; 0.1s |
| 14 | `npm run cycle-check` | PASS; no cycles; 7.9s |
| 15 | `node scripts/i18n-audit.mjs` | PASS; zero i18n findings; 0.6s |
| 16 | `npm run budget` | PASS; initialJsGzip=161465 initialCssGzip=4974 totalGzip=784367 files=94 chunks=86; 0.2s |
| 17 | `npm run audit:warn` | PASS; zero production vulnerabilities; 1.1s |
| 18 | `npm run typecheck:e2e` | PASS; 2.7s |
| 19 | `KIX_E2E_RECORD_OUT=/tmp/receipt-e2e-record.json npm run test:e2e` | FAIL (exit 1); 1 failed / 46 passed (47); 1 failed / 196 passed (197); 374.0s |
| 20 | `KIX_A11Y_RECORD_OUT=/tmp/receipt-a11y-record.json npm run test:a11y` | FAIL (exit 1); 1 failed / 18 passed (19); 2 failed / 369 passed (371); 576.7s |
| 21 | `npm exec -w @kix/web -- vitest run test/receipt-pagination.test.ts test/receipt-pagination-interactions.test.tsx test/receipt-explorer.test.tsx` | PASS; 3 passed (3); 28 passed (28); 7.4s |
| 22 | `npm run typecheck` | PASS; 19.4s |
| 23 | `npm run typecheck:e2e` | PASS; 2.6s |
| 24 | `npm run build` | PASS; 26.7s |
| 25 | `KIX_REQUIRE_GATE=0 npm test` | PASS; 70 passed / 5 skipped (75); 1659 passed / 23 skipped (1682); 95 passed (95); 1311 passed (1311); 1 passed (1); 6 passed (6); 44.3s |
| 26 | `npm run lint` | PASS; 10.1s |
| 27 | `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; 70 passed / 5 skipped (75); 1659 passed / 23 skipped (1682); 95 passed (95); 1311 passed (1311); all unchanged coverage floors met; 79.4s |
| 28 | `node scripts/i18n-audit.mjs` | PASS; zero i18n findings; 0.5s |
| 29 | `npm run budget` | PASS; initialJsGzip=161459 initialCssGzip=4974 totalGzip=784722 files=94 chunks=86; 0.2s |
| 30 | `KIX_E2E_RECORD_OUT=/tmp/receipt-e2e-record.json npm run test:e2e` | FAIL (exit 1); 1 failed / 46 passed (47); 1 failed / 196 passed (197); 496.4s |
| 31 | `KIX_A11Y_RECORD_OUT=/tmp/receipt-a11y-record.json npm run test:a11y` | FAIL (exit 1); 2 failed / 17 passed (19); 2 failed / 369 passed (371); 1218.9s |
| 32 | `KIX_BUDGET_RECORD_OUT=/tmp/receipt-budget-record.json npm run test:budget` | PASS; 3 passed (3); 9 passed (9); 27.0s |
| 33 | `KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/receipt-visual-update-record.json npm run test:visual` | PASS; 3 passed (3); 109 passed (109); 104.3s |
| 34 | `KIX_E2E_RECORD_OUT=/tmp/receipt-e2e-record.json npm run test:e2e` | FAIL (exit 1); 2 failed / 45 passed (47); 2 failed / 195 passed (197); 625.6s |
| 35 | `KIX_A11Y_RECORD_OUT=/tmp/receipt-a11y-record.json npm run test:a11y` | FAIL (exit 1); 1 failed / 18 passed (19); 2 failed / 369 passed (371); 669.5s |
| 36 | `KIX_VISUAL_RECORD_OUT=/tmp/receipt-visual-record.json npm run test:visual` | FAIL (exit 1); 1 failed / 2 passed (3); 1 failed / 108 passed (109); 124.1s |
| 37 | `npm run typecheck:e2e` | PASS; 3.3s |
| 38 | `! rg -n -e __kixReceiptPagination -e __kixReceiptChange -e op-page- apps/web/dist` | PASS; 0.0s |
| 39 | `git diff --check` | PASS; 0.0s |
| 40 | `git diff --exit-code 5be78541968af937c22abdd1fcc0899155ce1e54 -- .aiops docs/aiops packages .github apps/web/bundle-budget.json` | PASS; 0.0s |
| 41 | `KIX_VISUAL_RECORD_OUT=/tmp/receipt-visual-record.json npm run test:visual` | PASS; 3 passed (3); 109 passed (109); 135.7s |
| 42 | `git diff --check` | PASS; 0.0s |
| 43 | `git diff --exit-code 5be78541968af937c22abdd1fcc0899155ce1e54 -- .aiops docs/aiops packages .github apps/web/bundle-budget.json` | PASS; 0.0s |

Verification continuation (second builder session on the unchanged implementation; runs 44–50 used local Node 20.19.2, runs 51–54 used Node 22.20.0):

| Run | Command | Actual result |
| --- | --- | --- |
| 44 | `npm ci` | PASS; clean install, 5 existing dev-chain audit findings, zero production findings (run 49). No dependency/lock changes. |
| 45 | `npm exec -w @kix/web -- vitest run test/receipt-pagination.test.ts test/receipt-pagination-interactions.test.tsx test/receipt-explorer.test.tsx` | PASS; 3 passed (3); 28 passed (28); 10.2s |
| 46 | `npm run typecheck` | PASS |
| 47 | `npm run build` | PASS |
| 48 | `KIX_REQUIRE_GATE=0 npm test` | PASS; 95 files / 1311 tests plus adapter and cold suites; 37.3s |
| 49 | `npm run typecheck:e2e`; `npm run lint`; `npm run deps:check`; `npm run cycle-check`; `node scripts/i18n-audit.mjs`; `KIX_REQUIRE_GATE=0 npm run coverage:check`; `npm run budget`; `npm run audit:warn` | all PASS; budget initialJsGzip=160699 initialCssGzip=4984 totalGzip=782359 files=94 chunks=86; coverage floors met; zero production vulnerabilities |
| 50 | `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` focused receipt browser checks | receipts journey PASS 4/4 (suite teardown reports an intentionally incomplete matrix on focused runs); pagination a11y both PASS — the heavy case passed in 14.4s on retry after one 120s host-stall timeout |
| 51 | `KIX_BUDGET_RECORD_OUT=/tmp/budget-record.json npm run test:budget` (full suite) | PASS; 3 passed (3); 9 passed (9); 29.4s; clean teardown |
| 52 | `KIX_VISUAL_RECORD_OUT=/tmp/visual-record.json npm run test:visual` (full suite) | PASS; 3 passed (3); 109 passed (109); all 94 screenshots MATCH including both updated receipts baselines; 107.9s |
| 53 | `KIX_E2E_RECORD_OUT=/tmp/e2e-record.json npm run test:e2e` (full suite) | PASS; 47 passed (47); 197 passed (197); 329.9s; complete matrix, clean lifecycle teardown, zeroed network ledger |
| 54 | `KIX_A11Y_RECORD_OUT=/tmp/a11y-record.json npm run test:a11y` (full suite) | PASS; 19 passed (19); 371 passed (371); 692.2s; both large-fixture receipt tests pass; clean teardown |
| 55 | `npm ci`; `npm run typecheck`; `npm run build`; `KIX_REQUIRE_GATE=0 npm test` (Node 22.20.0) | all PASS; identical results to the Node 20 runs |
| 56 | `git diff --check`; protected-path diff (same paths as run 43) | both PASS |

Failed-run explanations: earlier full-suite failures (runs 19, 20, 30, 31, 34, 35, 36) are superseded by the clean complete runs 51–54 on the unchanged implementation; they remain recorded failures because each command did fail then. Run 2 used the wrong viewport enum (`phone` instead of the existing `narrow`); corrected the new test. Run 6 caught a non-null assertion; replaced it with a safe lookup. Run 19 recorded a 191,622ms host-clock step during the existing session-recovery timeout (15,920ms monotonic runtime); no timeout/retry/CI changes were made. Run 20 caught two real duplicate initial receipt announcements, in the existing receipts SUCCESS/REJECT keyboard drives. The initial status is now quiet under the shell announcement and becomes polite for local changes; all existing one-announcement checks remain unchanged. Run 30 hit a separate 190,174ms host event-loop stall in the existing all-screen offline-connectivity check (201,538ms total, 2,401ms worker CPU); its missing checks/pending call were reported by teardown. Run 31 passed the repaired receipt announcement drives and both large-fixture tests, but hit 258,519ms and 378,782ms host stalls in the existing live-probe and all-route Korean catalogue tests. Both timed out; teardown correctly reported the incomplete check/pending calls. Run 34 hit marketing timeouts with a 292,479ms stall and a 1,131,711ms wall-clock step; previously failed session/offline cases passed. Run 35 hit unrelated gallery timeouts with a 67,950ms stall and a 3,081,563ms wall-clock step. Run 36 matched all 94 screenshots but timed out in buyer.phone.ko.light during a 338,671ms clock step (17,860ms monotonic runtime), so the full command remains failed. Initial failed records are preserved locally as `/tmp/receipt-e2e-initial-failed-record.json`, `/tmp/receipt-e2e-second-failed-record.json` and `/tmp/receipt-a11y-initial-failed-record.json` and `/tmp/receipt-a11y-second-failed-record.json`.

Local record `/tmp/receipt-e2e-record.json`: ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.
Local record `/tmp/receipt-a11y-record.json`: ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.
Local records `/tmp/e2e-record.json` and `/tmp/a11y-record.json` (clean full runs 53–54): ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.
Local record `/tmp/receipt-budget-record.json`: ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.
Local record `/tmp/receipt-visual-update-record.json`: ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.
Local record `/tmp/receipt-visual-record.json`: ledger `{"appNetworkCalls": 0, "nonGet": 0, "nonLoopback": 0}`; Chrome `156.0.8078.47`.

## Deviations and limits

- The constraint's `docs/c-plan-c-receipt-pagination-stub-apps-bind.md` path takes precedence over the objective's shorter filename.
- Exported the existing `ROLE_CONTEXTS` table from the receipt model to reuse its exact permissions for filter options. No model adjudication or diagnostic behavior changes.
- Reused existing target/focus/layout styles; no stylesheet change is needed, preserving the small CSS budget headroom.
- Browser regression correction: keep the initial count readable but quiet, because the shell already announces route navigation. Local receipt updates remain polite; no timers, duplicate announcements or weakened checks.
- Applied both design-review corrections: stable rendering/focus identity and permanent invalidation of missing/ambiguous selections.
- No live-gate, production, assistive-technology, real-device or user-acceptance claim is made. Live gate tests skipped with `KIX_REQUIRE_GATE=0` are skipped, not passed. Browser evidence is local synthetic/stub observation; acceptance remains PENDING and release NOT_AUTHORIZED.
- An earlier `DECISION_REQUIRED.md` requested a stable validation host after repeated host-stall timeouts. Clean complete runs of every browser suite were later recorded on this host (runs 51–54), so the blocker is resolved and the file is removed.

## Files changed

- `apps/e2e/shell-fixtures/receipts-fault.ts`
- `apps/e2e/shell-fixtures/receipts-pagination.tsx`
- `apps/e2e/tests/a11y/receipts-pagination.a11y.test.ts`
- `apps/e2e/tests/journeys/receipts.e2e.test.ts`
- `apps/e2e/visual-baselines/linux-d29b2e9b/manifest.json`
- `apps/e2e/visual-baselines/linux-d29b2e9b/receipts.desktop.en.light.png`
- `apps/e2e/visual-baselines/linux-d29b2e9b/receipts.phone.ko.light.png`
- `apps/web/src/i18n/messages/pages--Receipts.ts`
- `apps/web/src/pages/Receipts.tsx`
- `apps/web/src/receipt-explorer.ts`
- `apps/web/src/receipt-pagination.ts`
- `apps/web/test/receipt-explorer.test.tsx`
- `apps/web/test/receipt-pagination-interactions.test.tsx`
- `apps/web/test/receipt-pagination.test.ts`
- `apps/web/test/support/receipt-pagination-fixture.ts`
- `docs/c-plan-c-receipt-pagination-stub-apps-bind.md`
