# Clipboard feedback belongs to the copied export

Node: `c-plan-c-copy-feedback-fence-stub`. `contract_change=NO`.
Base: `2cf746d733199b5fe9f89310ceb3f277c1602c8e`.

Scope is app-local presentation and tests for `/receipts` and `/diagnostics`.
M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
The locked bindings, catalogue, pins, protocol bodies, journal and evidence are unchanged.
Wave 6 context: [gate record](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343)
and producer `docs/decisions/PROGRAM_ROADMAP_20260930.md` (read-only context; no new producer contract consumed).

`useCopyFeedback` owns an ephemeral generation for an exact `(viewKey, exportText)` pair.
A render with changed ownership resets feedback before it can commit; layout cleanup
revokes the old generation. Returning A → B → A creates another generation. The latest
explicit activation alone may report success in the mounted generation. StrictMode
cleanup/setup and unmount revoke outstanding attempts. Equal model reconstruction,
receipt selection, filters and pagination preserve feedback when export bytes stay equal.

Activation focuses and selects the connected textarea immediately, displays the existing
localized manual-copy instruction, and calls `writeText` at most once within the gesture,
with its original receiver and the captured export bytes. Missing support, a non-function,
throwing accessors, synchronous exceptions and rejected promises retain that fallback.
Obsolete resolutions and rejections are consumed without feedback or focus changes.
A stable polite status paragraph announces explicit results; equivalent rerenders do not
replace its node or mutate its success text. Idle instructions have live announcements off.

Receipt view ownership includes session, model and selected roles, environment, profile,
profile version, domain and locale. Its existing authorization-boundary remount remains.
Diagnostics ownership includes page, adapter mode and locale; byte comparison also catches
changes in connectivity, display, journal, outcomes and build identity.

Both exports pass byte-for-byte to the clipboard. Support diagnostics keep their scope,
entries, quarantine, recorded-not-sent reasons, counters and false flags. App diagnostics
keep build identity, display/connectivity/journal/outcomes, `sent: false`, `notEvidence: true`,
`notApproval: true`, and `productionReadiness: false`. Copy sends no protocol command,
performs no storage mutation, and never retries. Existing export/redaction regressions run
alongside the new mounted tests. Controlled mounted tests spy on actual catalogue invokers,
protocol reads, storage mutation methods and network access, and compare model snapshots.

Browser coverage uses the real stub build, keyboard guard, Tab/Shift+Tab and Enter/Space
on both routes in ko/en, for successful, absent, synchronously throwing and rejecting
clipboard implementations. It checks exact localized instructions, focus, complete text
selection, unchanged exports/storage, a single supported clipboard invocation, receiver,
zero application network requests, and clean harness teardown. New shared check IDs do
not change journey outcome classifications.

Clipboard writes already dispatched cannot be cancelled or reordered; the guarantee is
truthful feedback for the current export. Retention/TTL and unrelated product policies
remain UNDETERMINED/outside scope. No live gate, hosted CI, production qualification,
real payment, or release is claimed. No STOP condition was needed: no new contract,
unmerged dependency, credentials, paid service, hardware, production runtime or policy
value was required. Thresholds, retry counts, timeouts and visual tolerances are unchanged.

## Local verification

Node 22.23.4 and Google Chrome 156.0.8078.47 were used for final verification.
Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome`. The first journey run
used CI's `KIX_E2E_NO_SANDBOX=1`. A local Chrome launch probe subsequently succeeded
without that override, so final browser commands use `unset KIX_E2E_NO_SANDBOX`.

The Node 22 binary was already cached locally. Final commands used:

```bash
export PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
```

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS on Node 24.22.1 initially, then repeated on Node 22.23.4: 535 packages installed. npm reported 19 dependency audit findings including development dependencies; no dependency changes were made. |
| `npm exec -w @kix/web -- vitest run test/copy-feedback.test.tsx test/structured-support-export.test.ts test/receipt-explorer.test.tsx test/receipt-pagination-interactions.test.tsx test/diagnostics.test.tsx` | Initial FAIL: 28 new assertions attempted to spy on `invokeLocalCall` on the stub desk adapter. Fixed to spy on its separate catalogue invokers; rerun PASS, 122 tests. |
| `npm exec -w @kix/web -- vitest run test/copy-feedback.test.tsx test/structured-support-export.test.ts test/receipt-explorer.test.tsx test/receipt-pagination-interactions.test.tsx test/diagnostics.test.tsx test/keyboard-outcome-focus.test.tsx` | Final narrow PASS, 154 tests in 6 files, including 62 new controlled clipboard tests. |
| `npm run typecheck` | PASS, twice, including final implementation/tests. |
| `npm run build` | PASS, twice, including final implementation. |
| `KIX_REQUIRE_GATE=0 npm test` | Initial FAIL: existing accessibility regression forbids status semantics on Receipts' idle instruction. Restored its conditional role on the stable paragraph. Final PASS: adapter 2,980 passed / 23 skipped; web 1,636 passed plus 6 cold-entry tests. |
| `npm run typecheck:e2e` | PASS. |
| `npm run budget` | PASS: initial JS 160,274 bytes gzip, initial CSS 4,974, total 784,838, largest route chunk 27,512; all existing thresholds unchanged. |
| `npm run lint` | PASS, zero lint warnings. |
| `npm run deps:check` | PASS, 4 package manifests / 630 lockfile entries. |
| `npm run cycle-check` | PASS, no circular imports. Resolver emitted warning counts; gate passed. |
| `npm run audit:warn` | PASS: production dependency audit found 0 vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS, both workspace floors: adapter lines/statements 91.73%, functions 97.91%, branches 85.91%; web lines/statements 94.28%, functions 86.44%, branches 90.64%. |
| `KIX_E2E_RECORD_OUT=/tmp/copy-feedback-e2e-record.json npm run test:e2e` | PASS: 246 tests / 51 files, including all 16 new clipboard keyboard cases. Run record has zero non-loopback requests, non-GET requests and application network calls. This initial run used the CI sandbox flag. |
| `KIX_A11Y_RECORD_OUT=/tmp/copy-feedback-a11y-record.json npm run test:a11y` | PASS: 396 tests / 22 files; keyboard facet 89/89. Optional sandbox flag unset. Automated observation only, not user acceptance or conformance. |
| `KIX_BUDGET_RECORD_OUT=/tmp/copy-feedback-browser-budget-record.json npm run test:budget` | PASS: 9 tests / 3 files. Optional sandbox flag unset; route splitting, chunk failures and render tripwires pass without threshold changes. |
| `KIX_VISUAL_RECORD_OUT=/tmp/copy-feedback-visual-record.json KIX_VISUAL_OUT=/tmp/copy-feedback-visual-out npm run test:visual` | Initial FAIL: one existing harness self-check (one-pixel shifted bar) timed out at the existing 60-second limit; all 108 screen comparisons passed, 122/123 tests passed. Run diagnostics classify the failure as overlapping a host event: 88,935 ms wall-clock step and 15,704 ms loop stall. |
| `KIX_VISUAL_RECORD_OUT=/tmp/copy-feedback-visual-final-record.json KIX_VISUAL_OUT=/tmp/copy-feedback-visual-final-out npm run test:visual` | Unchanged rerun PASS: 123 tests / 3 files, all 108 screen comparisons and all 15 harness checks. No baseline, tolerance, timeout or retry change. Optional sandbox flag unset in both visual runs. |
| `KIX_E2E_RECORD_OUT=/tmp/copy-feedback-e2e-final-record.json npm run test:e2e` | Default-flag repeat FAIL: 245/246 tests passed, one Diagnostics/en/absent case timed out. Run diagnostics classify the failure as `withHostEvent: 1`, `withoutHostEvent: 0`; that test had a 29,690,287 ms wall-clock step and a 15,994 ms event-loop stall. No assertion mismatch, network activity or leaked browser resources was reported. |
| `KIX_E2E_RECORD_OUT=/tmp/copy-feedback-e2e-verified-record.json npm run test:e2e` | Unchanged repeat FAIL: all 16 clipboard cases passed, 245/246 tests passed. An existing credit-origination navigation wait timed out during a recorded host event (6,756,980 ms wall-clock step, 14,458 ms loop stall); its missing check also caused matrix teardown to fail. Zero network activity and no leaked browser resources. |
| `KIX_E2E_RECORD_OUT=/tmp/copy-feedback-e2e-clean-record.json npm run test:e2e` | Unchanged repeat FAIL: all clipboard cases passed, 245/246 tests passed. An existing resale cross-product lost-response test timed out during a recorded host event (1,559,785 ms wall-clock step, 15,896 ms loop stall). No source, timeout or retry change was made. |
| `KIX_E2E_RECORD_OUT=/tmp/copy-feedback-e2e-stream-record.json npm run test:e2e 2>&1 \| tee /tmp/copy-feedback-e2e-stream.log` (with `set -o pipefail`) | Final PASS: 246 tests / 51 files, all 16 clipboard checks, matrix validation and teardown. Optional sandbox flag unset. Zero application network calls, non-GET requests and non-loopback requests; zero failed tests. Streamed foreground execution, no implementation or test-configuration change. |

## Deviations and limits

No scope, contract, catalogue, binding, export, locale catalogue or threshold changes.
The mounted locale-switch tests control `LocaleContext`/`stateFor` directly so a locale
change keeps the same mounted tree; `LocaleProvider` reads its `initial` prop only at
mount. Receipts retains its existing conditional status role for idle instructions,
as required by the repository accessibility regression. The feedback paragraph stays stable.

The first install used the shell's Node 24; installation and all final gates were run on
the available Node 22 binary. The first browser journey run mirrored CI's optional
sandbox flag; subsequent browser suites and the final passing journey run unset it.
Intermediate browser failures and their recorded host-clock/loop-stall events are retained
in the table rather than treated as passes. No timeout, retry, visual baseline or tolerance
was changed to obtain passing results. No test process remains running from this work.

Live protocol-gate tests are intentionally skipped with `KIX_REQUIRE_GATE=0`; hosted CI
and real devices/screen readers were not run. These local stub results establish no
production readiness, release or protected program delivery.

## Final file checks

| Command actually run | Result |
| --- | --- |
| `git diff --check` | PASS. |
| `git diff --name-only` | Three tracked files: Receipts, Diagnostics and the browser shared-check matrix. |
| `git ls-files --others --exclude-standard` | Four new files: shared helper, mounted tests, browser tests and this evidence document. |
| `git diff --exit-code HEAD -- packages .github .aiops docs/aiops package.json package-lock.json apps/web/bundle-budget.json` | PASS, protected paths and thresholds unchanged. |
| `git show HEAD:packages/protocol-adapter/src/commerce-bindings.ts \| cmp - packages/protocol-adapter/src/commerce-bindings.ts` | PASS, locked file byte-identical to HEAD. |

Changed files are exactly:

- `apps/web/src/use-copy-feedback.ts`
- `apps/web/src/pages/Receipts.tsx`
- `apps/web/src/pages/Diagnostics.tsx`
- `apps/web/test/copy-feedback.test.tsx`
- `apps/e2e/tests/copy-feedback.e2e.test.ts`
- `apps/e2e/src/journey-matrix.ts`
- `docs/c-plan-c-copy-feedback-fence-stub-apps-bind.md`

No commit, push, PR, issue, external comment or program-mode marker was created.
