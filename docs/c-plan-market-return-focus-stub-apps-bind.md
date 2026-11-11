# Marketplace return focus — app binding and evidence

## Scope and ruling

`c-plan-market-return-focus-stub`, `contract_change=NO`: presentation-only restoration on the two existing resale-market routes. No protocol, pricing, settlement, producer mapping, trading policy, durable recovery or retention policy is defined. Those product decisions remain UNDETERMINED. Production qualification, user acceptance and release remain outside this evidence.

**M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce**. No binding/remapping or capture sequence is introduced. `packages/protocol-adapter/src/commerce-bindings.ts` remains byte-identical, Git blob `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`.

**Owner ruling JunTae 2026-11-09** (14:10 KST, supersedes the 14:10 supervisor ruling): the bundle size cap that blocked the earlier stopped build is lifted. Only the specific cap this node exceeds is raised, by the minimum needed for the measured size plus small headroom, in the existing budget file; every other cap, gate, assertion, timeout, protocol binding and CI config stays unchanged. GitHub Actions exact-head CI is the browser runner of record and acceptance requires it fully green. The old value, new value and reason are recorded in "Size cap ruling" below and belong in the PR body.

The checkout's `.aiops/program.json` has **60 nodes** and does not contain this node. `docs/aiops/PENDING_NODES.json` and the draft catalogue are NON_EXECUTABLE. Only the user's expressly authorized standalone node scope applies here; neither aiops tree is edited. This is not an ASTRA program-mode session, and there is no signer or delivery/blocking comment.

## Existing contracts

The list and detail keep `/resale/market` and `/resale/market/:productId`, with canonical `lang`, `q`, `page` parameters, existing PUSH commits, REPLACE cleanup and unavailable-page recovery. There is no new URL parameter, history-state field, browser-storage key, UI fetch or browser-global product/test seam.

`useMarketReadState()` supplies `useLocation().key` as `visitKey`. `useNavigationType()` distinguishes POP from PUSH/REPLACE. Matching uses committed `query`, `page`, `lang` and exact product identity; canonical search is retained for presentation context. Raw URL parameter ordering is not a match criterion. Locale changes invalidate the association.

The page-load market controller and its existing navigation invalidation stay untouched. Navigation calls no market submit. UNKNOWN remains fenced across reads, Back, explicit returns and locale changes. The stub default, loopback-only HTTP, one attempt, no retry/redirect/fallback, false production/truth flags and all README financial/live-service restrictions remain in force. No protocol change or pin consumption is needed; future authorized consumption must move both OpenAPI pins, PINNED_ACTIONS, CI KIX_PROTOCOL_GATE_SHA and protocolMergeSha together.

## Memory schema and fixed bound

`resale-market-return-focus.ts` owns a lazy page-load singleton and exports `createMarketReturnMemory()` plus a context for isolated mounted tests. `renderRoute()` supplies a fresh instance and forwards its memory router's departures. Production consumes the existing shell navigation observer (`App.tsx` calls `observeNavigation` on pathname change); shared shell focus/navigation code is unchanged.

An ordered Map contains at most **16** records (`MARKET_RETURN_MEMORY_LIMIT`). Re-remembering a list visit replaces it and moves it to the newest position; overflow evicts the oldest. Each record contains only `listVisitKey`, `productVisitKey`, canonical `search`, committed `query`, `page`, `lang`, `productId`, `scrollX`, `scrollY`, viewport-relative `cardTop`, `viewportWidth`, and `viewportHeight`. There is one current rendered visit, one opening association, one explicit-return marker, one pending restoration and a scalar cleanup generation. There are no accumulating aliases or consumed-visit sets. Records contain primitives, never trading snapshots, quotes, outcomes, controller objects or DOM nodes. The bound is a presentation resource limit, not a policy TTL.

Actual lazy-screen transitions can unmount the source before mounting the destination. A microtask must therefore **not** erase the origin: the existing navigation observer discards unrelated departures, while generation-guarded microtasks cancel abandoned restoration tasks and tolerate StrictMode setup/cleanup. DOM frames and listeners live only in the mounted hook and are removed on cancellation, completion or unmount.

## Transition table

| Trigger | Eligibility and result |
| --- | --- |
| Unmodified same-tab card activation, including Enter | Capture the exact list visit, product, committed context and viewport geometry. Prevented/modified/new-tab activation records nothing. |
| Destination product renders | Associate its visit key only with the pending opening's matching product and committed context. |
| Browser POP from product to list | Require prior rendered product visit equals `productVisitKey`, target equals `listVisitKey`, and context matches. Initial POP has no association. |
| Dedicated `data-market-return` link | Its own handler arms the current product departure. A matching PUSH may restore to a new list visit key. Breadcrumb, surface-nav and other marketplace links cannot arm this return. |
| A successful return | Consume the departure once. A fresh opening from that list captures the new list key. Back/Forward to an already consumed product visit cannot re-arm it. No aliases/re-key history is accumulated. |
| Locale/context change, another product, unrelated route or REPLACE cleanup | Discard the opening/return association. Identical searches in different list entries cannot borrow a card. |
| Matching read still loading | Wait. Loading does not establish absence. |
| Matching CURRENT list read is ready/empty | After DOM and shell focus effects, schedule one cancellable animation frame and recheck the current route, task identity and current read state before resolving the exact card identity. |
| Missing card, settled empty/error/NOT_BOUND/STALE, or unavailable-page recovery | Keep the shell's existing localized results-heading focus. No competing second focus call; unavailable-page REPLACE discards the obsolete target. |
| Later keydown, pointerdown, touchstart, wheel, or focus on a user control | Cancel focus and scroll, remove listeners and cancel the frame. Initiating trailing keyup/pointerup, body focus and shell heading/main focus are exempt. Own card focus runs after cancellation listeners are detached. |
| Direct entry or reload | Empty memory; normal skip-link-first initial focus. Direct product return uses the shell heading fallback. |

Card lookup compares exact `data-market-product-id` values, with no selector interpolation or index matching. The card receives `focus({preventScroll:true})`. The remembered card offset determines the scroll target; a changed layout/viewport clamps that offset to keep the card visible. Native `scrollTo` clamps document coordinates and `behavior: instant` overrides smooth scrolling. Global `history.scrollRestoration` is unchanged. A viewport-tall card prioritizes its leading edge. Desktop scroll zero is valid.

## Accessibility and acceptance inventory

The localized marketplace h2 has permanent `id="market-results-heading"` and `tabIndex={-1}`, compatible with existing shell heading focus. Native links remain in normal Tab order with existing focus-visible styles. Restoration waits for matching read evidence, never re-arms on later reads, and yields to subsequent user interaction.

Mounted tests cover the fixed bound, replacement, independent instances, exact POP/departure matching, same-query distinct history entries, direct entry, context invalidation, one-shot returns, StrictMode and lazy cleanup, frame/listener cancellation, delayed/out-of-order reads, safe fallback states, changed viewport geometry and zero submit calls. Existing URL and UNKNOWN tests remain in place.

Browser additions cover en/ko × 320×568/1280×800 × Back/keyboard return/click return, later-page context, visible card and scroll geometry, repeated openings, reload/direct entry, missing detail, replaced/empty lists, held reads before/after interaction, zero navigation dispatches and navigation after one lost write. Accessibility additions cover bilingual, reordered exact identities, missing-card heading fallback, Tab continuation, focus-visible, axe and narrow reflow.

`journey-matrix.ts`, `a11y-matrix.ts`, their `expectedCheckIds()` and existing resale-market/resale-product cells are unchanged. New cases use `suite.quiet` and ordinary assertions; no new suite.pass IDs or matrix cells are added. Full-suite matrix teardown remains authoritative; focused browser runs intentionally fail teardown when other required matrix cells are omitted.

The fixture validator permits **at most two products per response** (`pageSize: 2`). The proposed long response would be invalid, so the scroll/reorder tests use valid two-card replacement responses; the narrow viewport supplies nonzero scrolling. No validator is loosened.

## Size cap ruling

The earlier stopped build measured **786,177** total emitted JS/CSS gzip bytes against the then-independent `entry-import-graph.test.ts` literal cap of **785,000** and stopped with DECISION_REQUIRED. **Owner ruling JunTae 2026-11-09** lifts that blocking cap.

- Old value: `785000` (literal emitted-assets assertion in `apps/web/test/entry-import-graph.test.ts` at this branch's base commit `40b5a77`).
- New value: `790000` effective, owned by the existing budget file `apps/web/bundle-budget.json` (`limits.totalGrowth.base 790000 × maxRatio 1`, the ceiling already authorized by the recorded 2026-10-23 owner ruling). No configured limit value is changed.
- Reason: **owner ruling JunTae 2026-11-09** — raise only the specific cap this node exceeds, by the minimum needed for its measured size plus small headroom; keep every other cap, gate, assertion, timeout, protocol binding and CI config unchanged.
- Form: this branch adopts, byte-identically, the budget-driven assertion already merged on `origin/main` via audit-10-fix (PR #137): `totalLimit = Math.min(790000, budget.limits.totalGrowth.base * budget.limits.totalGrowth.maxRatio)`. That keeps the cap in the existing budget file as the ruling describes, avoids reintroducing a duplicated literal that main deliberately removed, and makes this file merge-clean with main. Measured 786,177 ≤ 790,000 with 3,823 bytes of headroom; the initial-JS target in the same test stays at the stricter 282,000 (measured 160,204).
- All other caps are untouched: initial JS 290,000, initial CSS 5,000, chunk 30,000, landing 400,000, route budgets, render tripwires, coverage floors, a11y baselines, visual baselines, matrix expected IDs and CI configuration.

## Verification ledger

Continuation of the stopped build: the functional patch was carried over unchanged; this session resolved the size-cap STOP per the owner ruling and re-ran the full verification. Local environment: Node **v22.23.4** selected with `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH` (CI's Node 22); the environment default is Node 24.22.1. Commands below omit only that PATH prefix. All commands ran from the worktree root; no long job was left running in the background.

| Command actually run | Result |
| --- | --- |
| `npm exec --yes --package=node@22 -- node -p 'process.execPath + " " + process.version'` | PASS; selected the npm-cached Node 22.23.4 binary outside repository dependencies. |
| `npm ci` | PASS under Node 22.23.4. npm reported 14 existing audit findings (11 moderate, 1 high, 2 critical across dev/prod) and the existing esbuild install-script warning. No dependency/lock changes. |
| `npm run typecheck` | PASS (protocol-adapter and web). |
| `npm run build` | PASS. Clean stub build: total emitted JS/CSS gzip **786,177**; initial JS 160,204; initial CSS 4,974; 86 files. |
| `npm run budget` | PASS: initial JS 160,204 ≤ 290,000; initial CSS 4,974 ≤ 5,000; largest chunk 27,517 ≤ 30,000; total 786,177 ≤ 790,000; every route chunk within its limit. |
| `npm exec -w @kix/web -- vitest run test/resale-market-return-focus.test.tsx test/market-read-state.test.tsx test/resale-market.test.tsx test/entry-import-graph.test.ts` | PASS: 4 files, **68 tests** (return-focus 30, market-read-state 23, resale-market 13, entry-import-graph 2). |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,833 passed / 23 skipped (75 files passed, 5 skipped); web 1,545 passed (108 files); cold-entry 6 passed. Live integration-gate suites were skipped for lack of a kix-protocol checkout; skipped is not a pass. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter` | PASS: 2,833 passed / 23 skipped (adapter summary re-captured for this ledger). |
| `npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | PASS: **49 files, 224 tests**, full mandatory matrix teardown green, zero non-loopback/non-GET/app network calls. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` (first run) | FAIL at teardown only: `gallery.locale-preferences` did not pass in that run. That is the existing dev-gallery surface, untouched by this node; the same gallery area timed out in the earlier stopped build under load. Treated as a runner flake, not waived. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:a11y` (full rerun) | PASS: **22 files, 398 tests**, full mandatory matrix teardown green. All 6 marketplace cases, including both added bilingual cases, passed with no unlisted axe/reflow findings. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:budget` | PASS: 3 files, 9 tests (route split, chunk-failure and long-list render tripwires). |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 3 files, 123 tests against the committed baselines; no baseline was updated. |
| `npm run lint` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines 91.62% ≥ 91.1, functions 97.79% ≥ 97.4, branches 85.79% ≥ 84.5; web lines 94.09% ≥ 83.6, functions 86.36% ≥ 76.1, branches 90.56% ≥ 84.6. All coverage floors met. |
| `npm run deps:check` | PASS: 4 package.json files, 630 lockfile entries; production dependency gate passed. |
| `npm run cycle-check` | PASS: no circular imports in protocol-adapter, web or e2e. |
| `npm run audit:warn` | PASS: production audit found 0 vulnerabilities. |
| `git diff --check` | PASS. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | PASS: unchanged locked blob `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |
| `git diff origin/main -- apps/web/test/entry-import-graph.test.ts` | Empty: the entry test is byte-identical to `origin/main`. |

Per the owner ruling, **GitHub Actions exact-head CI is the browser runner of record**; this session cannot push or open PRs, so exact-head CI acceptance is the supervisor's step and requires a fully green run. The local full suites above are the closest local equivalents of `.github/workflows/ci.yml`. Browser builds also reported existing marketing chunk-cycle and stream MaxListeners warnings; these were not treated as passes or modified in this scope.

## Deviations and delivery state

- Used the Constraints-specified `docs/c-plan-market-return-focus-stub-apps-bind.md`, not the Objective's shorter filename.
- Added the context isolation seam to `apps/web/test/support/render-route.tsx`. No window test seam was introduced.
- Reused the existing navigation observer to distinguish unrelated departures across real lazy-screen mount gaps; immediate origin cleanup proved incorrect in the real browser. Only restoration-task cleanup uses a StrictMode-guarded microtask.
- Successful return-link PUSH consumes the product departure; a subsequent fresh card activation captures the new list visit. Back/Forward cannot resurrect the consumed product association.
- Native coordinate clamping preserves the card offset on layout changes and prioritizes visibility after viewport changes. The viewport fields remain primitive presentation records; no global scroll-restoration setting changes.
- Used valid two-card replacements rather than a long invalid list response; the existing read validator remains authoritative. No nonzero-scroll requirement is imposed on the desktop zero-scroll case.
- No extra suite.pass IDs or matrix source changes; full mandatory teardown remains strict.
- Size-cap STOP resolved by **owner ruling JunTae 2026-11-09** as recorded above; the earlier root `DECISION_REQUIRED.md` is superseded and is not present in the worktree. No threshold other than the one blocking cap changed; no budget, expected matrix ID, timeout, CI file or visual baseline was edited.
- Branch base: this worktree sits on `40b5a77`, which is 27 commits behind `origin/main`; no rebase or merge was performed because the builder must not commit. The entry-test cap change adopts main's audit-10-fix form verbatim so that file merges cleanly. Main also changed `apps/e2e/tests/journeys/resale-market.e2e.test.ts`, `apps/e2e/tests/a11y/resale-market.a11y.test.ts`, `apps/e2e/shell-fixtures/resale-market.ts` and `apps/e2e/src/resale-fault-types.ts` (market-exact-units, text-spacing); the supervisor's merge of main may need to reconcile those with this node's additions.
- The first full a11y run failed only on the unrelated existing `gallery.locale-preferences` check; the immediate full rerun passed 398/398. Both runs are recorded; nothing was waived.
- No commit, push, PR, issue, external comment, aiops edit, adapter binding edit or protocol change was made.

## Risks and STOP boundary

The emitted-assets size STOP is resolved by the owner ruling; the configured budgets and every other check remain in force and passed locally. If exact-head CI is not fully green, acceptance waits on that run; no local result substitutes for it.

Contract/dependency, hardware, money, paid service, credentials, production runtime, product-policy, new protocol command or locked-area requirements remain STOP conditions: write root `DECISION_REQUIRED.md` (need, options, recommendation, decider) and end STATUS: DECISION_REQUIRED rather than guessing. Nothing changes inside kix-protocol; no pin is consumed or moved by this node.