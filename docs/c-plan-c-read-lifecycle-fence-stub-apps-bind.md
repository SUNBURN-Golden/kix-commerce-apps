# c-plan-c-read-lifecycle-fence-stub — app binding and evidence

## Authority and boundaries

This node is delegated by the builder task/owner record supplied for this work. The executable 18-node `.aiops/program.json` has no `c-plan-*` / read-lifecycle entry; this task does not promote or implement an entry from the non-executable `PENDING_NODES.json` or draft. Neither `.aiops/` nor `docs/aiops/` is edited. This is not an ASTRA program-mode delivery; no signer or GitHub operation is involved.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The 2026-10-23 c-i18n ruling and audit-6 option (b) remain recorded, unchanged context. The former permits copy deduplication and certain total-growth changes while keeping initial JS <= 290000; no budget/copy threshold or baseline is changed here. The latter's v2 fixture / SDK tuple decision is not modified. No catalogue, gate, SDK, schema or pin update is consumed. `commerce-bindings.ts` remains byte-identical, SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

Reference context, not newly consumed contracts: [Wave 6 gate record](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343), kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` (Wave 7 §2 R-7). kix-protocol is not changed or required to implement these app-local fences.

## Ownership and transitions

Both hooks guard completion by mounted lifetime, monotonically increasing stage ticket, source epoch and port identity. Dependent reads additionally check their current selection/page context. Accepted callbacks alone mutate outcomes, watermark floors, snapshots or observed-row maps. Context cleanup invalidates tickets even when no replacement read starts. There is no content-key dedupe; StrictMode's cleanup/setup replaces each cancelled effect read.

| Transition | Effect |
| --- | --- |
| Discovery row clear/change or detail disable | Detail ticket invalidated in committed layout cleanup; cleared/disabled model is terminal empty, with no row or loading. Disabled/cleared readAgain sends nothing. Render model withholds a different row's evidence. |
| Discovery filter/reset | List/detail invalidated synchronously; cursor/floor and detail authority cleared; exactly one explicit list read, including guarded reset. |
| Discovery stream replacement | Invalidate before replacing port; clear cursor/floor/detail evidence; read the new source once. |
| Discovery rebuild | Invalidate both stages and floor, replace port, issue no read. The last committed page/cursor remains solely for the deliberate REBUILT refusal on the next old-cursor read. Pending old work cannot replace that page. Without a committed page, expose Unknown read / Read again. |
| Inventory section change/clear | Page and selection cleanup invalidates all dependent requests, cursors and observed labels. No page/selection panels without a usable summary snapshot. |
| Inventory unit/quantity change/clear | Selection ticket invalidated even if no replacement starts. A→B→A cannot revive A's first request. |
| Inventory free-only/page change | Selection evidence is cleared before issuing the page; observed labels are reset. The location survives paging, but selection is revalidated only after that page settles, using the new observed labels (or null when absent). Page ticket and filter/selection context fence old selection callbacks. This dependent read is not a retry of a failed read. |
| Inventory summary refresh/scenario replacement | Immediately invalidate dependent tickets, cursor, labels and usable snapshot. Only an accepted ready summary supplies the next page/selection context; failed summary has one explicit recovery action and no endless dependent loading. Scenario replacement also resets source epoch and floor before replacing the port. |
| Inventory generation advance | Invalidate all stages, floor and observed labels, replace port, issue no read. Keep the old summary generation solely for behind / generation-changed demonstration. Old page/selection evidence is cleared; Back to summary clears the held snapshot before one summary read. |
| Return that clears location | Invalidate dependents synchronously before setLocation. The explicit return handler owns the summary read; route effects do not issue a second summary read. |
| Unmount | Invalidate lifetime/source and all stage tickets; cleanup publishes no state. Late success and failure are consumed without mutation. |

`settleRead` catches synchronous port/reset throws and promise rejections. Current failures become app-local `{ kind: "unknown", message: "" }`; the existing ko/en catalogue supplies Unknown read and Read again. Exception text is never rendered. Obsolete failures are consumed. Explicit not-bound, unsupported, invalid-request, stale, gap, tuple-changed and generation-changed outcomes pass through unchanged. This read-unknown shape has no access to the write journal or a write resolver.

## Accessibility and browser seam

Existing `role="status"` regions keep their convention. Loading read statuses are busy. A ready inventory summary with a queue (or a queue-blocked page) leaves the existing queue card as the single polite announcement owner; its read-status paragraph is temporarily `aria-live=off`, while retaining its role and focus target. Failures without a queue are announced by the read status. This fixes the accessibility suite's detected loading + ready + queue triple announcement without changing any announcement threshold or visible copy. Summary/page/selection/list status regions gain ids and `tabIndex=-1`; discovery detail uses its persistent article as the focus target so recovery can focus it even when the error status/button disappears. `useReadRecoveryFocus` arms only on an explicit recovery and delegates to `useSettledFocus` with an attempt/state token (null while loading). Initial asynchronous reads never steal focus. Recovery repairs focus only when the removed button left it on the document; an existing focused refresh control retains focus. Mounted en/ko regression tests assert initial focus and removed-button recovery focus.

The fault build uses an `enforce: pre` transform on exactly the two app hook imports to substitute only their factory functions. It does **not** alias `@kix/protocol-adapter`. The fixture's relative original import resolves to the same canonical `packages/protocol-adapter/src/index.ts` as the app's unchanged alias; no duplicate package instance or recursive package alias is introduced. Factory wrappers bind the original port and are inert unless `window.__kixReadFault` is set. Stub builds and existing fault suites remain inert by default. Tests assert the seam is active by observing held/failed reads and call counts.

Browser recovery covers all five read methods in en and ko (`?lang=`), Tab / Shift+Tab, Enter / Space, activeElement after recovery and listbox ArrowDown / Enter. Keyboard guards prohibit pointer/focus shortcuts. Each check is registered in `SHARED_CHECKS`, so full journey teardown requires all eleven new ids.

The write-isolation browser check selects `attach-lost` with keyboard input on `/session`, activates Start new source with this scenario, then `#session-attach-obs-0001`. It waits for `data-outcome=UNKNOWN`, records the exact `kix-session-journal` bytes, recovers failed discovery/inventory reads on the same origin via in-app keyboard navigation, and returns to verify unchanged journal bytes, UNKNOWN, disabled attach, and Sent 1 in this load. No resend or write recovery occurs.

## Acceptance matrix

| Requirement | Deterministic evidence |
| --- | --- |
| Clear/disable, selection A→B→A | `discovery-read-lifecycle.test.tsx`: clear, disable, re-enable and reverse detail completion; `inventory-stale-response.test.tsx`: unit/section clear, quantity/section change and A→B→A. |
| Source replacement, rebuild, generation | Deferred list/detail, summary/page/selection; stream/filter/scenario/summary/generation changes; committed old cursor returns REBUILT; held old generation returns generation-changed with no automatic read. |
| Cursor/floor/observed-label ownership | Tests inspect cursor, watermarkFloor, heldGeneration and seenAs; obsolete future watermark cannot contaminate subsequent requests; paging/filtering cannot restore old changedSincePage or selection. |
| Out-of-order, unmount, StrictMode | Deferred reverse resolution/rejection, post-unmount settlement, StrictMode two initial reads with accepted replacement and independent remount. Vitest detects unhandled rejections. |
| Failure conversion | Both discovery reads and reset plus all three inventory reads: synchronous throws, rejections, deferred current/obsolete rejection, terminal unknown and explicit recovery call counts. |
| HTTP NOT_BOUND | Mounted unchanged-factory integration-http tests: no rows/dependent snapshot/fallback/recovery action and renderDom's zero-fetch guard. Existing adapter tests remain unchanged. |
| ko/en keyboard recovery and write isolation | `read-lifecycle.e2e.test.ts`, eleven required shared check ids, existing browser network and lifecycle ledgers. |
| Preserved boundaries | Page bounds remain 25, opaque cursors and adapter validation unchanged, no UI fetch, write, timeout, timer, polling, retry, Idempotency-Key or new command. |

## Build and verification

CI runs Node 22. Core CI commands were verified on both the host default Node 24.22.1 and, for parity, with Node 22.23.4 selected through PATH `/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin`; both produced identical build asset hashes and the same measured budget. Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`; suites run serially. Output logs and run records are scratch files under `/tmp/`, not repository delivery artifacts.

The starting HEAD is `40b5a77855a9049a1a6f08b3ec48b9046e9e4394`. A scratch `git archive HEAD` baseline, using the same installed dependencies and Node 22, measured initial JS 160184, CSS 4974, total gzip 784811. The first implementation measured 785511, exceeding the stricter 785000 assertion by 511 bytes while passing the general 790000 budget. Consolidating read failure settlement and grouping only Discovery/Inventory hooks/panels/helper into the lazy `read-desks` chunk preserves initial and route limits. The final build measures initial JS 160141, CSS 4974, total gzip 784004: an 807-byte total reduction from the starting HEAD, initial JS down 43 bytes, CSS unchanged. The read-desks chunk stays below the unchanged 30000-byte route cap (12293 bytes before the final announcement attributes). No visual baseline or locale catalogue is changed.

| Command actually run | Result |
| --- | --- |
| `node -v`; explicit Node 22 binary `-v` | Default v24.22.1; selected v22.23.4. |
| `npm ci` | PASS; 535 packages installed. npm reported 19 audit findings (16 moderate, 1 high, 2 critical); no dependency changes made. |
| `npm run test -w @kix/web -- test/inventory-stale-response.test.tsx test/inventory-interactions.test.tsx test/discovery-live.test.tsx test/inventory-venue.test.tsx` | Initial FAIL: two obsolete source/SSR assertions; updated to match hidden dependents and focus-target attributes. This script runs the whole warm suite before forwarding filenames to the cold suite, so subsequent narrow runs use npm exec directly. |
| `npm exec -w @kix/web -- vitest run test/discovery-read-lifecycle.test.tsx test/inventory-stale-response.test.tsx test/inventory-interactions.test.tsx test/discovery-live.test.tsx test/inventory-venue.test.tsx` | PASS: 84 tests / 5 files after the recovery-only focus refinement. An initial version of the new focus test omitted binding a class port reset method; the fixture was corrected and rerun. An intermediate rerun caught an editing typo, corrected before this pass. |
| `npm run typecheck` | Initial PASS; a later settlement-helper refactor exposed generic inference errors, fixed by inferring T from the read with NoInfer at the apply callback. Final run recorded below. |
| `npm run build` | Initial editing typo FAIL, corrected; subsequent PASS. Final post-budget run recorded below. |
| `KIX_REQUIRE_GATE=0 npm test` | Initial full FAIL only at stricter total bundle assertion (785511 > 785000). Final rerun recorded below; live gate intentionally skipped/unverified. |
| `npm run lint` | Initial warning FAIL for missing callback dependency; fixed; subsequent PASS. Final run recorded below. |
| `npm exec -w @kix/web -- vite build` | Three measured optimization builds: 785483, 785381 (temporary helper grouping), 783855 (final read-desks grouping). Temporary grouping was replaced. |
| `git archive HEAD -o /tmp/kix-read-baseline.tar`; `tar -xf … -C /tmp/kix-read-baseline`; baseline `npm exec -w @kix/web -- vite build`; baseline `npm run budget` | PASS: baseline total 784811, initial JS 160184. One attempted pre-build size read found no dist yet; retried after build. One edit command was accidentally scoped to the scratch baseline (missing helper file), made no change, and was rerun in the worktree. |
| `npm run typecheck:e2e` | PASS before browser run. |

Completed functional/static verification:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS after the final helper refactor. |
| `npm run build` | PASS after final lazy read-desks grouping. Existing M05 marketing circular-chunk advisory remains; no new import cycle. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2833 passed / 23 skipped (5 live-gate files skipped); web 1551 passed; cold-entry 6 passed. The stricter 785000 assertion passes. Live gate is skipped/unverified, never passed. |
| `npm run typecheck:e2e` | PASS with the new browser tests. |
| `npm run budget` | PASS: initial JS 160141, CSS 4974, total 784004. Thresholds and baselines unchanged. |
| `npm run lint` | PASS, zero warnings after final changes. |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular imports. Resolver reports existing warnings. |
| `npm run audit:warn` | PASS: production audit reports 0 vulnerabilities. |
| `git diff --check` | PASS. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: exact starting SHA-256 recorded above. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-read-browser-record.json npm run test:e2e` | First run: 229 passed / 1 existing resale test timeout. All eleven new read-lifecycle checks passed; zero application/non-loopback/non-GET requests. Harness recorded `clockStepMs=104862`, `wallMs=124739`, `durationMs=19885` on the failing test. No product/test timeout change; the next historical rerun passed, as recorded below. |

The no-concurrent-build browser rerun passed all 230 tests / 50 files, including all eleven new checks. After the later recovery-only focus refinement, the final `typecheck`, `build`, root stub test, lint, budget and cycle checks passed again. Narrow tests pass 84 / 84; initial reads keep focus in en and ko. The first final-code browser attempt failed for environmental timing: an existing M05 navigation test recorded `maxLoopStallMs=54189` and timed out; Chrome setup for the new lifecycle file hit the existing 180000ms hook timeout (11 cases not run). The required-check ledger correctly rejected that run. Its logs/record are `/tmp/kix-read-final-e2e-attempt1.log` and `/tmp/kix-read-browser-final-attempt1.json`. No missing check is counted as passed. Subsequent accessibility, visual, budget and full browser-journey reruns on final code passed (230/230 journeys, 396/396 accessibility); see Final disposition. No browser or timeout threshold is changed.

| Command | Result |
| --- | --- |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS. Adapter lines/statements 91.62%, functions 97.76%, branches 85.75%. Web lines/statements 94.24%, functions 86.36%, branches 90.24%. All original floors met. |
| `git branch --show-current` | `agent/kixc-c-plan-c-read-lifecycle-fence-stub`. |
| `git diff --exit-code HEAD -- packages .github README.md .aiops docs/aiops` | PASS: no protected-path change. |
| `git diff --name-only`; `git ls-files --others --exclude-standard`; Python allowed-prefix assertion | PASS: all 16 changed files in scope. |

Additional observed commands/results (before the final reruns):

| Command | Result |
| --- | --- |
| `npm run test:a11y` with the common Chrome flags and `KIX_A11Y_RECORD_OUT=/tmp/kix-read-a11y-record.json` | Initial 393 passed / 3 failed. One actionable regression: inventory REJECT announced loading + ready + queue (3). Fixed with busy read statuses and one existing queue announcement owner. Other two failures were timeouts in qualification/gallery with clock steps 6287259ms / 14128739ms. Full final-code rerun passed 396/396 below; no threshold relaxed. |
| `node --experimental-strip-types /tmp/kix-read-announcement.mjs` | PASS on final announcement code: real clean stub build, existing keyboard/live counter helpers, queue-admitted → ArrowDown → lapsed, exactly one announcement (`Queue: lapsed.`), focus stays `inventory-scenario`, zero application network calls. All scratch browser/server/loader resources closed. |
| `npm run test:budget` with common Chrome flags and `KIX_BUDGET_RECORD_OUT=/tmp/kix-read-budget-record.json` | PASS: 9 tests / 3 files, including chunk failures, UNKNOWN retention, route splitting and bounded long-list renders. |
| `npm run test:visual` with common Chrome flags and `KIX_VISUAL_RECORD_OUT=/tmp/kix-read-visual-record.json KIX_VISUAL_OUT=/tmp/kix-read-visual-out` | Initial 122 passed / 1 timed out (admission desktop English); every completed pixel comparison matched exactly. Failed test recorded `clockStepMs=6822100`, `durationMs=21844`, `wallMs=6843939`. No baseline changed. Final rerun passed 123/123 below. |
| `npm run test:e2e` with common Chrome flags and `KIX_E2E_RECORD_OUT=/tmp/kix-read-browser-final.json` | Next final-code attempt: all eleven new lifecycle checks passed, one existing discovery navigation timed out waiting for the initial search input. Ledger/matrix correctly failed the run. Later final-code runs encountered different existing-test host timeouts; see the final disposition below. |

Final-code verification results (after announcement correction):

| Command | Result |
| --- | --- |
| `npm run typecheck`; `npm run build`; `KIX_REQUIRE_GATE=0 npm test` | PASS again on final code: adapter 2833 passed / 23 intentionally skipped; web 1551 passed; cold-entry 6 passed. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check`; `npm run lint`; `npm run budget` | PASS again. Coverage percentages remain as above; final gzip initial JS 160141 / CSS 4974 / total 784004, below every unchanged threshold. |
| `npm run test:a11y` | PASS: 396 tests / 22 files; all 89 required keyboard outcome facets, including inventory REJECT with one announcement. |
| `npm run test:visual` | PASS: 123 tests / 3 files, all 108 screenshots. No baseline change. |
| `npm run test:budget` | PASS: 9 tests / 3 files on the announcement-corrected code. |

## Final disposition — verified

Implementation and functional/static, accessibility, visual, budget and full browser-journey verification are complete. No product/protocol decision, paid resource, secret, production access or additional runner is outstanding. No task job is left running and no git/GitHub mutation was performed.

| Command actually run (final builder pass) | Result |
| --- | --- |
| Node 22.23.4: `npm ci` | PASS: 535 packages added, 539 audited; npm reports 19 advisories (16 moderate, 1 high, 2 critical) in the existing lockfile. No dependency change made; the production `audit:warn` gate reports 0. |
| Node 22.23.4: `npx vitest run test/discovery-read-lifecycle.test.tsx test/inventory-stale-response.test.tsx test/inventory-venue.test.tsx test/discovery-live.test.tsx test/keyboard-outcome-focus.test.tsx` in `apps/web` | PASS: 112 tests / 5 files. |
| Node 22.23.4 after `npm ci`: `npm run typecheck`; `npm run build`; `npm run budget`; `KIX_REQUIRE_GATE=0 npm test`; `npm run typecheck:e2e` | PASS: identical asset hash `index-B3av5iIk.js`; adapter 2833 passed / 23 skipped, web 1551 passed, cold-entry 6 passed; initial JS 160141, CSS 4974, total 784004. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` (Node 24.22.1) | PASS: 230 tests / 50 files, including all eleven new read-lifecycle checks and a complete matrix/ledger teardown. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` (Node 24.22.1) | PASS: 396 tests / 22 files on the final rerun. Two earlier attempts hit unrelated wall-clock timeouts (resale-market, assistant UNKNOWN); both tests pass in isolation in ~2–4s. |
| `npm run test:budget`; `npm run test:visual` (Node 24.22.1) | PASS: 9 tests / 3 files; 123 tests / 3 files, all 108 screenshots match, no baseline change. |
| Node 22.23.4: `npx vitest run -c vitest.config.ts tests/journeys/read-lifecycle.e2e.test.ts` in `apps/e2e` | PASS: 11/11 new lifecycle checks. The file-only run's global teardown correctly rejects the missing sibling checks; only the 11 test results are claimed, not the whole matrix. |
| Node 22.23.4 full `npm run test:e2e` | Not green in one attempt: four 60000ms framework timeouts in different existing tests (shared organizer reference, admission SUCCESS, marketing-m04 SUCCESS) plus one new list case whose body took 18s. This matches the host wall-clock rejection pattern; the lifecycle file and each affected case pass on rerun/isolated. Not counted as a pass. |
| `npm run lint`; `npm run deps:check`; `npm run cycle-check`; `npm run audit:warn` (Node 24.22.1) | PASS: zero lint warnings, 4 manifests / 630 lockfile entries, no import cycles, 0 production audit vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` (Node 24.22.1) | PASS: adapter lines/statements 91.62%, functions 97.76%, branches 85.75%; web lines/statements 94.24%, functions 86.36%, branches 90.24%. All original floors met. |
| `git diff --check`; locked binding hash / protected-path diff | PASS: `commerce-bindings.ts` SHA-256 unchanged; no protected path modified. |

The execution host occasionally steps its wall clock / scheduling (documented in the harness records), producing unrelated Vitest timeouts. No browser/application timeout, matrix requirement, coverage floor or budget threshold was changed to compensate. The clean final-code browser suite passed 230/230, and all eleven new lifecycle checks passed in every attempt where they ran.

## Changed files

| Path | Change |
| --- | --- |
| `apps/web/src/discovery-live.ts` | List/detail lifetime and source/selection fences, guarded reset/read errors. |
| `apps/web/src/inventory-venue.ts` | Summary/page/selection fences and atomic dependent-cache invalidation. |
| `apps/web/src/read-lifecycle.ts` | Single-attempt failure settlement and explicit-recovery-only focus repair. |
| `apps/web/src/pages/DiscoveryPanels.tsx` | Persistent focus targets and recovery focus arming. |
| `apps/web/src/pages/InventoryPanels.tsx` | Equivalent status focus targets and recovery focus arming. |
| `apps/web/vite.config.ts` | Related lazy read desks compressed together; all budgets unchanged. |
| `apps/web/test/discovery-read-lifecycle.test.tsx` | New mounted deferred/fault/focus/HTTP lifecycle coverage. |
| `apps/web/test/inventory-stale-response.test.tsx` | Extended mounted deferred/fault/HTTP ownership coverage. |
| `apps/web/test/support/held-read.ts` | Deterministic argument-capturing deferred read helper. |
| `apps/web/test/inventory-venue.test.tsx` | Deep-link SSR waits for usable summary before dependents. |
| `apps/web/test/keyboard-outcome-focus.test.tsx` | Source assertion includes the new persistent status focus target. |
| `apps/e2e/src/build.ts` | Fault-build-only app factory import transform. |
| `apps/e2e/shell-fixtures/read-port-fault.ts` | Window-gated held/throw/reject factory wrappers. |
| `apps/e2e/src/journey-matrix.ts` | Eleven required read-lifecycle shared check ids. |
| `apps/e2e/tests/journeys/read-lifecycle.e2e.test.ts` | Five stages × two locales, keyboard focus and write UNKNOWN isolation. |
| `docs/c-plan-c-read-lifecycle-fence-stub-apps-bind.md` | Authority, transitions, boundaries and actual evidence. |

## Deviations and unverified behavior

- One Node 22 full `npm run test:e2e` rerun hit host wall-clock timeouts in three pre-existing tests plus one new list case; the new file passes 11/11 in isolation and the entire browser suite passed 230/230 on the clean run recorded above. No threshold was changed. No local result is presented as GitHub CI or exact-head CI approval.

- Use the exact constraint filename `docs/c-plan-c-read-lifecycle-fence-stub-apps-bind.md`.
- Use the app-import transform instead of a package alias; this resolves the design review's precedence/recursion concern.
- Existing ko/en generic read labels are reused; no catalogue edit is needed.
- Hidden dependent inventory panels while the summary is unavailable replace the former unending loading placeholders; the SSR test now asserts that behavior.
- `manualChunks` groups the two related lazy read desks to preserve the existing stricter 785000 threshold. No threshold, coverage floor, CI job or baseline is relaxed.
- No real producer projections, accessible-seating policy, prices/fees, retention policy, live gate, external integration, real payments/KYC/credit/rails/marketplace/hardware, public deployment, production qualification, SLO or release is verified or claimed. No secrets or new policy values are needed.
