# Text spacing observations in the local stub

Node: `c-plan-c-text-spacing-stub`; contract_change=NO. This extends the existing accessibility browser observations. No protocol contract, pin, runtime transport or product policy is consumed or changed.

“M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce”. `commerce-bindings.ts` stays byte-identical. `placeHold` stays not-bound with considered action `reserve_listing`; the journey never composes or sends `capture` or `settle_capture`. README fail-closed boundaries remain in force.

## Scope and matrix

The structural `SCREENS` inventory is parity-checked against `ROUTES` including ids, patterns and concrete samples. A separate assertion fixes the denominator at **40 production routes × 2 locales = 80** default observations. Hidden booking and resale-product routes are included. `/dev/gallery` is excluded by construction: it is not in `ROUTES`.

| State | Required check ids | Count |
| --- | --- | --- |
| Default | `a11y.spacing.<screenId>.ko`, `a11y.spacing.<screenId>.en` | 80 |
| Discovery alias `/discovery/row_1` | `a11y.spacing.discovery-alias.<locale>` | 2, outside production denominator |
| Narrow navigation open | `a11y.spacing.menu-open.<locale>` | 2 |
| Booking input validation | `a11y.spacing.booking-validation.<locale>` | 2 |
| Session attach lost / UNKNOWN | `a11y.spacing.session-unknown.<locale>` | 2 |
| Sensitivity fixture and clean twin | `a11y.spacing.fixture`; negative observation `a11y.spacing.fixture.negative` | 1 required check, 2 observation rows |

A fresh navigation explicitly requests `?lang=ko` or `?lang=en`, asserts the document language, active language control and localized visible Menu label, waits for real main content, fonts and two layout frames. One test/page per production screen makes both locale navigations. Teardown checks both required pass markers and complete, unique observation rows. Spacing findings affect each screen's outcome; default and representative-state traces are retained separately.

## Probe algorithm

At 320×568 CSS pixels inject only:

```css
* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-block-end: 2em !important; }
```

Paragraph spacing applies only to `p` elements. No overflow, width, visibility or other corrective declaration is injected. The resulting application geometry is measured. Computed declarations are checked on rendered elements, so missing or ineffective injection fails. Chrome reports `normal` for native select line-height even with this declaration; the authored override remains required, select letter/word spacing is checked, and native value height is measured separately. This selector-specific browser limitation is not extended to ordinary text or other controls.

Text ranges are checked against each hidden/clip ancestor's client box, on both axes, including hidden ancestors inside supported scroll regions. Ellipsis and line-clamp containers also use scroll/client dimensions. A 1 CSS pixel allowance covers rounding, never missing lines. Below-fold text remains in scope. Non-rendered content, scripts, styles and native option popups are excluded. The selector-keyed `.skip:not(:focus)` exception is intentional: the skip link translates offscreen until focused and is measured during the keyboard walk when visible. Native controls are counted separately and receive canvas glyph-height, internal height/overflow and focused geometry inspection. Text/search/tel/url inputs are inspected with ArrowRight after Tab selects their value: the caret must reach the value end and an overflowing editor must scroll, without changing/submitting the value; native text rendering is not inferred from ordinary DOM text ranges.

Expected controls include rendered enabled `button`, `a[href]`, non-hidden `input`, `select`, `textarea` and `[tabindex]` elements with nonnegative tabIndex, including focusable aria-disabled controls. Native disabled controls and tabindex -1 are outside the sequential Tab denominator. The existing `tabWalkProblems` and its unchanged 400-stop bound drive the walk. Every expected control must be visited. After each Tab, scroll into view, wait two layout frames and test its viewport box plus center and four inset hit-test points. Multiline inline links use their actual line fragments, not the non-clickable gaps in their bounding union. Structural focus containers (lists/regions, not atomic buttons/fields/links) use a visible leading band up to 44px; their content can exceed the viewport and is independently checked by text geometry, descendant controls and scrolling. Partial occlusion at any point is a finding. Closed disclosure contents are not rendered; open navigation is measured separately, with no blanket overlay exclusion.

After spacing, discover all overflowing `auto`/`scroll` elements. Each must have a keyboard-reachable region or descendant, and actual arrow-key movement must change a scroll offset on each overflowing axis. Up to twelve arrows accommodate a roving list whose initial options fit; this does not change the existing Tab bound. Per-focus frame waits supplement the batched text scan, avoiding transient hit-test readings before layout settles. Offscreen text in a supported scroller is readable by scrolling; hidden clipping within it still fails. Document-width failures are also recorded as FINDING (`spacing.document-overflow`), rather than only failing an assertion. Local failures use `spacing.override-missing`, `spacing.text-clipped`, `spacing.control-clipped`, `spacing.control-obscured`, `spacing.control-unreachable` and `spacing.scroll-unreachable`.

Records contain route id, fixed path, locale, state, counts and problem codes with structural ordinal selectors only. They contain no DOM text, input values or receipts. Record tests cover structural-target enforcement, sensitive-data scans and refusal of every true claim.

## Fixture sensitivity and representative states

The self-contained fixture uses `page.setContent()` on a normal suite page, without another origin or network. A clipped label, clipped validation/status paragraph, covered button and unreachable scroll box must produce findings while document width still passes. The repaired twin must be clean and its named, focusable scroll region must actually scroll with keys. Negative observations are retained separately and never added to `KNOWN_FINDINGS`.

Validation uses the fault build and `window.__kixFormDeferred.attempts`. Repeated invalid quantity submission must leave attempts at zero, move focus to the summary, preserve linked inline errors, permit keyboard correction, and remain readable under spacing. Session UNKNOWN uses shipped `attach-lost`, its existing visible in-process sent/blocked counters and guarded attach explanation. Repeated activation cannot increase the sent count; a read cannot resolve UNKNOWN. The receipts link stays keyboard reachable. The network ledger is an additional guard, not a dispatch counter.

## Findings, fixes and results

The failed observations remain in `/tmp/text-spacing-focused-1.json` through subsequent focused records, with their matching logs. Probe qualification corrected multiline link bounding-union false positives and separated large structural focus containers from atomic controls. No spacing defect was added to `KNOWN_FINDINGS`.

| Demonstrated observation before fix | Owning fix |
| --- | --- |
| Discovery `.discovery-scale` changes its active option without scrolling the fixed-height viewport | After a keyboard move renders, reveal the active option with `scrollIntoView(nearest)`; no default geometry change |
| Expanded English sticky `.discovery-nav` covers the center/inset points of controls (including origination, servicing, benefit, permissions and release) | Bound the sticky nav to 35vh with native scrolling; prove its links and scroll remain keyboard reachable |
| Korean open menu stretches `.nav-toggle` to about 1640px because the layout selector matches only English `aria-label="Surfaces"` | Use existing `.top > nav` structure in both locales; retain the translated accessible name |
| Korean merchant/finance `.discovery-row` implicit grid tracks extend beyond the 320px document | Reduce those owning tracks’ minimum content width with scoped `overflow-wrap:anywhere` (the initial explicit-track rule was consolidated to keep the existing CSS budget) |
| Notifications Korean heading paragraph creates document width 341px; session Korean explanatory token creates 387px; identity English context table creates 333px | Scoped `overflow-wrap:anywhere` for the finance header, session section and identity context table; no copy deletion or table hiding |

Final measurements and visual comparisons follow in the command ledger.

## Acceptance boundaries and safeguards

These are **synthetic headless Chrome browser observations**, not human acceptance or standards certification. `targetStandard: UNDETERMINED`; all five record claims remain false, user acceptance is PENDING, assistive technology is NOT_RUN and release is NOT_AUTHORIZED.

Real user stylesheets, screen readers, real-device/touch behavior, browser zoom and other browsers remain NOT_RUN. Native browser widget popups and assistive-technology announcements are not certified by geometry checks. Existing root-font and document-width checks remain in force.

Unchanged safeguards: `TOLERANCE` and masks in `visual-matrix.ts`; bundle caps (initial JS 290000, total 790000) and `apps/web/bundle-budget.json`; `KNOWN_FINDINGS`, `MAX_STOPS`, `VIEWPORTS`, `A11Y_BASELINE` and every existing check id. No CI edit, new dependency, npm script, gate bypass, protocol binding edit or pin movement. Hosted CI remains for the supervisor; local equivalents are evidence for this working tree only.

No contract/product STOP condition was encountered. The runner decision is now recorded: **KIX Commerce, 2026-11-09 14:10 KST, approved by JunTae — use GitHub Actions exact-head CI as the stable runner; accept only when exact-head CI, including e2e/a11y/visual, is fully green.** Preserve timeouts, assertions, retries, baselines, budgets and CI configuration. A reproducible CI failure is a normal review failure. The supervisor handles commits, pushes and the PR; this builder performs no Git/GitHub writes. Local results do not establish hosted CI acceptance. No hardware, paid service, credential or production runtime change is authorized.

| Acceptance item | Evidence/check |
| --- | --- |
| Required spacing, every production route in ko/en | Registry parity, locale assertions, computed-style checks and 80 mandatory recorded rows |
| Local clipping and obscured controls despite passing document width | Negative fixture's exact structural targets and problem codes; clean twin; missing-override control |
| Keyboard reachable controls and supported scrolling | Complete bounded Tab walk, focused hit tests and actual arrow-key scroll offsets |
| Readable validation, zero blocked dispatch | Fault-origin booking summary/linked errors, keyboard correction and `__kixFormDeferred.attempts === 0` |
| Readable UNKNOWN and fenced dispatch | Session `attach-lost`, persistent explanation, sent count stays one, blocked count three, receipts link reachable |
| Synthetic observation only | Record claim guards, redaction tests and UNDETERMINED/PENDING/NOT_RUN boundaries |
| Regression gates | Unchanged full local commands below; exact-head hosted CI remains a supervisor gate |

## Executed command ledger

The initial install/typecheck used the runner default Node 24.22.1. Node 22.23.4 was then installed as temporary tooling with `npm exec --yes --package=node@22 -- node -v`, and `npm exec --package=node@22 -- npm ci` repeated the install. Final verification uses `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH` and local `/usr/bin/google-chrome`, with `KIX_E2E_NO_SANDBOX=1` required by this runner. Final browser commands explicitly set `KIX_E2E_CHROME=/usr/bin/google-chrome`; focused runs auto-detected that same binary. Log files and JSON records in `/tmp/text-spacing-*` retain intermediate failures as well as final runs. No long job was detached or launched with shell `&`.

| Command actually executed (Node PATH prefix as above) | Result |
| --- | --- |
| `npm ci` | PASS on runner default; repeated successfully under Node 22 with `npm exec --package=node@22 -- npm ci` |
| `npm exec -w @kix/web -- vitest run test/route-registry.test.tsx test/discovery-page.test.tsx` | PASS: 28 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; Vite build 10.55s |
| `KIX_REQUIRE_GATE=0 npm test` | Final PASS: adapter 1981 passed / 23 skipped, web 1464 passed, cold entry 6 passed. Live gate NOT_RUN as requested. Initial class-based approach failed ten markup assertions/snapshots; final CSS uses existing header structure and restores those files unchanged. |
| `npm run typecheck:e2e` | Final PASS. One intermediate TS2339 on the style handle was fixed with its HTMLStyleElement type. |

### Retained focused iterations

All browser commands below used `KIX_E2E_NO_SANDBOX=1` and `KIX_A11Y_RECORD_OUT=/tmp/text-spacing-focused-N.json`; matching stdout/stderr logs are `/tmp/text-spacing-focused-N.log`. Filtered runs intentionally fail the full global completeness denominator and never substitute for the full suite.

| Run | Command | Test-body result |
| --- | --- | --- |
| 1, 2 | `npm run test:a11y -w @kix/e2e -- tests/a11y/text-spacing.a11y.test.ts` | 2 passed / 48 failed each; negative fixture already qualified, route hit tests and starting focus refined |
| 3 | same command | 31 passed / 19 failed |
| 4 | same command with `-t 'discovery:|platform:|credit-origination:|finance:|session-unknown|booking-validation|qualifies'` | 1 passed / 8 failed / 41 skipped; select UA computed-style exception and sticky navigation diagnosed |
| 5 | unfiltered spacing file command | 38 passed / 12 failed; actual menu stretching, sticky occlusion and document-width findings retained |
| 6 | unfiltered spacing file command | 44 passed / 6 failed; remaining wrapping defects isolated |
| 7 | same command with `-t 'merchant:|finance:|notifications:|identity:|session:|session-unknown|booking-validation|qualifies'` | 6 passed / 4 failed / 40 skipped; initial document widths confirmed before keyboard movement |
| 8 | unfiltered spacing file command | **50 passed**, 182.33s test bodies / 215.25s total; command exit 1 solely for omitted full-suite check ids |

The initial `npm run test:a11y -- --reporter=dot` was interrupted (exit 130) to switch to focused qualification; npm did not forward that reporter option. It is not counted as a passing run. A second narrow web command, `npm exec -w @kix/web -- vitest run test/i18n.test.tsx test/marketing-journey.test.tsx test/cross-surface-journeys.test.tsx test/component-gallery.test.tsx`, initially passed 144 tests and failed six snapshots; the final selector uses existing header structure, so the class and snapshot changes were removed; the complete stub rerun passes.

### Full commands and quality gates

| Command | Actual result |
| --- | --- |
| `KIX_A11Y_RECORD_OUT=/tmp/text-spacing-a11y-final.json npm run test:a11y` | PASS: 445 tests, 22 files, 775.23s; 89/89 existing keyboard outcome cells; zero ledger. Final guard/CSS rerun recorded below. |
| `npm run test:e2e` | Four full attempts encountered 3, 2, 1 and 2 timeouts respectively, in varying pre-existing tests. Failed JSON records retain host wall-clock jumps (up to 2547795ms) and loop stalls (up to about 25s); every measured failure overlaps a host event. No timeout or retry changes. Final verification remains required. |
| `npm run test -w @kix/e2e -- tests/lifecycle.e2e.test.ts tests/journeys/credit-origination.e2e.test.ts tests/journeys/mobile.e2e.test.ts` | All 15 bodies passed; filtered denominator correctly failed (not a full-suite pass) |
| `npm run budget` | Final PASS: initial JS 160165, CSS 4997, total gzip 784588 bytes. Initial CSS attempts 5026, 5010 and 5010 exceeded the existing 5000 cap; consolidated wrapping and redundant focus CSS instead of changing the cap. |
| `npm run test:budget` | PASS: 9 tests, 3 files; repeated on final CSS (see `/tmp/text-spacing-budget-current.log`) |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 123 tests, 107.37s. All committed comparisons match; no baseline update. |
| `npm run lint` | Final PASS; five non-null assertions were replaced with explicit guards/typed tuples |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors met; web lines/statements 93.85%, functions 84.89%, branches 90.21% |
| `npm run deps:check` | PASS |
| `npm run cycle-check` | PASS |
| `npm run audit:warn` | PASS; zero production vulnerabilities |
| `git diff --check` | PASS |
| `git diff --exit-code -- packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github/workflows/ci.yml apps/web/bundle-budget.json apps/e2e/src/visual-matrix.ts` | PASS: protected files, budgets, masks and tolerances unchanged |

### Design adjustments

The structural matrix stays outside the web runtime import graph and is exactly parity-checked in tests. Per-focus two-frame waits supplement the batched text scan to avoid transient hit-test results. Large structural focus containers use their visible leading band and separately proved scrolling; atomic controls retain full-fragment checks. Native select line-height has the documented Chrome exception. Paragraph spacing is the original plan’s `margin-block-end:2em` on `p` only. Native value height/end-of-editor checks and document-width FINDING records strengthen the planned observations.

The final CSS uses existing header structure instead of adding a translated-name-dependent selector or a new class. One duplicate discovery focus rule was removed: its outline and offset already come from the unchanged global `:focus-visible` declarations. Focus tests and visual comparison remain strict. No visual baseline, bundle cap or CI change.

### Earlier stopped-build verification (historical)

The final `KIX_A11Y_RECORD_OUT=/tmp/text-spacing-a11y-current.json npm run test:a11y` command in the first session exited 1: **442 passed / 3 timed out**, 1027.93s. A second builder session re-verified the unchanged tree under Node 22.23.4 and repeated six full browser runs: `test:a11y` exited 1 three times (68 failures dominated by one whole-browser death cascading into instant `context/browser closed` results; then 3 timeouts; then 1 timeout plus an 180000ms `beforeAll` browser-open hook timeout skipping 11 bodies), and `test:e2e` exited 1 three times (2, 2 and 1 timeouts). Every measured failure in every run overlaps a recorded host event (`withHostEvent` only; `withoutHostEvent: 0`): wall-clock steps up to 3,546,333ms (~59-minute host suspension), event-loop stalls up to 131s, and one browser process kill. The closest run lost a single test that used 18142ms / 708ms CPU inside a 410027ms host wall step.

The final styles and probe produced 90 spacing rows in each run, including all **80 production observations with zero spacing findings**. Fixture qualification passed with the harness network counter untouched; locale checks assert both document language and the visible translated Menu label. No clipping/occlusion, assertion or new axe finding caused any failure; the only failure class is environmental timeout on different tests each run.

No run replaces the earlier full PASS (445 tests, 775.23s) with a passing claim, and no partial ledger is merged. All records remain available (`/tmp/curr-a11y-full{,2,3}.{log,json}`, `/tmp/curr-e2e{,-2,-3}.{log,json}`, `/tmp/text-spacing-*`). These failures prompted the runner question answered by the 2026-11-09 owner ruling above; no outstanding decision file is needed. No timeouts/retries, clock shims, CI edits, merged filtered ledgers or acceptance claims were introduced.

Second-session commands under the same Node 22 PATH prefix: `npm ci` PASS; `npm run typecheck` PASS; `npm run build` PASS (7.72s); `KIX_REQUIRE_GATE=0 npm test` PASS twice (1981+1464+6); `npm run typecheck:e2e` PASS; filtered `tests/text-spacing.e2e.test.ts`+`tests/record.e2e.test.ts` 6/6 pass (teardown denominator failure expected on filtered runs); filtered spacing spec 49/50 then `receipts` alone 3/3 pass; `npm exec -w @kix/web -- vitest run test/route-registry.test.tsx test/discovery-page.test.tsx` 28/28 PASS; `npm run lint`, `npm run deps:check`, `npm run cycle-check`, `npm run audit:warn`, `git diff --check` and the protected-files diff all PASS; `npm run budget` PASS (initial JS 160165, CSS 4997, total 784588); `npm run test:budget` PASS (9/9); `KIX_REQUIRE_GATE=0 npm run coverage:check` PASS; `KIX_VISUAL_UPDATE=0 npm run test:visual` PASS (123/123, no baseline edits).

Final typecheck/e2e typecheck, stub tests, lint, coverage, dependencies, cycle check and audit all passed after the CSS consolidation. Visual comparison reports **108 MATCH shots** on `linux-d29b2e9b`, 123 tests total, and no baseline edits. Bundle limits remain unchanged, including initial CSS 5000 (actual 4997), initial JS 290000 (actual 160165), total gzip 790000 (actual 784588). The complete command results and failed observations are preserved; hosted CI has not been run by this builder.

## Resumed builder verification — 2026-11-10

Continued the existing draft on `agent/kixc-c-plan-c-text-spacing-stub`, based at `9de5eeee3c890c432db9a214f25453fefc4eef21`. Implementation, assertions and safeguards were preserved. This session updates the evidence document with the recorded runner ruling and fresh local results. All results refer to the uncommitted worktree, not a hosted exact-head CI run.

Commands used Node **22.23.4** via `export PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH`. Browser commands used `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Output is retained under `/tmp/node-spacing-*.log`; the full accessibility record is `/tmp/node-spacing-a11y.json`. Commands ran sequentially; no long job was launched in the background.

| Command actually run (environment above) | Result |
| --- | --- |
| `npm ci` | PASS; 535 packages installed. npm reported 14 dependency audit advisories; no lockfile or dependency change made. |
| `npm exec -w @kix/web -- vitest run test/route-registry.test.tsx test/discovery-page.test.tsx` | PASS: 28 tests, 2 files |
| `npm run test -w @kix/e2e -- tests/text-spacing.e2e.test.ts tests/record.e2e.test.ts` | 6/6 test bodies PASS; command exits 1 because the unchanged global teardown correctly rejects an incomplete journey matrix in a filtered run |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1981 passed / 23 live-gate tests skipped, web 1464 passed, cold entry 6 passed |
| `npm run typecheck:e2e` | PASS |
| `KIX_A11Y_RECORD_OUT=/tmp/node-spacing-a11y.json npm run test:a11y` | FAIL: 441 passed / 4 failed, 22 files, 719.11s. Gallery's browser closed during the ko/desktop load; the next three gallery bodies inherited the closed browser. Missing gallery keyboard/preferences checks correctly fail teardown. |
| `KIX_E2E_RECORD_OUT=/tmp/node-spacing-e2e.json npm run test:e2e` | PASS: 213 tests, 49 files, 385.97s |
| `npm run budget` | PASS: initial JS 160165, initial CSS 4997, total gzip 784588 bytes; all route limits unchanged |
| `npm run test:budget` | PASS: 9 tests, 3 files, 25.18s |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 123 tests, 3 files, 108.84s; 108 MATCH shots on `linux-d29b2e9b`, no baseline changes |
| `npm run lint` | PASS |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors met; web statements/lines 93.85%, functions 84.89%, branches 90.21% |
| `npm run deps:check` | PASS: 4 package manifests, 630 lockfile entries checked |
| `npm run cycle-check` | PASS: no circular imports |
| `npm run audit:warn` | PASS: zero production vulnerabilities (`npm audit --omit=dev`) |
| `DEBUG=pw:browser KIX_A11Y_RECORD_OUT=/tmp/node-spacing-a11y-rerun.json npm run test:a11y` | FAIL (exit 1). Gallery passed 7/7 (132.873s), keyboard outcomes passed 91/91 (199.420s), spacing passed 49/50 (177.430s) with M05 reporting a 120000ms timeout. The command ended without a final aggregate summary or the requested JSON record. Raw diagnostic log is retained at `/tmp/node-spacing-a11y-rerun.log`; no complete-run pass is claimed. |
| `git diff --check` | PASS |
| `git diff --exit-code -- packages/protocol-adapter/src/commerce-bindings.ts .aiops docs/aiops .github/workflows/ci.yml apps/web/bundle-budget.json apps/e2e/src/visual-matrix.ts` | PASS; locked binding also compared byte-for-byte with HEAD (sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`) |

The full accessibility run's spacing file passed **50/50 tests in 154.331s**, with all 80 production observations clean and 90 spacing rows including the intentional negative fixture. All 89 existing keyboard outcome cells passed. Network ledger: zero non-loopback, non-GET and app-network calls; all five claims false. Lifecycle: 23 browsers opened/closed, zero survivors, teardown leaks or cleanup errors. Unlike the earlier historical runs, this run's four gallery failures have **no recorded host event** (`withHostEvent: 0`, `withoutHostEvent: 4`; maximum clock step 1ms, loop stall 26ms). The cause of the browser closure is unestablished; it is not reported as a confirmed host interruption or a passing full suite.

The diagnostic rerun does not reproduce that gallery closure, but it also does not establish a passing full accessibility suite. Its M05 timeout is a separate failed observation; without an aggregate timing record its cause is unestablished. No records from different runs are combined. The implementation is ready for supervisor exact-head CI review under the recorded 2026-11-09 runner ruling; **full accessibility CI must be green before acceptance**. These local failures are disclosed review evidence, not a new unanswered owner decision. No code, timeout, assertion, retry, baseline, budget or CI change was made to obtain a passing claim. There is no outstanding `DECISION_REQUIRED.md`.

## Changed-file inventory

- `apps/e2e/src/a11y-global-setup.ts`
- `apps/e2e/src/a11y-keyboard.ts`
- `apps/e2e/src/a11y-matrix.ts`
- `apps/e2e/src/a11y-record.ts`
- `apps/e2e/src/text-spacing-matrix.ts`
- `apps/e2e/src/text-spacing.ts`
- `apps/e2e/tests/a11y/acceptance.a11y.test.ts`
- `apps/e2e/tests/a11y/text-spacing.a11y.test.ts`
- `apps/e2e/tests/record.e2e.test.ts`
- `apps/e2e/tests/text-spacing.e2e.test.ts`
- `apps/web/src/pages/DiscoveryPanels.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/route-registry.test.tsx`
- `docs/c-plan-c-text-spacing-stub-apps-bind.md`
