# Visual baseline coverage (stub)

Node `c-plan-c-visual-baseline-coverage-stub` extends the committed Linux visual matrix to all 37 production registry routes, including hidden booking. Seven existing full matrices (28 light shots), 30 route coverage pairs (60 light shots), and four existing dark/forced-colours samples total 92. This document supersedes the matrix and receipts exclusions in the historical [visual regression binding](c-visual-regression-stub-apps-bind.md).

Current integration evidence is in [PR fix round 1](#pr-fix-round-1). Earlier recording sizes and verification records below describe the pre-integration candidate and remain historical evidence.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

`contract_change=NO`. Retain the exact citation above in the supervisor's PR summary. Only the existing `create_event` → `prepare_trade` → `accept_trade` journey is composed; `capture`, `settle_capture`, `commit_trade`, `open_admission` and `admit` remain uncomposed. `placeHold` stays not-bound with consideredAction `reserve_listing`; `prepare_trade` is only an invokeLocalCall body. Session-retention TTL remains `UNDETERMINED`.

## Owner-authorized product fix

KIX Commerce scope owner ruling 2026-10-24 20:52 KST, under 준태님 2026-10-15 standing delegation, selects Option 1: reproduce the marketplace phone/Korean overflow, make the minimal CSS fix, add a regression test, then record all 92 shots. Acceptance 6 is relaxed only for this fix.

Before the fix, `/marketplace-performance?lang=ko` at 390×844 had document scrollWidth 482 versus clientWidth 390 (`layout.document-overflow`). In `#mperf-session`, the muted paragraph containing `realDeviceEvidence·producerLoadMeasurement` and `confirmsPrice·confirmsRight·confirmsSale·confirmsOwnership` had scrollWidth 470 versus clientWidth 366. `#mperf-session { overflow-wrap: anywhere; }` wraps those protocol tokens without changing content or hiding overflow. A browser regression checks the full layout probe and the paragraph's scroll/client widths, temporarily disables the rule to reproduce the original document overflow, then restores the rule and checks that the layout probe clears. No probe or allowance changes.

## Locked boundaries

`commerce-bindings.ts` SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. Protocol pins, PINNED_ACTIONS, gate SHA and protocolMergeSha are unchanged. No receipt source, bundle-budget.json, workflow, threshold, .aiops/ or docs/aiops/ changes. The workflow's historical “32 screenshots” comment is unchanged; both README descriptions now say 92. Stub is the default; browser traffic is loopback-only GET, no UI fetch, no retry, no fallback or production activity.

## Full shot table

Phone is 390×844; desktop is 1280×800. Each screenshot is clipped at the existing 2000 CSS pixel height cap. `full` retains phone+desktop × en+ko; `coverage` adds phone/ko/light and desktop/en/light only. Display variants retain their prior scope.

| Shot id | Screen | Path | Viewport | Locale | Scheme | Matrix |
| --- | --- | --- | --- | --- | --- | --- |
| `box-office.phone.en.light` | box-office | `/` | phone | en | light | full |
| `box-office.phone.ko.light` | box-office | `/` | phone | ko | light | full |
| `box-office.desktop.en.light` | box-office | `/` | desktop | en | light | full |
| `box-office.desktop.ko.light` | box-office | `/` | desktop | ko | light | full |
| `buyer.phone.en.light` | buyer | `/buyer` | phone | en | light | full |
| `buyer.phone.ko.light` | buyer | `/buyer` | phone | ko | light | full |
| `buyer.desktop.en.light` | buyer | `/buyer` | desktop | en | light | full |
| `buyer.desktop.ko.light` | buyer | `/buyer` | desktop | ko | light | full |
| `discovery.phone.en.light` | discovery | `/discovery` | phone | en | light | full |
| `discovery.phone.ko.light` | discovery | `/discovery` | phone | ko | light | full |
| `discovery.desktop.en.light` | discovery | `/discovery` | desktop | en | light | full |
| `discovery.desktop.ko.light` | discovery | `/discovery` | desktop | ko | light | full |
| `booking.phone.en.light` | booking | `/booking/evt_lanterns` | phone | en | light | full |
| `booking.phone.ko.light` | booking | `/booking/evt_lanterns` | phone | ko | light | full |
| `booking.desktop.en.light` | booking | `/booking/evt_lanterns` | desktop | en | light | full |
| `booking.desktop.ko.light` | booking | `/booking/evt_lanterns` | desktop | ko | light | full |
| `organizer-workspace.phone.en.light` | organizer-workspace | `/organizer/workspace` | phone | en | light | full |
| `organizer-workspace.phone.ko.light` | organizer-workspace | `/organizer/workspace` | phone | ko | light | full |
| `organizer-workspace.desktop.en.light` | organizer-workspace | `/organizer/workspace` | desktop | en | light | full |
| `organizer-workspace.desktop.ko.light` | organizer-workspace | `/organizer/workspace` | desktop | ko | light | full |
| `handoff.phone.en.light` | handoff | `/handoff` | phone | en | light | full |
| `handoff.phone.ko.light` | handoff | `/handoff` | phone | ko | light | full |
| `handoff.desktop.en.light` | handoff | `/handoff` | desktop | en | light | full |
| `handoff.desktop.ko.light` | handoff | `/handoff` | desktop | ko | light | full |
| `help.phone.en.light` | help | `/help` | phone | en | light | full |
| `help.phone.ko.light` | help | `/help` | phone | ko | light | full |
| `help.desktop.en.light` | help | `/help` | desktop | en | light | full |
| `help.desktop.ko.light` | help | `/help` | desktop | ko | light | full |
| `diagnostics.phone.ko.light` | diagnostics | `/diagnostics` | phone | ko | light | coverage |
| `diagnostics.desktop.en.light` | diagnostics | `/diagnostics` | desktop | en | light | coverage |
| `inventory.phone.ko.light` | inventory | `/inventory` | phone | ko | light | coverage |
| `inventory.desktop.en.light` | inventory | `/inventory` | desktop | en | light | coverage |
| `admission.phone.ko.light` | admission | `/admission` | phone | ko | light | coverage |
| `admission.desktop.en.light` | admission | `/admission` | desktop | en | light | coverage |
| `resale.phone.ko.light` | resale | `/resale` | phone | ko | light | coverage |
| `resale.desktop.en.light` | resale | `/resale` | desktop | en | light | coverage |
| `gift.phone.ko.light` | gift | `/gift` | phone | ko | light | coverage |
| `gift.desktop.en.light` | gift | `/gift` | desktop | en | light | coverage |
| `mobile.phone.ko.light` | mobile | `/mobile` | phone | ko | light | coverage |
| `mobile.desktop.en.light` | mobile | `/mobile` | desktop | en | light | coverage |
| `assistant.phone.ko.light` | assistant | `/assistant` | phone | ko | light | coverage |
| `assistant.desktop.en.light` | assistant | `/assistant` | desktop | en | light | coverage |
| `organizer.phone.ko.light` | organizer | `/organizer` | phone | ko | light | coverage |
| `organizer.desktop.en.light` | organizer | `/organizer` | desktop | en | light | coverage |
| `merchant.phone.ko.light` | merchant | `/merchant` | phone | ko | light | coverage |
| `merchant.desktop.en.light` | merchant | `/merchant` | desktop | en | light | coverage |
| `finance.phone.ko.light` | finance | `/finance` | phone | ko | light | coverage |
| `finance.desktop.en.light` | finance | `/finance` | desktop | en | light | coverage |
| `provider.phone.ko.light` | provider | `/provider` | phone | ko | light | coverage |
| `provider.desktop.en.light` | provider | `/provider` | desktop | en | light | coverage |
| `credit.phone.ko.light` | credit | `/credit` | phone | ko | light | coverage |
| `credit.desktop.en.light` | credit | `/credit` | desktop | en | light | coverage |
| `credit-origination.phone.ko.light` | credit-origination | `/credit/origination` | phone | ko | light | coverage |
| `credit-origination.desktop.en.light` | credit-origination | `/credit/origination` | desktop | en | light | coverage |
| `credit-servicing.phone.ko.light` | credit-servicing | `/credit/servicing` | phone | ko | light | coverage |
| `credit-servicing.desktop.en.light` | credit-servicing | `/credit/servicing` | desktop | en | light | coverage |
| `marketing.phone.ko.light` | marketing | `/marketing` | phone | ko | light | coverage |
| `marketing.desktop.en.light` | marketing | `/marketing` | desktop | en | light | coverage |
| `marketing-journey.phone.ko.light` | marketing-journey | `/marketing/journey` | phone | ko | light | coverage |
| `marketing-journey.desktop.en.light` | marketing-journey | `/marketing/journey` | desktop | en | light | coverage |
| `marketing-m01.phone.ko.light` | marketing-m01 | `/marketing/m01` | phone | ko | light | coverage |
| `marketing-m01.desktop.en.light` | marketing-m01 | `/marketing/m01` | desktop | en | light | coverage |
| `marketing-m02.phone.ko.light` | marketing-m02 | `/marketing/m02` | phone | ko | light | coverage |
| `marketing-m02.desktop.en.light` | marketing-m02 | `/marketing/m02` | desktop | en | light | coverage |
| `marketing-m03.phone.ko.light` | marketing-m03 | `/marketing/m03` | phone | ko | light | coverage |
| `marketing-m03.desktop.en.light` | marketing-m03 | `/marketing/m03` | desktop | en | light | coverage |
| `marketing-m04.phone.ko.light` | marketing-m04 | `/marketing/m04` | phone | ko | light | coverage |
| `marketing-m04.desktop.en.light` | marketing-m04 | `/marketing/m04` | desktop | en | light | coverage |
| `marketing-m05.phone.ko.light` | marketing-m05 | `/marketing/m05` | phone | ko | light | coverage |
| `marketing-m05.desktop.en.light` | marketing-m05 | `/marketing/m05` | desktop | en | light | coverage |
| `platform.phone.ko.light` | platform | `/platform` | phone | ko | light | coverage |
| `platform.desktop.en.light` | platform | `/platform` | desktop | en | light | coverage |
| `marketplace-performance.phone.ko.light` | marketplace-performance | `/marketplace-performance` | phone | ko | light | coverage |
| `marketplace-performance.desktop.en.light` | marketplace-performance | `/marketplace-performance` | desktop | en | light | coverage |
| `permissions.phone.ko.light` | permissions | `/permissions` | phone | ko | light | coverage |
| `permissions.desktop.en.light` | permissions | `/permissions` | desktop | en | light | coverage |
| `notifications.phone.ko.light` | notifications | `/notifications` | phone | ko | light | coverage |
| `notifications.desktop.en.light` | notifications | `/notifications` | desktop | en | light | coverage |
| `identity.phone.ko.light` | identity | `/identity` | phone | ko | light | coverage |
| `identity.desktop.en.light` | identity | `/identity` | desktop | en | light | coverage |
| `session.phone.ko.light` | session | `/session` | phone | ko | light | coverage |
| `session.desktop.en.light` | session | `/session` | desktop | en | light | coverage |
| `receipts.phone.ko.light` | receipts | `/receipts` | phone | ko | light | coverage |
| `receipts.desktop.en.light` | receipts | `/receipts` | desktop | en | light | coverage |
| `journeys.phone.ko.light` | journeys | `/journeys` | phone | ko | light | coverage |
| `journeys.desktop.en.light` | journeys | `/journeys` | desktop | en | light | coverage |
| `qualification.phone.ko.light` | qualification | `/qualification` | phone | ko | light | coverage |
| `qualification.desktop.en.light` | qualification | `/qualification` | desktop | en | light | coverage |
| `release.phone.ko.light` | release | `/release` | phone | ko | light | coverage |
| `release.desktop.en.light` | release | `/release` | desktop | en | light | coverage |
| `box-office.desktop.en.dark` | box-office | `/` | desktop | en | dark | display |
| `discovery.phone.ko.dark` | discovery | `/discovery` | phone | ko | dark | display |
| `handoff.desktop.en.forced-colors` | handoff | `/handoff` | desktop | en | forced-colors | display |
| `booking.phone.ko.forced-colors` | booking | `/booking/evt_lanterns` | phone | ko | forced-colors | display |

## Exclusion

`/dev/gallery`: Development-only route, compile-time removed from the production bundle the suite serves; covered by the gallery a11y suite. No production route is excluded. `visualRouteProblems` checks all production routes (including hidden booking), nav links and sections, sample/id alignment, duplicate screens/exclusions, conflicting exclusions and nonblank notes. Tests inject missing routes/screens and invalid exclusions.

## Reviewed mask list

Playwright screenshot mask colour: `#ff00ff`. These masks exclude whole elements, including surrounding content, not just the hexadecimal characters. They apply only to receipts, to both shots.

| Mask id | Screen | Selector | hasText RegExp | Count | Reason / excluded content |
| --- | --- | --- | --- | --- | --- |
| `receipts.session-id` | receipts | `#desk-main .receipt .section-head p` | `page:[0-9a-f]{16}` | 1 | Entire session paragraph including surrounding copy; pageSessionId is minted per load by receipt-explorer.ts mintSessionId. |
| `receipts.diagnostic-export` | receipts | `#receipt-diagnostic` | — | 1 | Entire diagnostic export textarea, including other diagnostic content; exportText includes sessionId. |

Before each screenshot, `maskProblems` requires the exact target count and rejects visible session-id text and input/textarea values outside masked elements. Negative tests remove a target and inject leaked paragraph/input/textarea values. Both receipt variants are tested across reloads; the ids must differ. `suite.quiet` checks network counters before each navigation, and `suite.pass` checks the final load. The app's random generation is neither pinned nor overridden; no receipts production source changes.

## Manifest and size discipline

`apps/e2e/visual-baselines/linux-d29b2e9b/manifest.json` lists all 92 shot ids and SHA-256 hashes of their PNG bytes, app HEAD, recording date, Chrome version, font widths and unchanged tolerance. The set guard rejects missing/extra files, missing/extra hashes, hash mismatches, invalid PNGs and heights above MAX_SHOT_HEIGHT (2000). Update mode retains an existing PNG only if decoded RGBA pixels are exactly equal; a tolerated RGB channel change is tested separately and must replace the baseline. Normal comparison keeps channelDelta 8 and maxDiffPpm 200, with any size change failing.

The set contains **24,443,772 PNG bytes** (92 files); the largest PNG is `notifications.desktop.en.light.png`, **413,189 bytes**. All remain at most 2000px tall. All 60 additions were opened in contact sheets; both receipt originals were also opened at full size. The session paragraph is magenta; the diagnostic textarea is below the 2000px cut on these initial-load shots and is still guarded and masked by the harness.

The local browser is Google Chrome **156.0.8078.47**, versus 155.0.8059.84 in the prior manifest. The font fingerprint remains **linux-d29b2e9b**, with vendored Hangul glyphs present. Recording took **97.04s** including the build (the suite's wall-clock duration); this is below the unchanged 20-minute CI timeout. Of the existing 32 PNGs, 21 remain byte-identical. Eleven changed by the exact RGBA pixel counts below. Each old/new/diff crop was opened and inspected: differences are confined to glyph rasterization (including the shared banner), with identical dimensions and no moved layout or content. These reviewed Chrome-version updates are retained explicitly, rather than silently re-recorded. Counts here are exact pixel inequality, separate from the tolerant comparison's diffPixels.

| Existing shot | Exact changed pixels | Dimensions changed |
| --- | --- | --- |
| `booking.desktop.en.light` | 44 | No |
| `box-office.desktop.en.dark` | 44 | No |
| `box-office.desktop.en.light` | 44 | No |
| `buyer.desktop.en.light` | 44 | No |
| `discovery.desktop.en.light` | 44 | No |
| `handoff.desktop.en.forced-colors` | 351 | No |
| `handoff.desktop.en.light` | 351 | No |
| `handoff.phone.en.light` | 76 | No |
| `help.desktop.en.light` | 44 | No |
| `help.phone.en.light` | 38 | No |
| `organizer-workspace.desktop.en.light` | 44 | No |

Manifest appHead is the working tree's base `4dc642a3e95c488ab51d6325d70740d0a956aca5`; screenshots include this node's uncommitted changes. The supervisor owns the final commit and hosted CI.

Recording is never pass evidence and is refused with CI set.

## Prior-attempt commands and evidence (retained)

Browser command environment: `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Commands below are local equivalents of repository CI; no hosted CI claim is made. Three independent comparison runs must succeed, with failure propagated. Ephemeral records are under `/tmp`.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; 534 packages installed; lockfile unchanged. npm reported 5 audit findings (2 moderate, 1 high, 2 critical). |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 node_modules/.bin/vite-node apps/e2e/overflow-probe.ts` (temporary probe; before and after CSS fix) | Both commands completed. Before: layout.document-overflow, 482px document / 470px session paragraph. After: no layout problems, document 390px; intentional table scroll containers retained. Temporary probe removed. |
| `npm run typecheck:e2e` (initial implementation) | FAIL: new required manifest hashes absent from the test fixture; fixed by extending fixture, then reran. |
| `npm run typecheck:e2e` (after fixture correction; repeated after final harness changes) | PASS. |
| `KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-coverage-record.json KIX_VISUAL_OUT=/tmp/kix-coverage-record-out npm run test:visual` | PASS: 107 tests, 3 files, 97.04s; 92 shots recorded/preserved. Recording excluded from comparison pass evidence. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS; Vite completed in 6.74s. Existing large-chunk advisory remains; no threshold changes. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1367 passed / 23 gate-dependent tests skipped; web 1068 passed. Skips are not live-gate passes. |
| `npm run lint` (including a final rerun) | PASS, zero warnings. |
| `npm run cycle-check` | PASS; no cycles in adapter, web or e2e. |
| `npm run deps:check` | PASS; 4 package files / 630 lockfile entries. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS, all coverage floors. Web lines/statements 91.36%, functions 76.86%, branches 88.07%. |
| `npm run audit:warn` | PASS; `npm audit --omit=dev` reported 0 vulnerabilities (the full npm ci audit above includes development dependencies). |
| `npm run budget` | PASS: initial JS gzip 288993, CSS 4984, total 783992 bytes; all route caps pass, budget file unchanged. |

The first timed comparison wrapper used `/usr/bin/time -p`, which is absent on this host and failed before starting a test. It produced no comparison evidence. The corrected command uses Bash's built-in `time`, preserves failures with `|| exit 1`, and runs no recording mode:

```bash
for run in 1 2 3; do
  { time env KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 \
    KIX_VISUAL_RECORD_OUT=/tmp/kix-coverage-compare-$run.json \
    KIX_VISUAL_OUT=/tmp/kix-coverage-compare-$run-out npm run test:visual; } \
    > /tmp/kix-coverage-compare-$run.log 2>&1 || exit 1
done
```

A fresh candidate tree was copied from `git ls-files --cached --others --exclude-standard` into `/tmp/kix-coverage-clean-uvng43eb`, excluding ignored build products and node_modules. This is a clean candidate copy, not a newly committed checkout: no commit is authorized. In that directory, the following actual sequence passed:

```bash
npm ci
npm run typecheck:e2e
CI=1 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 \
  KIX_VISUAL_RECORD_OUT=/tmp/kix-coverage-clean-visual.json npm run test:visual
```

Clean-copy result: **107 passed**, 3 files, **109.36s**, all **92 MATCH**, summed diffPixels **0**, profile **linux-d29b2e9b**, all three network ledger counters **0**. The copy has no .git metadata, so its record deliberately says appHead/baseMainSha `unknown`; the harness printed the expected git lookup diagnostics. No update mode was used. This exercises the committed-profile comparison from a fresh install with CI set. Hosted CI remains for the supervisor.

The initial concurrent browser attempt is preserved as failed evidence: visual compare 1 passed (107 tests, 109.56s) and compare 2 passed (107 tests, 109.03s), both with 92 MATCH / zero diffPixels / zero network ledgers. Compare 3 failed one 60s test timer (106 passed), browser journeys failed one 60s timer (173 passed), and accessibility failed one 120s timer (268 passed). The host clock showed a discontinuity: the third visual shell timer reported 58m21.981s while Vitest reported 129.38s, and the timed-out visual test reported 16.182s. These runs are not counted as pass evidence. The cause is inferred to be host timing disruption, not established as a product defect. No timeout, probe, budget or baseline changed in response. Full serial reruns follow with ordinary failure propagation and unchanged settings.

The first serial visual loop used the same Chrome environment, `KIX_VISUAL_RECORD_OUT=/tmp/kix-coverage-serial-$run.json`, `KIX_VISUAL_OUT=/tmp/kix-coverage-serial-$run-out`, and `|| exit 1`. Serial runs 1 and 2 passed all 107 tests (132.49s and 102.82s), each with 92 MATCH, zero diffPixels and zero ledgers. Serial run 3 failed a 60s timer at `permissions.desktop.en.light` (106 passed; 171.31s) and the completeness guard correctly failed. That failed loop is excluded from pass evidence. The passing original comparisons 1/2 and serial comparisons 1/2 provide four independent successful comparison records; the clean-copy CI run provides another. Neither failure was a pixel mismatch, and no thresholds were raised.

That attempt's final serial verification did not establish all required green jobs. `KIX_E2E_RECORD_OUT=/tmp/kix-coverage-browser-final.json npm run test:e2e` failed 1/174 tests (173 passed, 42/43 files passed, 388.34s), at inventory SUCCESS: a 60s timer with displayed 15.887s. `KIX_A11Y_RECORD_OUT=/tmp/kix-coverage-a11y-final.json npm run test:a11y` failed 1/269 tests (268 passed, 14/15 files passed, 364.39s), at the no-dialog keyboard sweep: a 120s timer with displayed 34.158s. The previously failing marketplace and Korean catalogue checks passed on these reruns. The chained sequence used `&&`, so it correctly stopped after the failed journey suite; accessibility and budget were then run independently.

`KIX_BUDGET_RECORD_OUT=/tmp/kix-coverage-budget-final.json npm run test:budget` failed 1/9 tests (8 passed, 48.13s), at slow chunk loading: a 120s timer with displayed 16.064s. Runtime split and all long-list render measurements passed. A further independent rerun, `KIX_BUDGET_RECORD_OUT=/tmp/kix-coverage-budget-rerun.json npm run test:budget`, **passed all 9 tests in 26.64s**, with no code or limit change. This is a different class from a bundle-size breach; `npm run budget` passed unchanged limits.

A third complete attempt ran both suites sequentially, preserving both exit statuses rather than skipping accessibility after a journey failure:

| Command (same Chrome environment) | Result |
| --- | --- |
| `KIX_E2E_RECORD_OUT=/tmp/kix-coverage-browser-third.json npm run test:e2e` | FAIL: 173 passed / 1 failed, 42/43 files, 356.11s. Marketing M03 SUCCESS waited 15s for visible `#coupon-code` and timed out (displayed 16.865s). This differs from the earlier test-timer anomalies; root cause remains unproven. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-coverage-a11y-third.json npm run test:a11y` | FAIL: 268 passed / 1 failed, 14/15 files, 576.09s. Marketing M01 keyboard test hit its unchanged 120s timer; completeness guard failed for `a11y.kbd.marketing-m01`. |

In that attempt, all three full journey attempts and all three full accessibility attempts failed, despite passing individual checks on other runs. They cannot be assembled into a green full-suite claim. Any reproduced defect requiring a product change beyond the specifically authorized marketplace CSS fix needs a separate owner decision; the current evidence does not justify guessing such a fix.

Those recurring, moving timer anomalies prevented a green local CI claim in that attempt. No source, timer limit, layout allowance, workflow or budget was changed to bypass them. Its implementation and five successful visual comparison records (including the clean CI-mode copy) remained available for review. Later continuation evidence follows.

## Earlier continuation verification (2026-10-26 task; host dates are discontinuous)

Continued the existing draft without resetting its implementation or baselines. Strengthened the marketplace regression: disabling the authorized CSS rule in the test reproduces `layout.document-overflow`; restoring it clears the original, unchanged probe. This passed in both current visual runs. Reopened all 60 additions in six contact sheets, both receipt originals at full size, and old/new/difference crops for the 11 existing PNG changes. All 92 manifest hashes were independently recomputed and matched; total PNG bytes remain 24,443,772. No baseline was re-recorded in this continuation.

Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Local Node is **20.19.2**, npm **11.21.1**, Chrome **156.0.8078.47**; repository CI uses Node 22. These are local equivalents, not hosted CI results. Test logs and machine records are ephemeral `/tmp/kix-resume-*` files.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; 534 packages installed; lockfile unchanged. Full audit: 5 findings (2 moderate, 1 high, 2 critical). |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-resume-visual-1.json KIX_VISUAL_OUT=/tmp/kix-resume-visual-out-1 npm run test:visual` | FAIL: 105/107 passed, 187.72s. All 15 harness tests passed. Marketing phone/ko hit the 30s load wait; session desktop/en hit the 60s test timer (displayed 17.247s). Completeness guard failed correctly. 91 recorded shots were MATCH with zero diffPixels; this is not a passing comparison record. |
| `npm run typecheck:e2e && npm run typecheck && npm run build && KIX_REQUIRE_GATE=0 npm test` | PASS. Adapter 1367 passed / 23 gate-dependent skipped; web 1068 passed. Build retained the existing large-chunk advisory and reported an anomalous 49m22s wall time during the clock disruption. |
| `npm run lint && npm run cycle-check && npm run deps:check && npm run audit:warn` | PASS. Zero lint warnings, no import cycles, dependency lock/license gate passed; production audit 0 vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check && npm run budget` | PASS. All coverage floors met (web lines/statements 91.36%, functions 76.86%, branches 88.07%). Initial JS gzip 288993, CSS 4984, total 783992 bytes; unchanged size limits pass. |
| `KIX_E2E_RECORD_OUT=/tmp/kix-resume-browser.json npm run test:e2e` | PASS: all 174 tests / 43 files, 327.61s; all network ledger counters zero. This supersedes the prior journey failures as the current journey result. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-resume-a11y.json npm run test:a11y` | FAIL: 268/269 passed, 461.90s. Marketing M03 desktop axe scan hit the 120s test timer (displayed 16.785s); no accessibility finding was reported for that failure. Network ledgers zero. |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-resume-browser-budget.json npm run test:budget` | FAIL: 8/9 passed, 44.21s. UNKNOWN-fence chunk-failure test hit the 120s timer (displayed 15.516s). Route split and long-list render checks passed. |
| Clean candidate copy: `npm ci && npm run typecheck:e2e` | PASS in `/tmp/kix-resume-clean-52bfi4rx`. Copied tracked and untracked candidate files via `git ls-files --cached --others --exclude-standard -z`; excluded ignored build products/node_modules. No commit or checkout mutation. |
| In that clean copy: `CI=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-resume-clean-visual.json KIX_VISUAL_OUT=/tmp/kix-resume-clean-visual-out npm run test:visual` | FAIL: 106/107 passed, 121.23s. All 15 harness tests passed; box-office phone/ko hit the 60s timer (displayed 16.104s). No pixel mismatch. Missing `.git` metadata intentionally yields unknown git ids. This failed run does not supersede the earlier successful clean-copy record or count as pass evidence. |
| Standalone Node clock probe (`node -` with 1s interval, `Date.now()` versus `process.hrtime.bigint()`, 30s stop timer) | Completed. `/tmp/kix-resume-clock-probe.log`: final monotonic elapsed 29886.27ms versus wall elapsed 585826ms. One interval jumped from 3003.10ms/3003ms to 17872.56ms/573814ms (monotonic/wall), independently confirming a host clock discontinuity without app code or Playwright. |
| `npm run lint` (final rerun); `git diff --check`; SHA-256 and byte comparisons against HEAD for locked files; independent manifest recomputation | PASS. Locked bindings hash remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`; CI, budget, protocol pins and protected directories unchanged. |

The clock discontinuity is directly observed. Its role in the moving browser timer failures is an inference, not a proven sole root cause. No timeout, allowance, comparator tolerance, workflow, budget, application clock or id generation was changed to bypass failures. There were prior successful visual records, but that continuation did **not** establish all required green jobs or three successful comparisons on a stable runner. Browser journeys passed; accessibility, browser budget and current clean-copy visual verification remained outstanding at that point.

## Final builder continuation

Continued the existing draft and baselines. The route checker now resolves an exclusion's registry pattern to its concrete sample before checking for a conflicting picture; a regression covers `/booking/:eventId`. All 15 harness tests, including the authorized marketplace overflow reproduction, pass. No baseline was re-recorded in this continuation. All 60 additions, both receipt originals and the 11 existing image difference crops were reviewed again. Independent verification recomputed all 92 manifest hashes and checked the 2000px cap and the protected files against HEAD.

Browser commands below use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`. Node remains 20.19.2; hosted CI uses Node 22. Logs and records use `/tmp/kix-final-*`; these are local checks, not hosted CI claims. The supplied branch remains based on `4dc642a3e95c488ab51d6325d70740d0a956aca5`; the local `origin/main` reference has advanced to `777a6b5cf36f3f05ef3906d30a7da064b11e0fd7` with merged locale/read-state changes. No branch update or integration was performed; those newer changes are outside this candidate's verification and the supervisor owns git integration.

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS; 534 packages installed, lockfile unchanged. Full audit reports 5 findings (2 moderate, 1 high, 2 critical). |
| `npm run typecheck:e2e` | PASS. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-final-visual-1.json KIX_VISUAL_OUT=/tmp/kix-final-visual-out-1 npm run test:visual` | PASS: 107 tests / 3 files, 104.42s; 92 MATCH, zero diffPixels and zero network ledgers. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-final-visual-2.json KIX_VISUAL_OUT=/tmp/kix-final-visual-out-2 npm run test:visual` | FAIL: 105/107 passed, 196.39s. Box-office desktop/ko hit the 30s load wait; help phone/ko hit the 60s test timer. All 15 harness tests passed. The 91 recorded shots all MATCH with zero diffPixels/network ledgers. A loop planned runs 2 and 3 and propagated failure using `if [ "$result" -ne 0 ]; then exit "$result"; fi`; run 3 was correctly not started. The failed run is not pass evidence. |
| `npm run typecheck && npm run build && KIX_REQUIRE_GATE=0 npm test` | PASS; adapter 1367 passed / 23 gate-dependent skipped; web 1068 passed. Build completed in 7.73s with the existing large-chunk advisory. |
| `npm run lint && npm run cycle-check && npm run deps:check && npm run audit:warn` | PASS; zero lint warnings, no import cycles, lock/license gate passed, production audit 0 vulnerabilities. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; all floors met. Web lines/statements 91.36%, functions 76.86%, branches 88.07%. |
| `npm run budget` | PASS; initial JS gzip 288993, CSS 4984, total 783992 bytes; all existing caps pass. |
| Fresh candidate copy `/tmp/kix-final-clean-dnva0w_6`: `npm ci && npm run typecheck:e2e` | PASS. Created from tracked and untracked candidate files via `git ls-files --cached --others --exclude-standard -z`, excluding ignored build products and node_modules. No commit was created. |
| `KIX_E2E_RECORD_OUT=/tmp/kix-final-journeys.json npm run test:e2e` | PASS: 174 tests / 43 files, 327.06s; all network ledger counters zero. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-final-a11y.json npm run test:a11y` | PASS: 269 tests / 15 files, 335.54s; all network ledger counters zero. This is an observation within the existing known-findings baseline, not a conformance or acceptance claim. |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-final-browser-budget.json npm run test:budget` | PASS: 9 tests / 3 files, 25.58s; all existing split, chunk-failure and render limits pass, network ledgers zero. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-final-visual-3.json KIX_VISUAL_OUT=/tmp/kix-final-visual-out-3 npm run test:visual` | PASS: 107 tests / 3 files, 100.14s; 92 MATCH, zero diffPixels and network ledgers. Includes the dynamic-route exclusion regression. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-final-visual-4.json KIX_VISUAL_OUT=/tmp/kix-final-visual-out-4 npm run test:visual` | PASS: 107 tests / 3 files, 97.47s; 92 MATCH, zero diffPixels and network ledgers. The serial loop for runs 3 and 4 completed successfully with failure propagation. |
| Fresh candidate `/tmp/kix-final-clean-dnva0w_6`: `CI=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-final-clean-visual.json KIX_VISUAL_OUT=/tmp/kix-final-clean-visual-out npm run test:visual` | PASS: 107 tests / 3 files, 101.88s; 92 MATCH, zero diffPixels/network ledgers, profile linux-d29b2e9b. No recording mode. Missing .git metadata produces expected lookup diagnostics and unknown git ids. |
| `python3 -` (independent candidate byte comparison, manifest/hash/height checks, protected-file comparisons, run-record checks); `git diff --check` | PASS; candidate sources match, all 92 hashes/caps verified, protected files unchanged, passing record ledgers zero and visual claims false. |

The three browser suites above ran serially under the temporary foreground wrapper `node /tmp/kix-final-browser-run.cjs`, preserving each exit status. Its one-second wall/monotonic clock monitor wrote `/tmp/kix-final-clock.log`: 690 samples, no drift exceeding one second. This run did not reproduce the earlier clock discontinuity. No application or harness timer was changed.

All required local CI equivalents now pass. Final-code visual comparisons 3, 4 and the fresh-copy CI-mode comparison provide three successful independent records, each with 92 MATCH and zero differing pixels; comparison 1 is an additional successful earlier record. The failed comparison 2 remains recorded above and is excluded from pass evidence. The latest successful checks supersede the earlier continuation's outstanding verification status. No root DECISION_REQUIRED.md is needed: the overflow STOP was resolved by the owner ruling, and the required local checks have now passed without further authority or threshold changes. The candidate copy is a fresh installation of the supplied source, not a new committed checkout; hosted CI and integration with newer main remain the supervisor's responsibility.

## Facet limits / not verified

The result is pixel match on one render profile, not design review, not acceptance, not release, not conformance or qualification. Masked content and content below the 2000px cut are not compared. The per-load session-id semantics remain tested separately. These are initial-load stub screenshots, not coverage of all state transitions. Other render profiles, browsers, devices, printers and screen readers, HTTP browser integration, the live protocol gate and production are unverified here. Runtime measurements are observations on this host, not SLOs. Vendored fonts and loopback-only rendering remain enforced by harness checks and zero network ledgers.

## Hold

Delivery status: **READY** for supervisor integration. All required local checks passed, including three final-code visual comparisons and the fresh-copy CI-mode check. Historical verification failures above remain failures; hosted CI is not claimed.

User acceptance remains PENDING; release remains NOT_AUTHORIZED. No money, hardware, paid services, secrets, KYC, public deployment, credit disbursement, scanning or live marketplace activity. If an actual STOP needs new owner authority or an unmerged contract, write root DECISION_REQUIRED.md with needed input, options, recommendation and decider, and end STATUS: DECISION_REQUIRED. The prior overflow STOP is resolved by the recorded owner ruling above.

## Final worktree checks

`git diff --check` and explicit whitespace checks of this new bind document passed. All 92 manifest hashes were recomputed and matched. The only change under apps/web/src is the five-line marketplace CSS addition. No changes under .aiops/, docs/aiops/, .github/workflows/ci.yml, apps/web/bundle-budget.json, package-lock.json or commerce-bindings.ts; the locked hash remains the value above. No git/GitHub mutations were performed. Final journeys, accessibility, browser budget, static checks and fresh-copy CI-mode visual comparison all passed. The supplied branch base and newer origin/main reference are recorded above for supervisor integration.

## PR fix round 1

The [failed visual job](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/40244871237/job/121324203707) tested merge `c200af21549d15fecc783a5f4b1f71102c9f9930`: branch head `bd751a0f447612f1521e054d8a1cfcbdc69c6757` plus main `777a6b5cf36f3f05ef3906d30a7da064b11e0fd7`. Its 17 failures were actual pixel mismatches, followed by the expected completeness failure. All 15 harness checks passed. This supersedes the earlier assumption that integration with newer main could be left entirely to the supervisor while using the old baselines.

Main already merged the read-state controls in #103 and locale-aware dates in #101. Seven coverage pairs gain filters; identity and session desktop gain row-selection buttons; inventory phone/Korean gains Korean date formatting. These are merged implementation dependencies, not new product decisions. The original branch by itself still passed all 107 visual tests in 101.02s; that result does not verify the integration tree.

Applied `git merge --no-commit --no-ff origin/main` successfully. HEAD is deliberately still `bd751a0`; MERGE_HEAD is `777a6b5`. The staged upstream files are the existing main changes. This round authors no production source; relative to main, `apps/web/src` still differs only by the previously recorded marketplace CSS rule. No protected directory, binding, protocol pin, workflow, lockfile, bundle budget or comparison threshold changed. No commit, push, GitHub comment or CI rerun was performed. The supervisor must preserve the main integration when preparing the final commit.

Recorded the integrated source with the unchanged harness. All 17 replacement images decode to exactly the same RGB pixels as the actual pictures downloaded from CI artifact `12618307177`. The table gives the old-baseline differing-pixel counts under the unchanged channelDelta 8 rule; these equal the CI failures. Reviewed all 17 before/after/difference crops in five local contact sheets: filters, row buttons and the date line account for the differences. This review is baseline maintenance, not design approval.

| Shot | Old-baseline differing pixels | Refreshed vs CI actual differing pixels |
| --- | ---: | ---: |
| `credit-origination.desktop.en.light` | 244453 | 0 |
| `credit-origination.phone.ko.light` | 107256 | 0 |
| `credit-servicing.desktop.en.light` | 261302 | 0 |
| `credit-servicing.phone.ko.light` | 106443 | 0 |
| `finance.desktop.en.light` | 250271 | 0 |
| `finance.phone.ko.light` | 109286 | 0 |
| `identity.desktop.en.light` | 25629 | 0 |
| `inventory.phone.ko.light` | 1304 | 0 |
| `merchant.desktop.en.light` | 240619 | 0 |
| `merchant.phone.ko.light` | 107359 | 0 |
| `notifications.desktop.en.light` | 262361 | 0 |
| `notifications.phone.ko.light` | 109008 | 0 |
| `permissions.desktop.en.light` | 260792 | 0 |
| `permissions.phone.ko.light` | 111253 | 0 |
| `platform.desktop.en.light` | 284702 | 0 |
| `platform.phone.ko.light` | 107626 | 0 |
| `session.desktop.en.light` | 28306 | 0 |

Seven further PNGs were refreshed by the recorder's exact-pixel rule: assistant phone/ko and desktop/en (one pixel each), journeys phone/ko (three), marketing-journey desktop/en (one), provider phone/ko (three) and desktop/en (two), session phone/ko (three). Each changed channel differs by exactly 1/255 in the shared background; all have zero pixels above channelDelta 8. They are recorded explicitly rather than mistaken for layout changes. The other 68 PNGs, including both receipts images and all four display variants, remain byte-identical to the supplied branch head.

The revised manifest hashes all 92 PNGs. Total PNG bytes are **24,297,584**, with largest `assistant.desktop.en.light.png` **412,922 bytes**; every image stays within 2000px. Profile remains **linux-d29b2e9b**, Chrome **156.0.8078.47**, vendored Korean glyphs present. Receipt production source and per-load id semantics are unchanged; the same two reviewed masks remain in force. No new mask was added.

The manifest's appHead records the actual uncommitted HEAD `bd751a0`; the consumed main revision is `777a6b5` as recorded above. The observation record's baseMainSha remains the historical merge-base `4dc642a`, since the merge is intentionally uncommitted. Neither field is a claim that the integrated tree has a new commit. Fresh-copy records have unknown git ids because the copy excludes .git.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. All locked not-bound reasons and uncomposed commands remain unchanged. The locked binding SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

Local verification uses Node **20.19.2** and Chrome **156.0.8078.47**; hosted CI uses Node 22. Browser commands set `KIX_E2E_NO_SANDBOX=1`. Logs, source-copy paths and records are temporary `/tmp/kix-round1-*` files. A temporary foreground Node wrapper monitors wall versus monotonic clock without altering any application, test, timer, browser or workflow setting.

| Check | Result |
| --- | --- |
| First integrated recording, `/tmp/kix-round1-record.log` | FAIL: 105/107 passed, 170.58s. Organizer workspace phone/en load wait and finance phone/ko test timer failed. Completeness correctly withheld the manifest. Excluded from pass evidence. |
| Complete recording, `KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-round1-record-2.json node /tmp/kix-round1-monitor.cjs record-2 npm run test:visual` | PASS: 107/107, 106.26s; complete 92-shot manifest. Recording is not comparison evidence. Clock monitor: 107 samples, no drift above one second. |
| `npm run typecheck:e2e` and `npm run typecheck` | PASS. |
| `npm run lint`, `npm run deps:check`, `npm run cycle-check` | PASS: zero lint warnings, lock/license gate passed, no import cycles. |
| `npm run build` and `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1367 passed / 23 live-gate skips; web 1218 passed. Existing chunk-size advisory retained. Live skips are not passes. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors. Adapter lines/statements 91.30%, functions 97.44%, branches 84.77%; web lines/statements 92.95%, functions 80.97%, branches 89.27%. |
| `npm run budget` | PASS: initial JS gzip 288795, CSS 4984, total 783450 bytes. All route and growth caps unchanged. |
| Fresh candidate `/tmp/kix-round1-clean-2go5g2ph`: `npm ci` | PASS; fresh dependencies and unchanged lockfile. All 795 non-document candidate files independently match the worktree. |
| Worktree: `CI=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-round1-compare.json KIX_VISUAL_OUT=/tmp/kix-round1-compare-out node /tmp/kix-round1-monitor.cjs compare npm run test:visual` | PASS: 107/107, 104.54s; all 92 MATCH, zero differing pixels, all network counters zero, all claims false. Update mode unset. |
| Fresh candidate: `npm run typecheck:e2e`, then `CI=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-round1-clean-compare.json KIX_VISUAL_OUT=/tmp/kix-round1-clean-compare-out node /tmp/kix-round1-monitor.cjs clean-compare npm run test:visual` | PASS: 107/107, 111.91s; all 92 MATCH, zero differing pixels, all network counters zero, all claims false, profile linux-d29b2e9b. Update mode unset. Expected missing-.git diagnostics; git ids unknown. |
| Independent verification of all PNG hashes/dimensions, both comparison records, artifact SHA-256, protected files and candidate bytes; `git diff --check` and `git diff --cached --check` | PASS. The downloaded artifact ZIP hash matches the job's `1fd2f6d034ba6da8a477d2b2ddd9f01a54222f700e97b12fd9bbeb2fece13cbe`; all 17 CI actual images also match the replacements in decoded RGBA, including alpha. |

Both comparison runs used the temporary clock monitor and preserved failure exit statuses. Neither observed a clock drift above one second. The fresh copy is a fresh installation of the uncommitted candidate, not a new committed checkout. Only this evidence document changed after that copy; its shot table and mask list are unchanged. No browser harness, test, assertion, allowance, font, timeout, retry setting or workflow changed in this round.

The existing [hosted integration run](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/40244871237) passed every other required job: Typecheck/build/stub tests, Browser journeys, Accessibility observation, Bundle budget, Lint, Coverage floors, Dependency lock/license and Import cycle check. Those are historical hosted results on the original merge candidate, not new local browser-suite runs or a green hosted visual rerun. This round reran the affected visual suite on the integrated source and from a fresh install, plus the local static/build/stub/coverage/size gates above. A hosted rerun of the resulting commit remains for the supervisor; none was triggered here.

Fix-round delivery status: **READY**. Keep the uncommitted main merge together with the refreshed images, manifest and this evidence update. No additional product change or owner decision is needed. Production source is inherited from merged main plus the branch's previously authorized CSS rule; all newly authored changes in this round are baseline data and this document. The result remains pixel match on one render profile, not design review, not acceptance and not release. User acceptance stays PENDING; release stays NOT_AUTHORIZED.
