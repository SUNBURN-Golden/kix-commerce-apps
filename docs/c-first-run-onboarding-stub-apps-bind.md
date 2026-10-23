# First-run onboarding and synthetic demo mark (stub)

`c-first-run-onboarding-stub`, contract_change=NO. Source/base-main SHA at implementation start: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`. The supervisor records the delivery SHA after commit; this builder leaves changes uncommitted.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Behaviour

A fresh tab shows a named section before main, with a synthetic-data explanation, three role links, Skip, a help link and the local-guide path. The destinations are looked up by primary workspace surface ID in the route registry and tested against the workspace registry: buyer workspace, organizer workspace and receipt explorer. No route or screen is added. The guide is non-modal, leaves first-paint focus alone and keeps the content skip link first. Role selection dismisses it; navigation focuses the main heading, including selection of the current role screen. Modified link presses preserve normal browser behaviour and do not dismiss this tab's guide.

Skip dismisses the guide and, after render, focuses the header's show-again button. Show-again clears the preference and focuses the guide title after render. With storage blocked, these actions still work for this page load. The guide and header mark are outside live regions; the app-error mark appears inside the existing error alert. Neither component adds a live-region role. Print hides the guide and show-again control, and keeps the demo mark.

The shell header carries the synthetic-demo mark on every registry screen, alias, not-found and route-error screen, including loading, empty and UNKNOWN states. Both app-error panel kinds carry their own mark because they replace the shell. Boot-loading and JavaScript-off notes in `index.html` precede the app and are excluded from the app mark; they remain explicit loading/JavaScript notes. The catalogue supplies matching ko/en wording; screen-body translation is outside this node. See [local run guide](guide/local-run-ko.md) and in-app `/help` for status words.

## Storage and boundaries

`kix-onboarding` is an exact allow-listed sessionStorage key with only the literal `dismissed`. It is a preference, never recovery evidence. Missing, malformed, blocked or full storage cannot prevent rendering. A reload in the same tab keeps a stored dismissal; an independently opened new tab starts with the guide shown. No localStorage is used. Browser-created copies of tab session storage may also copy the preference.

Session-record TTL stays UNDETERMINED (legal/designated user); no clock, expiry, timer or retention value is added. `SESSION_RETENTION_POLICY` remains `UNDETERMINED`. Nothing clears session evidence.

No route or screen change: the screen/journey/a11y coverage rows and local evidence-matrix tables are unchanged. Four onboarding checks are added to the a11y static check ledger, without changing screen rows or known findings. The evidence matrix's node row stays `NOT_STARTED` until separately retyped under its convention.

Default stub and synthetic fixtures only. No producer/SDK/provider connection, payment, disbursement, venue scanning, public deployment, runtime enablement, secret or hardware. No UI fetch, transport change or new public schema/command/capability/identifier. `commerce-bindings.ts`, all packages, pins, PINNED_ACTIONS, CI KIX_PROTOCOL_GATE_SHA and protocolMergeSha stay unchanged. M2 composes only through accept_trade elsewhere; capture/settle_capture are never composed or sent here, placeHold stays not-bound with reserve_listing considered. Nothing in kix-protocol is changed.

## Design deviations verified locally

The guide title uses a focusable paragraph with strong text inside the named section rather than an h2. A guide h2 filled the existing missing heading level on `booking:missing`, causing the unchanged axe ratchet to fail. The section remains a named region, while its title does not change the screen heading outline or known findings. No explicit redundant region role is used.

Role destinations use route-registry entries matched by primary workspace surface ID, rather than importing WORKSPACE_SURFACES at runtime. The runtime import brought the entire provenance registry into the entry bundle: initial JS gzip was 300359 against the unchanged 290000 limit. Looking up the same surface IDs in the already loaded route registry reduced it to 289713 (CSS gzip 4841 against 5000); the role/path values are tested against the exact WORKSPACE_SURFACES rows. No route or registry data changed. A clean archive of the starting HEAD measured 288517 initial JS / 4768 CSS, so the older design baseline of 258936 / 4222 did not represent this starting revision.

The requested `git diff --exit-code origin/main -- packages/` comparison returns 1 because origin/main is `6a7fcdc4335dbc091372abed2210469c0f80a1cd` and already contains SDK mock-scenario-kit changes absent from the starting HEAD. `git diff --exit-code HEAD -- packages/` returns 0, and `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts` returns 0. No existing package difference was changed by this node.

## Verification and limits

Unit coverage checks all registry samples, aliases, not-found, both languages, dismissed App renders using a fake store, both error kinds/scopes through their actual shell scope, role registry matching, storage denial and literal values, allow-list scans, unchanged retention, and forbidden clock/transport/live-region additions. Browser checks cover fresh tab, keyboard Skip/show-again, same-tab reload, independent new tab, role navigation including current-page selection, blocked storage, demo marks, app/route errors and Korean 320px reflow. Existing browser suites cover normal, empty, error and pending states, dark mode, forced colours, print, all screen keyboard walks and axe ratchets. No test is weakened or skipped for onboarding.

Commands actually run and their results are recorded below. These are local synthetic observations, not real integration, qualification, user acceptance or release. Screen reader, real device, integration HTTP, live gate and production are not verified. User acceptance remains PENDING and release NOT_AUTHORIZED. A need for a contract, policy or other locked-boundary change requires DECISION_REQUIRED; none is introduced here.

## Local command evidence

Commands were run in the node worktree on `agent/kixc-c-first-run-onboarding-stub`, based on `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3`, with uncommitted changes. Local tools: Node `v20.19.2` (repository minimum supported major; CI uses 22), npm `11.21.0`, Google Chrome `155.0.8059.84`, Playwright core `1.58.2`. No dependencies or lockfile changed. Browser commands build clean stub assets, bind only to loopback, and leave production/truth/release claims false.

| Command actually run | Result |
| --- | --- |
| `npm ci` | Exit 0; 493 packages installed. Existing install-time audit/deprecation warnings; no dependency edits. |
| `npm exec -w @kix/web -- vitest run test/first-run-onboarding.test.tsx test/storage-allow-list.test.ts test/i18n.test.tsx test/user-guides.test.tsx test/route-registry.test.tsx test/app-shell-resilience.test.tsx` | 6 files / 85 tests passed. Initial run: 83 passed / 2 failed in new assertions (attribute order and document capitalization), corrected and rerun. |
| `npm exec -w @kix/web -- vitest run test/first-run-onboarding.test.tsx` | Exit 0; final focused run: 1 file / 8 tests passed. |
| `npm run typecheck` | Exit 0 for adapter and web. |
| `npm run build` | Exit 0; existing large-entry-chunk advisory remains. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0: adapter 1306 passed / 23 existing live-gate tests skipped; web 758 passed. Live gate is not verified. |
| `npm run lint` | Exit 0; no lint errors. |
| `npm run cycle-check` | Exit 0; no circular imports in adapter, web or e2e. |
| `npm run coverage:check` | Exit 0, all floors met. Adapter lines/statements 91.18%, functions 97.44%, branches 84.52%; web lines/statements 83.82%, functions 60.62%, branches 84.72%. |
| `npm run deps:check` | Exit 0; 4 manifests / 589 lockfile entries checked. |
| `npm run audit:warn` | Exit 0; production audit found 0 vulnerabilities. |
| `npm run unused-exports` | Exit 0; existing report-only findings printed, not treated as a blocking pass on findings. |
| `npm run typecheck:e2e` | Exit 0. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-onboarding-e2e.json npm run test:e2e` | Exit 0; 14 files / 51 tests passed. Ledger: zero non-loopback requests, non-GET requests and application network calls. |
| `npm run budget` | Exit 0 after the registry-import fix. Initial failure was initial JS gzip 300359 > 290000. Final measured line is recorded below. |
| `npm exec -w @kix/web -- vite build` | Exit 0; supplementary size measurement during the registry-import fix. |
| `node /workspace/commerce-run/wt/c-first-run-onboarding-stub/node_modules/vite/bin/vite.js build --outDir /tmp/kix-onboarding-base-dist` (in a clean `git archive HEAD` extracted under `/tmp`, reusing installed node_modules) | Exit 0; supplementary unchanged-source baseline build. |
| `node scripts/check-bundle-budget.mjs --dist /tmp/kix-onboarding-base-dist --budget apps/web/bundle-budget.json` | Exit 0; baseline initial JS 288517, CSS 4768, total gzip 621730. |
| `node /tmp/kix-onboarding-visual.cjs` | Exit 0. Foreground local static server and headless browser, both closed after capture. Normal `/buyer`, Korean empty `/receipts?lang=ko` at 320px, held Buyer chunk (loading), aborted Buyer chunk (route error): visible demo mark verified and screenshots visually inspected. Screenshots: `/tmp/kix-onboarding-{normal,ko-empty,pending,error}.png`. |
| `git diff --check` | Exit 0. |
| `git diff --exit-code HEAD -- packages/ .aiops/ docs/aiops/ .github/` | Exit 0; all protected areas unchanged from the starting revision. |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts` | Exit 0; locked bindings byte-identical to main. |
| `git diff --exit-code origin/main -- packages/` | Exit 1 due solely to pre-existing SDK test-kit differences described above. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |

The first full `test:a11y` attempt recorded 232 passed / 2 failed: the guide h2 changed the existing `booking:missing` heading-order finding, and the existing all-screen no-dialog loop timed out. The title markup was corrected; the loop and timeout were not changed. The complete rerun and browser budget results are recorded below.

| Final browser command actually run | Result |
| --- | --- |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-onboarding-a11y.json npm run test:a11y` | Exit 0 on complete rerun: 11 files / 234 tests passed, including all four new onboarding checks, all 37 screen rows, alternate states, existing known-finding ratchets, keyboard, dark mode, forced colours, reduced motion and print. No known-finding or timeout changes. |

Final `npm run budget` measured:

```text
initialJsGzip=289713 initialCssGzip=4841 totalGzip=622378 files=61 chunks=59
largest chunk: assets/CreditOrigination-Cv_DGlBy.js gzip=21648
budget check passed: initial JS, initial CSS, every route chunk and total growth are within the limits.
```

The initial JS limit remains 290000, initial CSS 5000, route chunk 30000 and total growth 1.2; no limit was raised.

| Final browser budget command actually run | Result |
| --- | --- |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-onboarding-browser-budget.json npm run test:budget` | Exit 0; 3 files / 9 tests passed: slow/missing/stale chunks, UNKNOWN fence preservation, five cold loads per long-list case, route splitting and landing-size limits. |

The final a11y record contains 230 required check IDs, including all four `a11y.onboarding.*` checks, and a zero-count network ledger. The journey record contains 39 passed checks and a zero-count network ledger. Artifacts remain local under `/tmp` for supervisor inspection; no GitHub operation was performed. Live-gate skips remain skips, and real integration, screen-reader/device observation, qualification, user acceptance and release remain unverified or unauthorized as described above.

## Merge refresh verification

The in-progress merge combines branch HEAD `dc91e6fec55b48eb8a9360f85e17184d1833d638` with `MERGE_HEAD` / `origin/main` `376042e5761753e577510abb1c61df4791ff98dd`. Verification below observes that uncommitted combined worktree, not either commit alone; there is no merge commit SHA yet. The visual manifest's `appHead` is the branch HEAD and must be read with this source pair. The supervisor stages and commits the merge.

The README conflict retains the onboarding guide and storage preference alongside main's component gallery, connectivity, shared async states and form validation. The overlapping storage paragraph is deduplicated using the expanded allow-list that includes `kix-onboarding`; its shorter main version is superseded. Main's SDK0 catalogue/pin documentation additions are retained. No planned production route is promoted by onboarding or by the development-only gallery, and the evidence matrix's historical node snapshot convention is unchanged.

Main introduced the component-gallery snapshots and visual baselines after the onboarding branch diverged. Two Shell DOM snapshots (en/ko) and all 32 existing visual PNGs are refreshed to include the demo mark and guide. All 32 captured images were visually inspected in eight local inspection sheets; every refreshed baseline was also checked pixel for pixel against those inspected captures. No comparison tolerance, matrix row, assertion, timeout or test is removed or weakened.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The locked bindings remain byte-identical to main with sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. No package, pin, CI, `.aiops/` or `docs/aiops/` edit is made during conflict resolution. Session TTL remains UNDETERMINED. No kix-protocol catalogue or gate change is consumed by this resolution.

The first test attempt exposed the two stale Shell snapshots and missing installed dependencies (`jsdom`, `terser`) from main's merged lockfile. `npm ci` installed that lockfile without changing manifests or lockfile. The first visual comparison correctly failed all 32 old baselines on the added UI. A visual recording attempt and the full accessibility run each hit an existing test timeout while browser suites overlapped; subsequent browser suites run sequentially without changing timeouts or enabling retries. Recording baselines is preparation only; the separate comparison run supplies the visual pass evidence.

| Merge refresh command actually run | Result |
| --- | --- |
| `npm ci` | Exit 0; installed the merged lockfile's dependencies. No dependency-file edit. |
| `npm run typecheck` | Exit 0; adapter and web. |
| `npm run typecheck:e2e` | Exit 0. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0 on final run; adapter 1317 passed / 23 existing live-gate skips, web 1052 passed. |
| `npm exec -w @kix/web -- vitest run test/component-gallery.test.tsx -t 'shell-stub /' --update` | Exit 0; exactly two intended snapshots refreshed, then verified by the full passing suite above. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-onboarding-merge-e2e.json npm run test:e2e` | Exit 0 after dependency install; 15 files / 54 tests, 43 journey check IDs and 5 fault check IDs. Network ledger all zero. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-onboarding-merge-visual-update.json KIX_VISUAL_OUT=/tmp/kix-onboarding-merge-visual-update npm run test:visual` | Exit 0 on complete sequential recording run; 3 files / 42 tests. All 32 PNGs and the source manifest refreshed. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-onboarding-merge-visual-final.json KIX_VISUAL_OUT=/tmp/kix-onboarding-merge-visual-final npm run test:visual` | Exit 0; 3 files / 42 tests, 32 MATCH shots with diffPixels=0, network ledger all zero. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-onboarding-merge-a11y-final.json npm run test:a11y` | Exit 0 on complete sequential rerun; 15 files / 267 tests. Includes all four onboarding checks and the unchanged all-screen dialog probe. Network ledger all zero. |
| `git diff --check` and a conflict-marker scan of every tracked text file | Exit 0; no conflict markers. README remains unmerged in the index until the supervisor stages the edited file. |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts` | Exit 0; the locked file is byte-identical. |
| `git diff --exit-code -- packages/ .github/ .aiops/ docs/aiops/ package.json package-lock.json` | Exit 0 against the merge index; no conflict-resolution edit in these paths. Main's already-staged merged changes are retained. |

Final observations remain local synthetic evidence. Live gate, HTTP/browser integration, real-device/screen-reader observation, production qualification and user acceptance are unverified; release remains NOT_AUTHORIZED. No GitHub comment, staging, commit, merge command, rebase, reset, checkout or push was performed by the builder.

## PR fix round 1 — CSS budget

Source: branch `agent/kixc-c-first-run-onboarding-stub`, HEAD `39ef137537538f1b5b8743b62910df3bb41e0c7e`, plus this uncommitted fix. The tested `apps/web/src/styles.css` sha256 is `a73fe0338f565bce22d44cb4e1b568deba9e097df9a93feaaadcd8ac4af2c1ce`. The only runtime file changed in this round is that stylesheet; this document records the evidence. No blocking review finding was supplied. The supplied CI failure was initial CSS gzip 5058 > 5000; a local unchanged-source build reproduced it at 5069 > 5000.

Repeated status-attribute and keyboard-focus selector prefixes now use `:is()`. Each alternative has the same specificity as its original selector; declarations and rule order are preserved. The discovery scroll-region focus selector stays separate because it has a different specificity from the form controls. No screen, route, copy, state, storage or transport changes. No budget, baseline, test, dependency, CI or protected-path change.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The locked bindings still match `origin/main` (`376042e5761753e577510abb1c61df4791ff98dd`) byte for byte, sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. Session TTL remains UNDETERMINED. No catalogue or gate change is consumed. The other supplied owner rulings require no implementation in this CSS fix.

Local tools remain Node `v20.19.2`, Google Chrome `155.0.8059.84`, and Playwright core `1.58.2`. Browser suites use clean stub builds and loopback only. Evidence applies to HEAD plus the stylesheet digest above, not a new commit.

| Command actually run | Result |
| --- | --- |
| `npm run build` then `npm run budget` before the fix | Build succeeded; size check reproduced the failure: initial JS 286911, CSS 5069, total gzip 631902. Log: `/tmp/kix-onboarding-fix-budget-before.log`. |
| `npm run build` then `npm run budget` after the fix | Passed: initial JS 286916, CSS 4974, total gzip 631859, 68 files / 66 chunks; largest route chunk gzip 21504. All existing limits pass without adjustment. Logs: `/tmp/kix-onboarding-fix-{build,budget}.log`. |
| `npm run test -w @kix/web` | 79 files / 1052 tests passed, including onboarding, storage, guides, snapshots and the evidence matrix. Log: `/tmp/kix-onboarding-fix-web-tests.log`. |
| `npm run typecheck` | Passed for adapter and web. Log: `/tmp/kix-onboarding-fix-typecheck.log`. |
| `npm run typecheck:e2e` and `npm run lint` | Both passed. Logs: `/tmp/kix-onboarding-fix-{typecheck-e2e,lint}.log`. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-onboarding-fix-browser-budget.json npm run test:budget` | 3 files / 9 tests passed, including loading, missing/stale chunks, UNKNOWN preservation, route splitting and long lists. Network ledger all zero. |

The first visual comparison attempt passed 41 / 42 tests; `help.phone.en.light` timed out at the existing 60000ms limit. No pixel mismatch was reported, and no timeout, retry, baseline or assertion was changed. A complete comparison rerun supplies the final evidence below.

| Final browser command actually run | Result |
| --- | --- |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-onboarding-fix-visual-final.json KIX_VISUAL_OUT=/tmp/kix-onboarding-fix-visual-final npm run test:visual` | 3 files / 42 tests passed on complete rerun. All 32 existing baselines MATCH with diffPixels=0, including the previously timed-out Help case, ko/en, phone/desktop, dark mode and forced colours. Network ledger all zero. |
| `KIX_REQUIRE_GATE=0 KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-onboarding-fix-a11y.json npm run test:a11y` | 15 files / 267 tests passed. Includes all four onboarding checks, every screen's keyboard/structure/reflow and axe probes, empty/error/pending states, blocked storage, UNKNOWN fences, dark mode, forced colours and print. Network ledger all zero. |
| `git diff --check` | Passed. |
| `git diff --exit-code HEAD -- packages/ .aiops/ docs/aiops/ .github/ apps/web/bundle-budget.json package.json package-lock.json` | Passed: protected areas, budget, CI and dependencies unchanged in this fix round. |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts` | Passed: locked bindings byte-identical to main. |

Only `apps/web/src/styles.css` and this binding document changed in fix round 1. No commit, push, staging or external post was performed. These are local synthetic observations; live gate, HTTP/browser integration, real device, screen reader, production qualification and user acceptance remain unverified. Release remains NOT_AUTHORIZED.
