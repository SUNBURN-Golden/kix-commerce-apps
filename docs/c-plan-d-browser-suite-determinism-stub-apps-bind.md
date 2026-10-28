# Browser suite determinism binding

`contract_change=NO`. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

Scope: `c-plan-d-browser-suite-determinism-stub` only. Changes are confined to `apps/e2e/**` and this document. The app, bindings, protocol pins, CI, aiops files, four suite configs, a11y/visual matrices and visual baselines are unchanged. Retries remain zero; test and hook timeouts are byte-identical. Matrix-completeness teardown remains mandatory, including on narrow runs. No warm-up was added, so budget measurements still include cold loads.

## Implementation

All four output records now contain:

- `timing.tests`: file, full test name, final status and integer duration from the locked Vitest 3.2.7 `project.vitest.state.getTestModules()` / `children.allTests()` / `diagnostic()` API. This includes non-browser and raw-session tests, and final statuses include teardown assertions. Missing runner duration is `null` and fails diagnostics. The nearest-rank p50/p95 include passed and failed tests with a duration; skipped tests are excluded.
- Hook measurements for browser tests: wall time, monotonic comparison (`clockStepMs`), largest event-loop stall, process CPU time and Linux memory pressure. Unmeasured fields are `null`, never invented zeros. A whole-run clock watch samples every 250 ms, including build/setup. `failed.withHostEvent` means a >=1s wall step or event-loop stall **overlapped** a failure; it does not by itself prove the event caused it.
- `lifecycle.tests`: test/file attribution, creation/closure deltas, pre-cleanup page/context leaks, post-cleanup survivors, pending Playwright API names, page/context route-handler counts, unreleased held gates and cleanup errors. `lifecycle.files` retains session totals and pending work before file cleanup. Aggregate counts remain available for machine checks. Pending work in failed tests is retained too.

Ownership: the shared first context and pages opened before tests (the visual helper) belong to the file. Pages and extra contexts created during a test belong to that test. Context creation and close events are tracked even when both happen between snapshots, including `browser.newPage()`'s implicit context. Raw sessions are counted; the external-block guard also records test attribution explicitly. Deliberate leak self-tests use private sessions excluded from app-run totals.

Before cleanup the harness snapshots outstanding API calls and page/context route handlers, releases its held gates, and reads failed pages' application-network counters. It closes leaks, removes test-owned routes and resets offline state; the permanent loopback guard remains installed. Every extra context receives the same guard and counter. Cleanup attempts have bounded diagnostic deadlines, without changing any suite/test/hook timeout. Leftover pages/contexts fail the test after cleanup; survivors, pending work and cleanup errors also fail global teardown. Browser closure and diagnostic emission use `finally`; setup/build failures emit records and attempt every cleanup operation. Visual records emit even without a first screenshot, with `unavailable` render metadata.

Playwright API tracking uses the pinned 1.58.2 client's instrumentation listener. An unavailable listener fails explicitly. Route tracking wraps both page and context handlers. No new git-id keys were introduced, so `redact.ts` / `GIT_ID_KEYS` remain unchanged; numeric measurements are rounded before serialization.

Confirmed harness defects fixed:

1. The CSP/untrusted-render test never closed its page, even on success. It now closes it. Central per-test cleanup prevents any failed test's stranded pages from contaminating subsequent tests.
2. The budget chunk-recovery `Promise.race` left the losing locator wait running. One condition-based outcome wait now replaces the two branches; all outcome assertions remain.
3. Held page routes in a11y and budget could keep promises unresolved after assertion failure. Explicit tracked gates are released during cleanup. Removing a route alone does not release a held promise.
4. The JavaScript-disabled context closed only after successful assertions. It now closes in `finally` and receives the shared network guard.
5. `desk.poll` used a wall-clock deadline. It now uses `performance.now()`, keeping its 5s default and 25ms condition-poll interval.

Config-pin tests assert literal and parsed retry/test/hook values and reject script/workflow/test overrides. Lifecycle tests prove page/context leak detection, transient-context counts, held page/context routes, navigation and losing-wait detection, offline reset and preserved loopback guards. Record tests cover redaction and unavailable metadata. Four setup-failure tests exercise actual setup/teardown paths and record emission before any browser opens.

## Reproduction and failure evidence

The inherited untouched baseline is preserved under `/tmp/kix-det-untouched-di2s0wmb` at `0990caf6b1d0f7190a2707618d711f68848a1094`: 17 completed runs (e2e x5; a11y, visual and budget x4), logs, records, exit statuses and an independent once-per-second wall/monotonic monitor. An interrupted fifth a11y run has no result and is not counted. This falls short of the design's five completed baseline runs **per** suite; the interrupted runs have not been relabelled as passes.

Instrumentation-only/host-contention evidence is preserved separately at `/tmp/kix-det-instrumentation-stress-gufgcnca`, with its source snapshot/manifest and clock monitor. It ran alongside an untouched suite: these are separate static servers, so this tests host contention, not contention on a shared server. Debugging evidence under `/tmp/det/instr`, `/tmp/det/final`, `/tmp/det/final-clean`, `/tmp/det/rerun` is retained. Earlier implementations differ from the final source; those records are investigation evidence, not the final streak.

### Untouched baseline failures

| Run | Test | Observation | Root cause and disposition |
|---|---|---|---|
| a11y 1 | axe box-office desktop | 120s test limit, displayed 180168ms | UNDETERMINED: elapsed time exceeded the limit; no per-test stall measurement existed |
| a11y 1 | axe organizer-workspace narrow | 30s locator wait, displayed 33258ms | UNDETERMINED |
| a11y 3 | Korean locale 320px reflow | 30s locator wait, displayed 55725ms | UNDETERMINED |
| a11y 3 | forms /marketing/m03 coupon-code | 120s limit, displayed 15006ms | A +251104ms host wall step was recorded in the run; installed runner's wall-clock guard explains the signature. Individual test overlap was not measured |
| e2e 4 | assistant one-attempt | 60s limit, displayed 9471ms | A +871868ms host wall step was recorded in the run; same runner mechanism. Individual test overlap was not measured |
| e2e 4 | permissions REJECT | 15s click wait, displayed 59994ms | UNDETERMINED |
| a11y 4 | gallery en/narrow axe | 30s locator wait, displayed 81221ms | UNDETERMINED |
| visual 4 | marketing-m05.phone.ko.light | 60s limit, displayed 72883ms | UNDETERMINED |

The untouched monitor also recorded a +535440ms step. In installed `node_modules/@vitest/runner/dist/chunk-hooks.js`, line 1837 binds `const now = Date.now`; `withTimeout` uses `now() - startTime >= timeout` after completion. Displayed duration uses `performance.now` (line 1362). Thus a wall step can fail a short test. The repository does not patch Vitest, the host clock or timeout limits.

### Instrumented failures and harness findings

| Evidence | Observation | Verdict / fix |
|---|---|---|
| instrumentation-only e2e | CSP page left open after a passing test | CONFIRMED leak; fixed page close and added central leak failure/cleanup |
| instrumentation-only budget | two pending locator waits after recovery race | CONFIRMED losing branches; replaced race with one outcome wait |
| instrumentation-only e2e | notifications reload `load` timeout, 17856ms; clockStep 0 | UNDETERMINED initial trigger; cleanup now contains the leaked page |
| instrumentation-only a11y | optional-filter form wait, 65120ms; clockStep 0 | UNDETERMINED initial trigger; cleanup now contains the leaked page |
| instrumentation-only external guard | counter read after navigation destroyed document | Instrumentation defect, corrected by snapshot/cleanup handling; retained as a development failure |
| instrumented e2e a1 | credit-origination: ~161s event-loop stall | CONFIRMED stall overlapped failure; exact host/process scheduling cause UNDETERMINED |
| instrumented a11y a2 | 14651ms displayed vs 120s limit, +625573ms step | CONFIRMED wall step overlapping test; runner guard implicated |
| instrumented budget p3 | 120018ms duration, 105974ms stall, 572ms CPU | CONFIRMED long low-CPU stall; exact suspension/scheduling cause UNDETERMINED |
| final-clean a11y 1 | gallery: 179280ms duration, 164713ms stall, 166756ms CPU | CONFIRMED stalled event loop and high process CPU; precise work/cause UNDETERMINED |
| final-clean a11y 2 | async empty state: 383508ms duration, 382185ms stall, 215ms CPU | CONFIRMED long low-CPU stall; exact host cause UNDETERMINED |
| final-clean a11y 3 | axe marketing-m02: 373434ms duration, 372907ms stall, 372979ms CPU | CONFIRMED high-CPU stalled event loop; precise work/cause UNDETERMINED |
| final-clean a11y 3 | handoff keyboard: 16076ms displayed, +147346ms step | CONFIRMED overlapping wall step |
| final-clean visual 2 | marketing-m05 desktop: 256461ms duration, 255524ms stall, 160ms CPU | CONFIRMED low-CPU stall; exact host cause UNDETERMINED |

Earlier contended a11y attempt-11 also recorded a 168749ms low-CPU stall and an 82396ms wall step. It overlapped a leftover run loop; it is excluded from consecutive-pass evidence. Historical async-state, identity, booking, finance, session-quota, marketing, offline, axe and keyboard flakes without correlated per-test records remain **UNDETERMINED** individually.

### Candidate verdicts

| Candidate | Finding |
|---|---|
| Leaked pages/contexts | CONFIRMED harness defects, fixed. Not established as the initial cause of every historical timeout |
| Fixed sleeps | No fixed sleep in app-driving tests; condition-poll interval retained. New clock self-tests deliberately exercise timer/stall behavior |
| URL-backed input/router race | Not reproduced; existing tests await URL/DOM conditions. No app change justified |
| Lazy-chunk cold load | Not established as cause. No warm-up or cache alteration added |
| Shared static server | Not established as cause. Debug budget server measured 967 requests, peak 1, p95 1ms, max 5ms; this is limited evidence, not proof under every load |
| Host wall steps | CONFIRMED in monitor and instrumented records; runner mechanism verified. Detection added; no prohibited workaround |
| Process/event-loop stalls | CONFIRMED overlap with failures. Suspension, contention, GC and CPU work are not interchangeable diagnoses; exact trigger remains UNDETERMINED where not measured |

## Final verification

`apps/e2e/scripts/determinism-runs.mjs` runs suites sequentially, explicitly sets `KIX_VISUAL_UPDATE=0`, snapshots source and hashes, records exits, and fails on ledger/lifecycle defects, removed test or matrix identities, count disagreement or protected-path changes. All failed attempts and narrow-run logs are preserved; no final record path is reused.

### Final sequence (`/tmp/kix-det-candidate-nH6e9g`, source snapshot in `source/`, `source.json` hashes, `source.patch`)

One earlier final attempt (`/tmp/kix-det-candidate-LyTs8M`, retained) found a defect in the new instrumentation itself: `endTest` reassigned the ownership scope before computing post-cleanup survivors, so a context that survived cleanup could never be counted. The harness self-test caught it (189 of 190 tests passed; only `harness.lifecycle-leak` failed). `lifecycle.ts` now captures the test scope before the reset, the self-test passes, and the sequence below ran on the corrected source with no further source changes.

Three consecutive full runs of every suite, zero failures, `KIX_VISUAL_UPDATE=0` (compare mode), loopback only:

| Attempt | Suite | Tests | p95 test duration (ms) | Ledger | Lifecycle |
|---|---|---|---|---|---|
| 1 | e2e | 190 | 2460 | 0/0/0 | clean |
| 1 | a11y | 276 | 1376 | 0/0/0 | clean |
| 1 | visual | 109 | 1058 | 0/0/0 | clean |
| 1 | budget | 9 | 2917 | 0/0/0 | clean |
| 2 | e2e | 190 | 2468 | 0/0/0 | clean |
| 2 | a11y | 276 | 1322 | 0/0/0 | clean |
| 2 | visual | 109 | 1156 | 0/0/0 | clean |
| 2 | budget | 9 | 3665 | 0/0/0 | clean |
| 3 | e2e | 190 | 2561 | 0/0/0 | clean |
| 3 | a11y | 276 | 1388 | 0/0/0 | clean |
| 3 | visual | 109 | 1182 | 0/0/0 | clean |
| 3 | budget | 9 | 2887 | 0/0/0 | clean |

Reported p95s per suite (max across the three runs): e2e 2561 ms, a11y 1388 ms, visual 1182 ms, budget 3665 ms. Every record's ledger sums to zero non-loopback, zero non-GET and zero application network calls, so the run-record check `verify()` in `determinism-runs.mjs` asserted it rather than displaying it. The whole-run clock watches saw no wall step (max 1 ms in every run) and event-loop stalls of up to 2.1 s outside tests, during build and launch; per-test hook measurements saw no stall above 89 ms and no step above 1 ms, and `timing.failed` is all zeros. The earlier evidence above shows the same instrumentation does catch host events when they overlap a test.

Counts: e2e 177 -> 190 (13 added harness/record/failure-path tests); a11y 276, visual 109, budget 9 unchanged. Journey check ids 165 -> 170, a11y 266 ids / 38 screens unchanged, visual 94 shots unchanged, visual baselines byte-identical. The runner checked baseline test identities against the saved instrumentation baseline, matrix identities against the untouched records, stable identities across the final runs, and empty diffs on `packages/protocol-adapter/src/commerce-bindings.ts`, `.aiops`, `docs/aiops`, `.github`, the four suite configs, `apps/e2e/visual-baselines`, `a11y-matrix.ts` and `visual-matrix.ts`, plus the journey-matrix identity prefix in `journey-matrix.ts`.

Hosted candidate CI cannot run before supervisor commit/push, which this builder is prohibited from doing. Local CI equivalents are reported separately; no claim of hosted CI green or live-gate passage is made. The token-dependent live-gate job is unverified; `KIX_REQUIRE_GATE=0` deliberately skips 23 tests.
