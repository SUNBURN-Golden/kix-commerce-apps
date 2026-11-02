# Resale marketplace local mock — apps binding and evidence

Scope: `c-plan-c-resale-market-ui-stub`, 준태님 order 2026-11-02 14:11 KST relayed by KIX. This is a local synthetic frontend, with original code-native geometric artwork and KIX components/tokens. No third-party branding, images, copy or product identity is used. The layout reference supplies no code or data.

> M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The locked `commerce-bindings.ts` stays byte-identical. `placeHold` stays NOT_BOUND, consideredAction `reserve_listing`; no `capture`, `settle_capture`, `commit_trade`, `open_admission` or `admit` is composed here. Both OpenAPI pins, PINNED_ACTIONS, CI gate SHA, protocolMergeSha, vendor files and budgets stay unchanged. No ORIGINAL_32 label is promoted. Neither aiops tree is edited. No producer contract is consumed.

## Routes and lifetime

| Route | Registry / surface | Binding | Behavior |
| --- | --- | --- | --- |
| `/resale` | resale / resale-desk | stub-only | Existing ticket-rights FSM; one localized market link added |
| `/resale/market` | resale-market | stub-only | Two-card bounded search page; English/Korean fixture search, previous/next and empty results |
| `/resale/market/:productId` | resale-product | stub-only | Concrete sample `/resale/market/demo-001`; variants, quotes, review, bid/ask and instant simulations; missing-product state |

One app source/controller lives for a page load across navigation and locale changes. Reload constructs a fresh demo and replays nothing. Nothing is persisted. Search and detail read the same port. The environment comes from the existing validated selection; integration-http read and submit return NOT_BOUND before dispatch, and never construct a mock fallback. UI components make no fetch calls. No new transport, gate proxy, retry, redirect, Idempotency-Key or protocol command exists.

## Local interface — producer mappings UNDETERMINED

These are app-internal types, not a published producer schema or compatibility claim. `plan-local-resale-offer-source` remains in progress; no unmerged content is needed or implemented.

| Type | Fields / discrimination |
| --- | --- |
| Read request | `kind: list`, `query`, one-based `page`; or `kind: detail`, `productId` |
| Product | `productId`, catalogue `nameKey`, `descriptionKey`, original `artworkKey`, `variantIds` |
| Quote | `quoteId`, `productId`, `variantId`, `side: bid/ask`, canonical `mockUnits`, `version`, `available` |
| Offer | `offerId`, product/variant, side, canonical units, `state: open` |
| Trade | `tradeId`, product/variant, units, `occurredAt`, `state: simulated` |
| Price point | source-owned fixed `occurredAt`, exact canonical `mockUnits` |
| Intent | product/variant, `expectedVersion`; `kind: bid/ask` with units, or `instant-buy/instant-sell` with quoteId |
| Read result | `ready/empty` with echoed request and list/detail payload; or `NOT_BOUND` |
| List payload | `products`, `page`, literal `pageSize: 2`, `total`, nullable `nextPage` |
| Detail payload | nullable detail with product, version, quotes, offers, trades and series |
| Write result | `CONFIRMED` with echoed request, incremented product version and offer/trade; `REJECTED` with echoed request and code; or `NOT_BOUND` |
| Rejection codes | INVALID_INPUT, PRODUCT_MISSING, VARIANT_MISSING, STALE_VERSION, QUOTE_UNAVAILABLE, QUOTE_MISMATCH |

Every result and detail contains `source: synthetic`, `unit: mock-unit` and literal-false `fundsExecuted`, `economicFinalityClaimed`, `productionEndpoint`, `protocolTruth`, `productionConformance`. Validation checks schema, unexpected fields, nested claims, product, variant, action, quote side, expected version, exact units, new record identity and timestamp. Flags alone do not establish valid evidence. Malformed/mismatched post-dispatch answers are UNKNOWN.

Version scope is one product across all variants: each accepted bid, ask or instant action increments that product once and updates its fixture quote versions. Bids/asks append open offers without crossing or matching. Instant buy consumes one selected ask; instant sell consumes one selected bid and appends one simulated trade. Other products retain their own versions. The controller remembers the highest accepted/confirmed version per product; a regressed read is STALE and cannot restore connectivity eligibility. Units are canonical whole-number strings (port syntax up to 30 digits; form syntax uses the existing safe-integer validator and limits input to 15 digits). They are never currency or a fee calculation. Chart coordinates use presentation-only integer scaling; tables retain exact original digits, including values beyond Number precision.

## Transitions and fences

| Trigger | Result / boundary |
| --- | --- |
| Edit → review | Immutable request captures product, variant, kind, expected version and units/quote; nothing sent |
| Explicit confirm | Single dispatch; duplicate activation suppressed before allocation |
| Bid/ask | Append an open mock offer; no trade or automatic matching |
| Instant buy/sell | Consume selected available correct-side fixture at captured version; append simulated trade |
| Missing, wrong-side, stale or unavailable quote | Explicit rejection; no silent price substitution |
| Missing product/variant or invalid units | Explicit rejection without transition |
| Lost, malformed, mismatched or claim-bearing response | UNKNOWN; global page-load write fence |
| Navigation during in-flight write | Navigation observers fence at committed departure; captured browser paths also reject answers during a pending lazy navigation, before screen cleanup. A late response cannot update another product or clear the fence |
| Read during navigation / selection change | Generation- and browser-path-scoped acceptance; older response ignored |
| Disconnect / reconnect | Existing connectivityPort and connectivityController guards; only an APPLIED read with CURRENT freshness and ready/empty state promotes refreshed evidence |
| Reads, navigation, locale, reconnect after UNKNOWN | Fence remains; no subsequent write dispatched |
| integration-http | NOT_BOUND for read and submit, no dispatch or fallback |

Every form, review, result, chart and history repeats localized “Simulated, no funds” wording. The SVG price chart has a labeled equivalent data table. Native controls, form validation/error-summary focus, review focus and one terminal outcome region support keyboard use. Rejection disables the next review until the draft changes; UNKNOWN disables all later trading on this page load. Test-only injected ports live in `apps/e2e/shell-fixtures/resale-market.ts` and enter only the harness fault build, never production bundles.

## Acceptance and evidence mapping

| Acceptance | Evidence |
| --- | --- |
| Synthetic source / bounded search / missing products | Adapter `resale-market.test.ts`, web `resale-market.test.tsx`, browser `resale-market.e2e.test.ts` |
| Bids, asks, both instant directions | Adapter transition assertions; browser four-flow journey, source history after navigation |
| Stale, wrong side, duplicate, lost effect, late response | Adapter/controller tests; browser test-only fault ports, dispatch counter and zero later writes after UNKNOWN |
| Reconnect current-read eligibility / UNKNOWN persistence | Web connectivity test; browser offline/online + explicit read + locale change |
| ko/en / draft retention / IME | Catalogue audit/parity, web locale draft test, browser locale and form/IME coverage |
| Accessible chart/history and keyboard | Exact large-digit table, empty/single-point chart tests; per-route axe, structure, 320px/200% font probes; keyboard outcomes with pointer guard |
| Visual | Both routes × phone/desktop × ko/en; detail review/result, dark and forced-colour captures in existing visual inventory |
| Contract isolation | NOT_BOUND tests, browser zero-network ledgers, locked-binding hash test and protected-path diff |

## Source identity and actual verification

Baseline HEAD: `c6594613d49d4f82545de78e98ea1a6138e3b94e`; branch `agent/kixc-c-plan-c-resale-market-ui-stub`. Working-tree changes are uncommitted as requested. Node v22.20.0 uses `/tmp/kix-m05-node22/node_modules/node/bin` on PATH; Chrome 156.0.8078.47 at `/usr/bin/google-chrome`, sandbox disabled only for the container browser harness. Logs reside in `/tmp/kix-resale-*.log` for this session. Actual command results and gzip measurements are recorded below.

Qualification remains UNQUALIFIED; user acceptance PENDING; release NOT_AUTHORIZED. Passing local checks does not change those independent facets. Live-gate checks under KIX_REQUIRE_GATE=0 are skipped, never a gate pass.

## Boundaries and deviations

Exact producer field mappings, real price/currency, fees, expiry, cancellation, matching priority, ownership transfer, settlement, persistence/recovery and production integration remain UNDETERMINED. No hardware, venue scanning, live marketplace, payment, KYC, bank rail, credit disbursement, credentials, chain/mainnet, production endpoint or SLO is supplied. Future contract/policy needs trigger root DECISION_REQUIRED.md with options, recommendation and decider. The expressly authorized in-process mock needs no such decision.

Implementation keeps source/controller tests in one adapter suite for cohesive transition and identity assertions. Artwork is SVG/CSS, requiring no bitmap asset or dependency. The existing browser fault-build harness is extended for adversarial source answers. The shared connectivity read group now follows the active reader route, so a reused page-load port displays its cached-read reason on product navigation. Legacy desk/controller chunks share compression to preserve the unchanged bundle budgets. The fixture screen inventory adds explicit no-fixture-pass rows without changing catalogue receipts or pins. These are implementation organization choices within the design scope. Full browser qualification remains blocked by host clock jumps; see root `DECISION_REQUIRED.md` and the final results below.

## Verification commands and results (2026-11-02 KST, verification rerun)

Every npm/npx command below ran with `PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH` (Node v22.20.0). Browser commands also use `KIX_E2E_CHROME=/usr/bin/google-chrome` (Chrome 156.0.8078.47) and `KIX_E2E_NO_SANDBOX=1`, only for the container browser harness. They run foreground, with loopback harness servers. No git commit, push, PR, issue or comment was made.

| Command actually run | Result |
| --- | --- |
| `git diff --check` | PASS, no whitespace errors. |
| `npx vitest run --root packages/protocol-adapter test/resale-market.test.ts` | PASS, 15 marketplace source/controller tests. |
| `npx vitest run test/resale-market.test.tsx test/route-registry.test.tsx test/connectivity-write-guard.test.ts test/i18n-coverage.test.ts test/form-validation.test.tsx` (cwd `apps/web`) | PASS, 78 tests across five files. |
| `npm ci` | PASS; 422 packages installed. npm audit reports 24 findings (21 moderate, 1 high, 2 critical) across all dependencies; the production-only `audit:warn` gate reports 0. No dependency or lockfile change was authorized or made. |
| `npm run typecheck` | PASS, adapter and web. |
| `npm run build` | PASS, adapter typecheck and web production build (`vite build` in 8.90s). |
| `KIX_REQUIRE_GATE=0 npm test` | PASS; adapter and web suites exit 0 (web: 101 files / 1,419 tests; separate entry suite 6 tests). Live-gate checks under `KIX_REQUIRE_GATE=0` are skipped, never a gate pass. |
| `npm run typecheck:e2e` | PASS. |
| `npm run lint` | PASS, eslint flat config over all workspaces and scripts. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS; web lines/statements 93.84, functions 84.72, branches 90.05 percent, all floors met (the adapter suite runs inside the same command). All existing floors unchanged. |
| `npm run deps:check` | PASS, production dependency gate; 4 package manifests and 630 lockfile entries. |
| `npm run audit:warn` | PASS, `npm audit --omit=dev` found 0 production vulnerabilities. |
| `npm run cycle-check` | PASS, no circular imports in any workspace. |
| `npm run budget` | PASS; initialJsGzip 160,220, initialCssGzip 4,974, totalGzip 784,414 (within the 282,000/290,000 initial-JS, 5,000 CSS, 30,000 chunk, 785,000 entry and 790,000 total caps); largest lazy chunk 27,513; 88 files / 78 chunks. `bundle-budget.json` unchanged. |
| `npm run test:e2e` | PASS on the fourth unchanged run: 48 files / 207 tests, including `resale-market.e2e.test.ts` (bilingual search and pagination, all four simulated flows, test-only reject/lost/wrong-side/held fault ports with one dispatch and zero later writes after UNKNOWN, offline/reconnect and locale change under the fence). Runs 1-3 each failed with exactly one 60s timeout in an unrelated pre-existing journey (`organizer-workspace` REJECT, `qualification` UNKNOWN, `FI-B04`); each of those tests passed in the other runs. Cause is CPU starvation on this shared runner (load average 13-18 on 8 vCPUs from co-tenant browser workloads), not this change. No assertion, timeout or retry count was changed. |
| `npm run test:a11y` | PASS, 21 files / 394 tests, including the resale-market bilingual IME/error-summary probe and 320px dark/forced-colour chart checks; keyboard facet 89/89 cells. |
| `npm run test:budget` | PASS on the second unchanged run: 3 files / 9 tests (long-list render caps, chunk failure, route split). The first run stopped mid-suite under the same CPU starvation and its completeness teardown correctly flagged the unrun `budget.render.discovery-ready` check; nothing was relaxed. |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS, 3 files / 123 tests; all 14 committed resale-market/resale-product baselines (both routes, phone/desktop, ko/en, review and result captures, dark and forced-colours) compare equal on this render profile. |

Earlier build-session attempts are recorded separately from these final passes: the initial build exposed discriminant/translation/AsyncState typing mismatches; initial full web tests exposed route/form/document inventory gaps, all fixed while preserving their assertions. The first budget measured 790,819 bytes and failed; consolidating legacy desk and synthetic-controller lazy chunks reduced it without budget edits. Keyboard-denominator assertions were updated from 85 to 89 drives and 55 to 59 NOT_APPLICABLE cells to match four new drives and eight new matrix cells, retaining exact equality checks. No earlier failed attempt is counted as a pass.

The navigation probe found that lazy transitions can keep the previous screen mounted. `App` now publishes committed route departures through a tiny shell-only observer; the page-load controller also captures the browser path before each read/write and rejects a result after an earlier path, even before lazy cleanup. A test-only fault-app probe held one applied simulation, navigated, released the answer and asserted UNKNOWN on return: one dispatch. A returned-product browser assertion waits for its detail read before counting history. The full visual inventory preserves exact count assertions at 108 shots (94 previous plus 14 marketplace additions).

The first complete accessibility run in the earlier build session encountered an existing box-office keyboard test timeout whose host diagnostic reported `monoMs: 17952`, `wallMs: 1265835`, `clockStepMs: 1247883` (a 13,740 ms loop stall under host contention). The complete unchanged rerun above is green: 21 files / 394 tests, marketplace keyboard SUCCESS/REJECT/UNKNOWN drives included.
