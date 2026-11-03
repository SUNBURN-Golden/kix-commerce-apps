# Resale market evidence isolation (stub)

## Scope and ruling

Standalone node `c-plan-c-market-evidence-isolation-stub`, implemented against baseline `c523d09059905e5df3a83e69e64957b066872e77`. This change owns accepted resale evidence and publishes immutable snapshots. It adds no command, mapping, protocol schema, producer policy, or production authority.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The journey still ends at `accept_trade`. `capture` and `settle_capture` are never composed or sent; `commit_trade`, `open_admission`, and `admit` remain uncomposed. `placeHold` remains not-bound with considered action `reserve_listing`. The locked `commerce-bindings.ts` is unchanged.

Source discrepancy: this checkout's `.aiops/program.json` has **60** nodes and does not contain this node, whereas the supplied task refers to 18 nodes. This standalone implementation follows the explicitly supplied node specification. No program metadata or pending/draft node is implemented or edited. The document path follows the spec's explicit Constraints section.

## Ownership and snapshot identity

The controller clones each response into its own graph before validation, version advancement, or publication. Read generation/context checks still run before detachment. A controller-local, cycle-safe traversal accepts only plain records, arrays, and primitive values in detached graphs and recursively freezes them. Mutable built-ins (`Map`, `Set`, `Date`, typed arrays, buffers, and other non-plain objects) are refused, including those hidden in extra list/detail payload fields the existing validator permits. Freezing a built-in alone would not protect its internal contents. Port-owned objects stay mutable; they are never frozen by the controller. Implementation detail relative to the plan: object-type admission and freezing share one traversal immediately after detachment, before the existing semantic validators; failure classification and version-commit ordering are preserved. This incorporates the design review correction without changing shared validators.

An unsafe, uncloneable, or invalid read follows the existing `error` / `STALE` path. An unsafe, uncloneable, invalid, or late post-dispatch write becomes `UNKNOWN` / `UNCONFIRMED_RESPONSE`, `fenced: true`, and `STALE`. No version is advanced before successful detachment and validation. The private version map and captured write evidence never come from a mutable public view.

The initial state and every replacement are deeply frozen. `state()` returns the stored root and `detail()` returns its stored detail subtree without allocation. Deeply readonly return types cover nested records and arrays. An update with all patched fields equal by `Object.is` publishes nothing. Real changes replace the root before notifying subscribers. Outcome-only changes retain detail identity; old snapshots keep their original values. Generation invalidation still runs even when publication is unnecessary.

The synchronous busy/fenced guard, cloned frozen intent, captured detail, generation/context checks, and private version floor remain in force. Busy is set before IN_FLIGHT notification, so a subscriber's reentrant submit cannot dispatch twice. Reads and navigation never clear a page-load UNKNOWN fence. The web panels derive their readonly detail/series types from the controller; `useSyncExternalStore` continues using its stable accessors directly.

## Existing interfaces and routes

- `read(ResaleMarketRead): Promise<{ kind: "APPLIED" | "IGNORED" }>`
- `submit(ResaleMarketIntent): Promise<void>`
- `subscribe(() => void): () => void`, `invalidate(): void`
- `state(): MarketState` (deeply readonly), `detail(): DeepReadonly<ResaleMarketDetail> | null`
- Routes: `/resale/market` and `/resale/market/:productId`.

List/detail requests, products and variants, quote identity/side/mock units/version/availability, histories, chart series, and intent fields retain their existing schemas. All five false flags in `MARKET_CLAIMS` remain false: `fundsExecuted`, `economicFinalityClaimed`, `productionEndpoint`, `protocolTruth`, and `productionConformance`. Default mode stays stub; integration-http reads and writes remain NOT_BOUND.

## Acceptance/evidence matrix

| Acceptance | Executed regression evidence |
| --- | --- |
| Retained port responses cannot alter accepted evidence | New adapter suite mutates original list products/variants/request/claims and detail identity, variants, quote identity/side/units/version/availability, offers, trades and series. Controller values remain equal to the accepted snapshot; exact dispatch uses the accepted quote. |
| Public snapshots cannot change guards | Recursive write/delete/redefinition and array attacks exercise every published layer, including state outcome/fenced/freshness/snapshot, echoed requests and detail collections. Actual unavailable-quote, variant and stale-version guards reject without dispatch. |
| UNKNOWN cannot be unlocked | Lost-after-effect write, subscriber mutation attacks, direct fence/outcome/freshness attacks, reads and navigation retain UNKNOWN and permit only one send. Mounted web controls stay disabled after a current read. |
| Dispatched intent and receipt matching remain original | Deferred writes mutate the caller's input and retained read evidence. Exact dispatch stays original, the original receipt confirms, and a receipt matching mutated fields becomes UNKNOWN. |
| Stable identity and normal subscription | Repeated accessors, no-op invalidation/update and ignored old reads retain identity without notifications; real transitions notify with frozen snapshots, preserve old values and unchanged detail references; unsubscribe works. Mounted subscription renders without a loop. |
| Duplicate sends suppressed | Deferred duplicate activation and reentrant IN_FLIGHT subscriber submission send once. Existing duplicate regression retained. |
| Stale reads cannot restore authority | Retained confirmed receipt mutations cannot raise/lower accepted floors. Regressed reads remain STALE, an actual current read succeeds, and unsafe read/write graphs never advance a version. Existing context, out-of-order and connectivity regressions retained. |
| Mutable built-ins fail closed | Parameterized Map/Set/Date/typed-array/ArrayBuffer/SharedArrayBuffer responses fail reads; nested Map write evidence, clone failures and validation failures fence writes. Cyclic invalid read graphs fail closed. Existing validators are unchanged. |
| integration-http remains NOT_BOUND | Controller tests cover a NOT_BOUND read with zero submit calls and a NOT_BOUND write from a current fixture read; existing port regression retained. |
| CI and scope | Actual commands and results below; no CI, dependency, budget, pin, transport, gate, or binding edits. |

## Actual verification

Verification uses Node **22.23.4**, npm **11.21.1**, and Google Chrome **156.0.8078.47**. Node 22 was selected through `npm exec --yes --package=node@22 -- node -p 'process.execPath'` (the environment default was Node 24.22.1); all verification commands run with that Node 22 binary directory prepended to PATH. Tests and browser suites run sequentially in the foreground. Browser runs use `KIX_E2E_CHROME=/usr/bin/google-chrome`, `KIX_E2E_NO_SANDBOX=1`, loopback only, and records under `/tmp/kix-market-isolation-*`.

Initial `npm ci` passed (535 packages); npm reported existing deprecation notices and 24 audit findings. No dependency changes were made. The first narrow adapter run had 27 passes and 10 failures caused by the new attack helper incorrectly expecting `Reflect.defineProperty` to reject redefining an existing `null` as `null`. The helper now always attempts a distinct replacement value; the rerun passed all 37 tests. The first narrow web run passed all 8 tests, and the initial `npm run typecheck` passed. The final verification results, including the failed browser run and its full rerun, follow.

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; dependency/lock files unchanged. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/resale-market.test.ts test/resale-market-controller-isolation.test.ts` | PASS: 37 tests (15 existing + 22 isolation tests). |
| `npm exec -w @kix/web -- vitest run test/resale-market.test.tsx` | PASS: 8 tests, including mounted snapshot/fence regression. |
| `npm run typecheck` | PASS: adapter and web. |
| `npm run build` | PASS: adapter typecheck and Vite web build. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 1,981 + web 1,420 + cold-load 6 tests; 23 gate-dependent tests intentionally skipped with KIX_REQUIRE_GATE=0. |
| `npm run budget` | PASS: initial JS 160,206 gzip bytes, initial CSS 4,974, total 784,394; all existing initial, route and growth limits unchanged. |
| `npm run lint` | PASS: repository ESLint gate. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors. Adapter lines/statements 91.57%, functions 97.78%, branches 85.56%; web lines/statements 93.84%, functions 84.72%, branches 90.08%. |
| `npm run deps:check` | PASS: 4 manifests and 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular source imports. |
| `npm run typecheck:e2e` | PASS. |
| `npm run test:e2e` | FIRST RUN FAILED: 206 passed, 1 marketing-m03.NOT_BOUND timeout. Record reports a 108,837 ms maximum event-loop stall and the single failure coinciding with a host event; 1 pending API call was cleaned up. Full unchanged rerun below. |
| `npm run test:a11y` | PASS: 394 tests / 21 files; 89 of 89 keyboard outcome facets. |
| `npm run test:budget` | PASS: 9 tests / 3 files. |
| `KIX_VISUAL_UPDATE=0 npm run test:visual` | PASS: 123 tests / 3 files, including 108 baseline screenshots; updates disabled. |
| `npm run audit:warn` | PASS (warning-only command): production audit reports 0 vulnerabilities. |
| `npm run test:e2e` (full rerun) | PASS: full unchanged rerun, 207 tests / 48 files. No timeout, test, CI or baseline changes. |
| `git diff --check` | PASS: no whitespace errors. |
| `git diff --exit-code -- .aiops docs/aiops .github/workflows package.json package-lock.json apps/web/bundle-budget.json packages/protocol-adapter/src/commerce-bindings.ts` | PASS: protected paths unchanged. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` plus byte comparison with `git show HEAD:packages/protocol-adapter/src/commerce-bindings.ts` | PASS: byte-identical; SHA-256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |
| Scope assertion over `git diff --name-only` and `git ls-files --others --exclude-standard` | PASS: exactly the five authorized changed files. |

The original failed browser record is preserved at `/tmp/kix-market-isolation-e2e-first-failed-record.json`, and the full rerun has its own `/tmp/kix-market-isolation-e2e-rerun-record.json`. Raw command logs and the command/exit ledger remain under `/tmp/kix-market-isolation-*` (local evidence, not committed). The first timeout is recorded as a failed run, not counted as a pass. The full unchanged rerun is the passing journey evidence. Its record reports zero non-loopback requests, zero non-GET requests, zero app network calls, 43 browsers opened and closed, no surviving resources, and no pending API calls or cleanup errors at teardown.

The live-gate CI job was not run: this is the explicitly requested stub verification, with no protocol checkout or credentials. The 23 gated skips are not live-gate passes. Browser observation remains local synthetic evidence, not accessibility acceptance, production qualification, or an SLO.

## UNDETERMINED and STOP conditions

Producer mappings, real pricing/currency, fees, expiry, matching policy, ownership transfer, settlement, persistence/recovery, and production integration remain **UNDETERMINED**. Evidence isolation does not establish any of them. The immutable snapshot boundary protects against retained-reference mutations; it cannot establish the truth of arbitrary new observations from a malicious producer. Existing validation/version/context rules still adjudicate each new read.

No catalogue/gate update is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` remain unchanged. Any future authorized catalogue/gate consumption must move all of them together.

README fail-closed rules remain: default stub, loopback `http://127.0.0.1` only, one attempt, no retry, Idempotency-Key, redirect following, stub fallback, gate proxy, or UI fetch. All production/truth flags remain false. There are no funds, real payments/KYC/credit, public deployment, venue scanning, bank rails, live marketplace, SLOs, secrets, or copied Move/kernel/settlement math. `kix-protocol` remains read-only context.

An unmerged contract/dependency, new protocol command, hardware/equipment, money/paid services, credentials, production runtime, product policy value, or crossing these boundaries requires root `DECISION_REQUIRED.md` naming the need, options, recommendation, and decider. No such dependency or owner decision was needed here.
