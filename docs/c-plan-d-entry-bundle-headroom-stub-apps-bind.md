# c-plan-d-entry-bundle-headroom-stub — app binding and local evidence

`contract_change=NO`. Base: `5c0a96a1e73c87ff672a15fe7464be3f25e8713d` (`origin/main`), working branch `agent/kixc-c-plan-d-entry-bundle-headroom-stub`, measured 2026-10-26. Node 22.20.0, npm 11.21.1. Browser: local Google Chrome 156.0.8078.47. All evidence below describes this uncommitted working tree; no remote CI or live-gate pass is claimed.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Implementation and boundaries

The shell imports `packages/protocol-adapter/src/shell-entry.ts` through relative paths. Stub selection stays synchronous. HTTP selection returns no adapter until its dynamic `http-entry.ts` import and complete verification finish. `protocol.ts` retains its meaningful `createProtocol` import alias and a live binding to the actual adapter. `bootstrap.ts` gates React rendering on that readiness promise. Its explicit `./protocol.js` import leaves the browser fault fixture's extensionless protocol-port replacement intact. Failed verification rejects without selecting a stub or rendering the shell; the existing HTML boot notice stays visible.

`http-entry.ts` runs the full existing `collectSdkPinErrors` verification, both OpenAPI raw assertions and `requireSdkPin` before constructing `HttpProtocolAdapter`. The existing synchronous `createProtocol` uses that same verified HTTP factory. The SDK and both OpenAPI modules still perform their original load-time assertions, byte-identically. README's “asserts these digests and the vendored bytes at load time” remains true: SDK module loading now occurs at the lazy boundary. Routes that display pin-derived data still import the verified modules before evaluating their packet or scenario data.

The home and gift route import closures also use direct adapter-module imports, keeping unrelated barrel side effects out of their landing set. Explicit manual chunks isolate raw SDK bytes, OpenAPI pins, the fixture catalogue and bounded shared cases. The SDK manual group contains only `?raw` bytes; its generated runtime catalogue stays on its natural dependency path to avoid a pin-chunk cycle. Six explicit locale-data groups compress repeated display sentences together; `onlyExplicitManualChunks: true` keeps dependencies out of those groups. No message source, locale wording, CSS, browser baseline or budget limit changed. The normal Vite modulepreload polyfill remains enabled.

- Full SDK digest and byte verification precedes HTTP construction and pin-derived rendering. A one-byte mutation of any of the 15 vendored inputs throws. Both OpenAPI raw verifiers reject mutated copies too.
- HTTP selection is asynchronous; readiness tests hold verification pending, then exercise success and rejection. Before resolution there is no render or exchange. Rejection renders nothing and sends zero fetches. Success preserves `instanceof HttpProtocolAdapter` behavior.
- Default mode stays stub; no new network call, storage key, UI copy or protocol command. Loopback validation, one attempt, trace checks, redirect refusal and production/truth false remain in the existing transport.
- `placeHold` remains not-bound with considered action `reserve_listing`; the M2 journey stops at `accept_trade`. No new command sequence is composed.
- Catalogue v2, historical v1 literals, `liveTupleKey()`, release/qualification consumption digests and `HANDOFF_PINS` remain unchanged. The existing handoff test checks the complete digest values and unchanged visible digest prefixes. Audit-6's recorded tuple ruling remains intact.

## Clean normal-build measurements

Each normal measurement used Node 22.20.0, scrubbed every `VITE_*` environment variable, an empty temporary `envDir`, production mode and a fresh output directory. Source-map builds were separate diagnostics. The ordinary `npm run build` also passed with scrubbed `VITE_*` variables; the web tree contains no `.env*` files.

| Metric (gzip level 9 bytes) | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Initial JS, scripts plus modulepreloads | 289,808 | 161,447 | 128,361 |
| Initial CSS | 4,974 | 4,974 | 0 |
| All emitted JS/CSS | 788,925 | 778,382 | 10,543 |
| Emitted JS/CSS files | 79 | 100 | — |
| Lazy/shared JS chunks | 77 | 92 | — |
| Largest lazy/shared JS chunk | 26,032 | 28,279 | — |

The measured base differs from the supplied historical 289,989 / 789,939 figures; the table records the actual clean base at this SHA. Initial headroom under 290,000 grows from 192 to 128,553 bytes, reclaiming 128,361 bytes. Node targets are explicitly asserted in `test/entry-import-graph.test.ts`: initial JS ≤ 282,000 and total ≤ 785,000. Existing limits remain 290,000 initial JS, 30,000 per lazy chunk, 5,000 CSS, 400,000 landing JS and 790,000 total. `bundle-budget.json` adds only `baseline.entryHeadroom`.

All initial JS files in the final normal build:

| File | Gzip bytes |
| --- | ---: |
| `assets/a11y--present.en-C-GKF0Ba.js` | 256 |
| `assets/display-copy-6-BhV-Ut-R.js` | 28,128 |
| `assets/index-D6BQe7uZ.js` | 115,754 |
| `assets/marketing--labels.en-CniW4KiC.js` | 399 |
| `assets/protocol-BoXH9Bjt.js` | 5,916 |
| `assets/sha256-pXehPrU6.js` | 1,827 |
| `assets/shared-copy-H4ZjcUil.js` | 9,167 |

## Entry source-map attribution

`/tmp/kix-measure.mjs` invoked Vite's build API from the web root, emitted source maps outside the repository, decoded mappings with `@jridgewell/sourcemap-codec`, assigned generated character ranges to each source, concatenated each source's ranges, and gzipped each source slice at level 9. These are independent attribution estimates, **not additive gzip contributions**: compression across sources and chunk boundaries changes the result. Unmapped runtime glue is not assigned to a source. A Rollup `generateBundle` plugin separately recorded each module's `renderedLength` before minification as a cross-check.

Before, top 15 entry sources by independently gzipped mapped slice:

| Source | Mapped bytes | Independent gzip estimate |
| --- | ---: | ---: |
| `node_modules/react-dom/cjs/react-dom-client.production.js` | 203,360 | 63,462 |
| `packages/protocol-adapter/src/contract-fixtures.ts` | 91,003 | 17,624 |
| `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs` | 39,172 | 13,907 |
| `packages/protocol-adapter/src/operational-qualification.ts` | 49,132 | 13,279 |
| `packages/protocol-adapter/src/finance-operations.ts` | 36,049 | 9,806 |
| `packages/protocol-adapter/src/tenant-permissions.ts` | 31,458 | 8,543 |
| `packages/protocol-adapter/src/marketing-journey.ts` | 27,965 | 7,592 |
| `packages/protocol-adapter/src/platform-release.ts` | 23,636 | 7,374 |
| `packages/protocol-adapter/src/delegated-assistant.ts` | 23,924 | 7,091 |
| `packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json?raw` | 95,600 | 6,692 |
| `packages/protocol-adapter/src/installable-mobile.ts` | 20,908 | 6,057 |
| `packages/protocol-adapter/src/resale-case.ts` | 23,503 | 6,052 |
| `packages/protocol-adapter/src/provider-journey.ts` | 19,030 | 5,287 |
| `packages/protocol-adapter/src/sdk-pin.ts` | 13,300 | 4,933 |
| `apps/web/src/i18n/catalogue.ts` | 14,212 | 4,925 |

After, top 15 entry sources by the same method:

| Source | Mapped bytes | Independent gzip estimate |
| --- | ---: | ---: |
| `node_modules/react-dom/cjs/react-dom-client.production.js` | 203,202 | 63,476 |
| `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs` | 38,295 | 13,509 |
| `packages/protocol-adapter/src/resale-case.ts` | 23,494 | 6,047 |
| `apps/web/src/i18n/catalogue.ts` | 14,218 | 4,930 |
| `packages/protocol-adapter/src/reservation-case.ts` | 16,529 | 4,503 |
| `packages/protocol-adapter/src/credit-case.ts` | 13,466 | 3,939 |
| `node_modules/react/cjs/react.production.js` | 7,801 | 2,967 |
| `packages/protocol-adapter/src/stub-adapter.ts` | 10,609 | 2,944 |
| `packages/protocol-adapter/src/settlement-case.ts` | 5,482 | 1,941 |
| `apps/web/src/shell/route-registry.ts` | 5,546 | 1,806 |
| `apps/web/src/screens.ts` | 7,493 | 1,732 |
| `apps/web/src/components/Shell.tsx` | 3,575 | 1,568 |
| `node_modules/scheduler/cjs/scheduler.production.js` | 3,481 | 1,502 |
| `node_modules/react-dom/cjs/react-dom.production.js` | 3,578 | 1,231 |
| `apps/web/src/shell/RenderBoundary.tsx` | 3,416 | 939 |

Before, top 15 Rollup entry modules by `renderedLength` (unminified characters):

| Module | Rendered length |
| --- | ---: |
| `node_modules/react-dom/cjs/react-dom-client.production.js` | 644,593 |
| `packages/protocol-adapter/src/contract-fixtures.ts` | 109,782 |
| `packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json?raw` | 101,566 |
| `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs` | 86,852 |
| `packages/protocol-adapter/src/operational-qualification.ts` | 65,752 |
| `packages/protocol-adapter/src/finance-operations.ts` | 56,196 |
| `packages/protocol-adapter/src/tenant-permissions.ts` | 49,921 |
| `packages/protocol-adapter/src/marketing-journey.ts` | 41,311 |
| `packages/protocol-adapter/src/resale-case.ts` | 41,274 |
| `packages/protocol-adapter/vendor/kix-sdk-0/generated/catalogue.ts?raw` | 39,248 |
| `packages/protocol-adapter/src/delegated-assistant.ts` | 36,899 |
| `packages/protocol-adapter/vendor/kix-sdk-0/generated/catalogue.ts` | 36,109 |
| `packages/protocol-adapter/vendor/kix-protocol.integration-gate.openapi.json?raw` | 35,835 |
| `packages/protocol-adapter/src/platform-release.ts` | 30,575 |
| `packages/protocol-adapter/src/installable-mobile.ts` | 30,393 |

After, the same Rollup cross-check:

| Module | Rendered length |
| --- | ---: |
| `node_modules/react-dom/cjs/react-dom-client.production.js` | 644,593 |
| `node_modules/react-router/dist/development/chunk-OB3PAWPO.mjs` | 86,852 |
| `packages/protocol-adapter/src/resale-case.ts` | 41,274 |
| `packages/protocol-adapter/src/reservation-case.ts` | 28,931 |
| `packages/protocol-adapter/src/credit-case.ts` | 23,410 |
| `node_modules/react/cjs/react.production.js` | 19,185 |
| `packages/protocol-adapter/src/stub-adapter.ts` | 16,287 |
| `apps/web/src/i18n/catalogue.ts` | 12,575 |
| `node_modules/scheduler/cjs/scheduler.production.js` | 11,134 |
| `packages/protocol-adapter/src/settlement-case.ts` | 9,711 |
| `node_modules/react-dom/cjs/react-dom.production.js` | 7,918 |
| `apps/web/src/components/Shell.tsx` | 7,402 |
| `apps/web/src/shell/route-registry.ts` | 7,320 |
| `apps/web/src/screens.ts` | 6,295 |
| `apps/web/src/shell/RenderBoundary.tsx` | 6,011 |

## Commands actually run

`/tmp/kix-run` prepends `/tmp/kix-node22/node_modules/.bin` to PATH and executes its arguments. Node 22.20.0 was installed with `npm install --prefix /tmp/kix-node22 --no-package-lock --no-audit --no-fund node@22.20.0`; repository dependencies were unchanged. Workspace-specific Vitest commands below run from the stated workspace. Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1`; all browser servers bind to `127.0.0.1`. Long commands ran in the foreground and were awaited.

| Command | Result |
| --- | --- |
| `node --version` through `/tmp/kix-run` | PASS: v22.20.0 |
| `node /tmp/kix-measure.mjs before --maps` | PASS: source attribution and Rollup module dump |
| `node /tmp/kix-measure.mjs before-normal` + `node scripts/check-bundle-budget.mjs --dist apps/web/dist --budget apps/web/bundle-budget.json --json-out /tmp/kix-before-budget.json` | PASS: 289,808 initial / 788,925 total |
| `KIX_REQUIRE_GATE=0 npx vitest run test/no-bypass.test.ts test/sdk-pin.test.ts test/openapi-pin.test.ts test/http-adapter.test.ts` (repository root) | PASS: 3 matched suites, 27 tests; the nonexistent final filter is noted below |
| `npx vitest run test/entry-import-graph.test.ts test/handoff-packet.test.tsx` (web) | PASS: 2 suites, 10 tests; dist check executed |
| `npx vitest run --config vitest.entry.config.ts` (web) | PASS: 6 cold tests; no preload setup |
| `npm ci` | PASS, twice; no repository dependency or lockfile changes |
| `npm run typecheck` | PASS, including final implementation |
| `npm run build` | PASS, including final implementation |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,421 tests (23 live-gate tests skipped), web 1,220 tests, isolated cold suite 6 tests |
| `npm run budget` | PASS: 161,447 initial JS / 4,974 CSS / 778,382 total; largest lazy chunk 28,279 |
| `npm run lint` | PASS after correcting the test-regex escape |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines/statements 91.24%, functions 97.45%, branches 84.77%; web lines/statements 92.93%, functions 80.98%, branches 89.27% |
| `npm run cycle-check` | PASS, no circular imports |
| `npm run deps:check` | PASS, production dependency gate |
| `npm run audit:warn` | PASS, zero production vulnerabilities |
| `npm run typecheck:e2e` | PASS |
| `npm run test:budget` with the browser environment above | PASS: 9 tests; landing 346,509 bytes; chunk-failure and render checks pass |
| `npm run test:e2e` with the browser environment above | PASS: 43 files, 175 tests |
| `npm run test:a11y` with the browser environment above | PASS: 15 files, 269 tests; shell-fault, axe, keyboard, reflow, locale and display checks |
| `npm run test:visual` with the browser environment above | PASS: 3 files, 107 tests; committed baselines unchanged |
| `node /tmp/kix-http-smoke.mjs` | PASS: valid HTTP bootstrap renders, tampered served bytes throw, zero pre-verification exchanges in both cases |
| `node /tmp/kix-measure.mjs final --maps` | PASS: final source attribution and Rollup cross-check |
| `node /tmp/kix-measure.mjs final-normal` + `node scripts/check-bundle-budget.mjs --dist apps/web/dist --budget apps/web/bundle-budget.json --json-out /tmp/kix-final-clean-budget.json` | PASS: isolated clean build exactly matches ordinary final build |
| `git diff --check` | PASS |
| Locked-content `git diff origin/main -- ...` (paths listed below) | PASS, empty |
| JSON equality after removing only `baseline.entryHeadroom` | PASS: budget otherwise identical to `origin/main` |

The HTTP smoke script builds with explicit HTTP mode, an empty env directory and base `http://127.0.0.1:8765`, serves the temporary app only on loopback, and holds the SDK raw-byte chunk in Chrome. Before release, the shell is absent and there are zero gate exchanges. Valid bytes permit rendering. Replacing one ASCII byte in the served verifier string produces a pin error, leaves the shell absent and produces zero exchanges. This is a local browser fixture, not a live protocol gate or HTTP qualification. Unit readiness tests separately mutate every input, hold the verification promise and assert zero fetches.

## Failed attempts and corrections

- The first narrow-only layout measured 121,708 initial / 791,899 total bytes and produced 119,053- and 49,652-byte shared chunks. Explicit pin/case splits fixed the chunk cap but increased total gzip. An experimental 65-file route-import rewrite and feature/page co-location did not reduce total; both were reverted. Only nine landing-closure runtime imports were subsequently narrowed to address measured landing behavior.
- Locale grouping candidates measured 787,265, 785,277 and 785,064 total bytes. Grouping files with overlapping sentences reduced the total enough to preserve every original limit. Disabling the modulepreload polyfill was tested during optimization and reverted once unnecessary.
- Initial graph-test assertions incorrectly matched comments/string literals as protocol reads, and a raw-byte sentinel used text absent from the verifier. The test now checks actual property/element-access AST nodes and derives sentinels from existing vendored source. One collection raced an emptying build and skipped the dist check; the sequential rerun executed both graph/dist checks and passed.
- A cold-test invocation used a duplicated config path, and several narrow-test invocations ran from the repository root without the web setup. The corrected workspace commands passed. Early adapter filters also named two nonexistent test files; the final narrow run selected the actual OpenAPI, SDK and seam suites (27 tests).
- ESLint rejected one unnecessary quote escape in the new graph test; it was corrected and lint passed.
- The first browser budget run passed chunk failure and render checks but failed landing at 438,538 / 400,000 bytes. Narrowing the home/gift dependency imports reduced the measured landing to 346,509 bytes and the entire budget suite passed.
- The first coverage run missed adapter functions by 0.01 percentage point (97.39% / 97.4%). Reusing the verified factory in the existing synchronous factory made existing HTTP-selection tests exercise the same verification implementation; the rerun passed at 97.45%. Floors and coverage configuration stayed unchanged.
- The first HTTP smoke assertion assumed the root was empty; the pre-existing HTML boot notice occupies it. The corrected assertion checks that no React shell renders before verification; success and tampered-byte paths passed.

## Deviations and remaining scope

The design review's corrections are applied: relative adapter imports, a meaningful `createProtocol` alias, behavior tests inside `apps/web/test/`, an isolated cold Vitest configuration without screen preloading, a readiness bootstrap compatible with fault-port replacement, explicit tighter size assertions and checks of every initial script/modulepreload. No adapter package exports or existing adapter test were changed. The barrel did not need additional exports. The existing synchronous factory now shares verification rather than duplicating construction. Measured shared-chunk and landing failures required case/locale chunks and nine landing import changes beyond the initial shell seam. No copy split or policy decision was needed.

The checked-in executable `.aiops/program.json` contains 60 nodes, whereas the task's historical description says 18. This is informational: no metadata was edited and no other node was dispatched. No pending/draft node was implemented. No stop condition was encountered. Any future need for unmerged contracts/dependencies, hardware, money, credentials, production, a product-policy value or a new command must still stop for the specified owner decision.

The locked-content command ran with empty output:

```sh
git diff origin/main -- packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/vendor packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts .github .aiops docs/aiops
```

The locked-content diff is empty for bindings, all vendor bytes, SDK pin source, both OpenAPI pin sources, `.github`, `.aiops` and `docs/aiops`. Both pins, PINNED_ACTIONS and all merge/digest constants remain untouched. Live-gate tests were deliberately skipped with `KIX_REQUIRE_GATE=0`; they are not reported as passes. Remote CI, commit, push, pull request and GitHub writes belong to the supervisor and were not performed here.

All four completed browser run records (budget, journeys, accessibility and visual) record `nonLoopback: 0`, `nonGet: 0` and `appNetworkCalls: 0`. Their local temporary outputs are `/tmp/kix-entry-browser-budget-record.json`, `/tmp/kix-entry-e2e-record.json`, `/tmp/kix-entry-a11y-record.json` and `/tmp/kix-entry-visual-record.json`. All final local checks passed; browser baselines remain unchanged.

## Files changed

- `apps/web/bundle-budget.json`
- `apps/web/package.json`
- `apps/web/src/bootstrap.ts`
- `apps/web/src/components/AsyncState.tsx`
- `apps/web/src/components/Shell.tsx`
- `apps/web/src/connectivity/write-guard.ts`
- `apps/web/src/gift-desk.ts`
- `apps/web/src/gift-source.ts`
- `apps/web/src/journey-desk.ts`
- `apps/web/src/journey-source.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/pages/BoxOffice.tsx`
- `apps/web/src/pages/GiftPanel.tsx`
- `apps/web/src/pages/JourneyPanel.tsx`
- `apps/web/src/pages/RefundReturnPanel.tsx`
- `apps/web/src/protocol.ts`
- `apps/web/src/refund-return.ts`
- `apps/web/src/session-store.ts`
- `apps/web/src/transport-status.ts`
- `apps/web/test/cold/lazy-pins.test.ts`
- `apps/web/test/entry-import-graph.test.ts`
- `apps/web/vite.config.ts`
- `apps/web/vitest.config.ts`
- `apps/web/vitest.entry.config.ts`
- `docs/c-plan-d-entry-bundle-headroom-stub-apps-bind.md`
- `packages/protocol-adapter/src/create-protocol.ts`
- `packages/protocol-adapter/src/http-entry.ts`
- `packages/protocol-adapter/src/shell-entry.ts`
