# Resale market intent validation (stub)

## Scope and ruling

Standalone node `c-plan-market-intent-validation-stub`, baseline `1b42402018618a7da4c69c2ba750606383830555`, branch `agent/kixc-c-plan-market-intent-validation-stub`. This is app-internal runtime hardening: **contract_change=NO**. The four existing intent kinds, port/controller TypeScript signatures and HTTP NOT_BOUND behavior remain in place. No protocol command, desk mapping, producer policy or production authority is added.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The journey ends at `accept_trade`; `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission` and `admit` remain uncomposed. `placeHold` stays not-bound with considered action `reserve_listing`; the locked bindings remain byte-identical.

Source discrepancies: the Objective names `docs/market-intent-validation-stub-apps-bind.md`; this document uses the explicit Constraints path, `docs/c-plan-market-intent-validation-stub-apps-bind.md`. This checkout's `.aiops/program.json` contains **60 nodes**, not the supplied context's 18, and does not contain this node. The explicitly supplied standalone node specification authorizes this work; no pending/draft node is implemented and program metadata is untouched. This follows the same provenance treatment as [market evidence isolation](c-plan-c-market-evidence-isolation-stub-apps-bind.md).

Existing behavior and boundaries are described in [resale market UI](c-plan-c-resale-market-ui-stub-apps-bind.md) and [market evidence isolation](c-plan-c-market-evidence-isolation-stub-apps-bind.md). The Wave 6 gate record remains [kix-protocol #56](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343); `kix-protocol/docs/decisions/PROGRAM_ROADMAP_20260930.md` remains producer context. Neither is changed or newly consumed here.

## Exact app-internal intent shape

`captureMarketIntent(unknown)` captures a validated detached record for the controller and source; `validMarketIntent(unknown)` uses that same implementation as a total type guard for semantic validation and tests. Both exports are app-internal and are not added to the package entrypoint. The capture catches reflective failures and returns null; the guard returns false. Only records with `Object.prototype` or null prototype and exactly the five required own data fields pass. `Reflect.ownKeys` and property descriptors reject inherited required fields, accessors, symbols and any extra key (including non-enumerable extras or fields explicitly set to undefined). The guard never invokes a getter. No coercion or normalization occurs.

| Field | Rule |
| --- | --- |
| `kind` | Exactly `bid`, `ask`, `instant-buy` or `instant-sell` |
| `productId`, `variantId` | String length 1–100, with non-whitespace text; retain exact identity |
| `expectedVersion` | Nonnegative safe integer strictly below `Number.MAX_SAFE_INTEGER`, allowing one safe increment |
| `mockUnits` | Required only for bid/ask: existing canonical syntax, `0` or a nonzero-leading ASCII integer string up to 30 digits |
| `quoteId` | Required only for instant-buy/instant-sell: string length 1–100, with non-whitespace text; exact reference |
| Other fields | Forbidden; quoteId is forbidden on offers and mockUnits on instant actions, even when undefined |

Zero and exact 30-digit amounts remain valid. No positivity, currency, fee or form-length policy is introduced. `MAX_SAFE_INTEGER - 1` is writable; a detail at `MAX_SAFE_INTEGER` is still readable but has no safe next write. Existing read/response validators are not globally tightened.

Validation and capture share one descriptor traversal, returning a new record containing only the validated primitive field values. This avoids duplicate preparation code and reads no original property getters. Required non-enumerable data fields are retained, rather than silently dropped by structuredClone. The controller freezes the captured request, never the caller's object; the mock uses its independently captured record. Because every accepted field is primitive, descriptor capture is the complete request clone; no redundant structuredClone is needed for that request. Preparation faults are contained before dispatch or mutation.

## Precedence and transitions

Controller precedence is **busy/fenced → NOT_BOUND → invalid shape/preparation → freshness/detail → semantic rejection → dispatch**. Preparation is attempted safely to retain a valid request identity on NOT_BOUND, but failure cannot replace the NOT_BOUND result. After a NOT_BOUND read, every input yields NOT_BOUND with zero port submissions; malformed/unpreparable input has `outcomeRequest: null`. Busy and UNKNOWN suppression run before inspecting any new input.

Otherwise malformed controller input yields `REJECTED`, code `INVALID_INPUT`, `outcomeRequest: null`, without IN_FLIGHT publication, dispatch or a fence. Valid freshness/semantic rejections and NOT_BOUND retain their captured identity. A missing/stale detail rejects valid input with STALE_VERSION. Semantic order is PRODUCT_MISSING, VARIANT_MISSING, STALE_VERSION, then quote checks. Validated descriptor capture also starts `intentRejection`, before property access or semantics.

Quotes resolve only the supplied exact quoteId. Product, variant, current detail/quote version and direction must agree: buy consumes ask, sell consumes bid. Missing/mismatched references yield QUOTE_MISMATCH; an otherwise matching unavailable quote yields QUOTE_UNAVAILABLE. No substitute is selected.

The mock independently validates before product lookup, quote consumption, collection changes, version changes or sequence allocation. Design review option **(a)** is selected: all malformed direct mock submissions reject their promise with `Error("INVALID_INPUT")`, including null/arrays, unknown kinds, uncloneable data and preparation faults. This avoids echoing an untrusted value as a typed request and avoids invoking accessors while cloning malformed input. Shape-valid semantic failures keep the existing REJECTED envelope with the captured valid request. The existing malformed-amount regression now asserts this direct-boundary error explicitly. Semantic rejection envelopes own their captured request and need no redundant clone.

Only explicitly recognized actions can mutate: bid/ask append one open offer, instant-buy/instant-sell consume one selected quote and append one simulated trade. Every valid mutation increments one product version and its quote versions once; unrelated products and chart series stay unchanged. A catch-all branch can never create a trade.

The controller retains its already detached, recursively frozen accepted detail across the await; later reads cannot alter that immutable reference, so a second deep clone of it is redundant. After dispatch, response detachment, freezing, validation, generation/context adjudication and UNKNOWN fencing stay in their original try/catch. Corrupt responses remain UNKNOWN / UNCONFIRMED_RESPONSE, fenced and STALE; they cannot be reclassified as pre-send INVALID_INPUT. The isolation fixtures now dispatch a clean valid bid, then inject Map/function faults at the receipt root or corrupt its version. Exactly one dispatch, unchanged version floor and subsequent suppression remain asserted.

## Acceptance evidence

| Requirement | Regression evidence |
| --- | --- |
| Unknown kind with a valid available bid quote | Unknown strings, non-string discriminants, null and arrays exercise guard, controller and direct source |
| Exact required/forbidden fields and identifiers | Every kind's missing fields, arbitrary extras/metadata, both payloads, undefined forbidden fields, empty/whitespace/101-character/non-string identifiers |
| Hostile runtime objects | Inherited fields, classes, Map/Date prototypes, symbol/non-enumerable extras, throwing/revoked proxies; getters are never called |
| Versions and canonical units | Negative/fractional/string/NaN/infinite/unsafe/successor-overflow versions; signs, leading zeros, exponent/decimal notation, Unicode digits, line breaks, nonstrings and 31 digits; valid zero and 30-digit controls |
| Zero pre-send effects | Each malformed case asserts zero submit calls, no IN_FLIGHT, INVALID_INPUT with null identity and no fence |
| Zero mock effects or allocations | Each malformed case compares all three complete product details, then compares subsequent offer and trade receipts/IDs against a clean source |
| Four valid actions | Controller and direct source agree on exact record, quote effect, one version increment, unchanged series and unrelated products |
| Semantic/reference rejection | Exact product/variant/version precedence; missing/foreign/wrong-variant/wrong-side quote IDs; current quote version and unavailable matching reference |
| UNKNOWN preserved | Repaired post-dispatch built-in/clone/version fixtures, busy malformed duplicate and UNKNOWN malformed resubmit preserve fence and one-send evidence |
| HTTP NOT_BOUND preserved | All malformed cases stay NOT_BOUND after its read, zero dispatch; direct HTTP port stays NOT_BOUND as well |
| Protected checks | Verification and byte/scope comparisons below; floors, budgets and CI are unchanged |

## Verification ledger

Verification uses Node **v22.20.0** (`PATH=/tmp/kix-m05-node22/node_modules/node/bin:$PATH`), npm **11.21.1** and Chrome **156.0.8078.47** at `/usr/bin/google-chrome`. Commands run sequentially in the foreground; no long job is backgrounded. Local command logs and the exit ledger are under `/tmp/kix-market-intent-validation/`. Browser runs use the repository loopback harness with `KIX_E2E_CHROME=/usr/bin/google-chrome` and `KIX_E2E_NO_SANDBOX=1`; visual updates stay disabled.

Earlier failed attempts are kept separately from passes. The first focused run had 212 passes and one fixture failure: a synthetic boundary receipt mistakenly spread detail-only fields into the receipt. Removing those extra fields restored the intended valid confirmation. The first typecheck found a test-only union excess-property error on a quoted intent; using the existing untrusted-input helper fixed it. The first full stub run had 2,296 adapter passes and 1,497 web passes, with one web failure at the unchanged 785,000-byte emitted-assets cap (785,157 bytes). The second full run failed only that same cap at 785,068 bytes. During local deduplication, eight focused entry tests failed at 785,107; 785,109; 785,008; 785,026; 785,012; 785,044; 785,035; and 785,088 bytes. All corresponding Vite builds and the general budget command succeeded; a general-budget pass was never treated as passing the tighter test. Shared uniqueness checks then brought the total to 784,966 bytes and the focused entry test passed. The following full stub run passed all suites, but lint rejected a non-null quote assertion. Replacing it with an explicit INVALID_INPUT check passed lint and reduced the final total to **784,915 bytes**; the focused entry test passed again. No failed attempt is counted as a pass and no cap, assertion, timeout, baseline or coverage floor was relaxed.

Commands used during these iterations were the same focused adapter command listed below, `npm run typecheck`, `npm run build`, `KIX_REQUIRE_GATE=0 npm test`, `npm run lint`, `npm exec -w @kix/web -- vite build`, `npm run budget`, and `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts`. Successful repeated focused runs grew from 213 to 215 tests after two additional exact-key regressions. All eight direct Vite builds during the budget iterations and the later lint-fix Vite build passed. The raw per-attempt command, exit code and label ledger is `/tmp/kix-market-intent-validation/ledger.tsv`; the initial installation, initial failed focused run and initial typecheck have separately named logs in that directory.

Final source verification (all exit 0 unless the earlier-attempt section explicitly records a failure):

| Command actually run | Result |
| --- | --- |
| `npm ci` | PASS: 535 packages installed; npm reported 19 all-dependency audit findings. Lockfile/manifests unchanged; production audit result below. |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/resale-market-intent-validation.test.ts test/resale-market.test.ts test/resale-market-controller-isolation.test.ts` | PASS: 215 tests across 3 files (173 validation + 20 existing market + 22 isolation). |
| `npm run typecheck` | PASS: adapter and web; rerun on final source. |
| `npm run build` | PASS: adapter typecheck and web production build; rerun on final source. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 2,298 tests; web 1,498 tests plus 6 cold-load tests. 23 live-gate tests skipped intentionally, not gate passes. |
| `npm run lint` | PASS after replacing the non-null assertion with an explicit check. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: adapter lines/statements 91.61%, functions 97.79%, branches 85.77%; web lines/statements 94.06%, functions 86.22%, branches 90.43%. Both changed source files have 100% lines/statements/functions coverage (controller branches 97.77%; market branches 94.60%). All floors unchanged. |
| `npm run budget` | PASS: initial JS 160,179 gzip bytes; CSS 4,974; total 784,915; largest lazy chunk 27,516; 86 files / 76 chunks. All initial, route and growth limits unchanged. |
| `npm exec -w @kix/web -- vitest run test/entry-import-graph.test.ts` | PASS: both tests, including the stricter 785,000-byte total cap. |
| `npm run deps:check` | PASS: 4 manifests and 630 lockfile entries. |
| `npm run cycle-check` | PASS: no circular source imports. The Vite build still reports the existing M05CrmWorkspace / marketing-stubs circular-chunk warning; no build configuration was changed. |
| `npm run audit:warn` | PASS (warning-only): 0 production vulnerabilities. |
| `npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=<log dir>/e2e-record.json npm run test:e2e` | PASS on the third attempt of this verification round (the fourth overall): 218 tests across 49 files. All earlier attempts failed only on unrelated 60-second timeouts under shared-runner load (`assistant` REJECT; resale `lost`; then `offline-connectivity`, `shared` session UNKNOWN and `credit` RECOVERY). An isolated rerun of `tests/journeys/resale-market.e2e.test.ts` passed all 14 tests; that subset run necessarily fails the suite-wide evidence teardown and is not counted as a suite pass. Record: `nonLoopback: 0`, `nonGet: 0`, `appNetworkCalls: 0`; all truth claims false. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=<log dir>/a11y-record.json npm run test:a11y` | PASS on the third attempt: 395 tests across 21 files. The two earlier attempts each failed only on unrelated timeouts (`keyboard-outcomes` live probe and `locale` catalogue; then `gallery` axe scan and `keyboard-outcomes` booking REJECT). No axe-violation or assertion failure occurred in any attempt. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=<log dir>/budget-record.json npm run test:budget` | PASS first attempt: 9 tests across 3 files. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_UPDATE=0 KIX_VISUAL_RECORD_OUT=<log dir>/visual-record.json KIX_VISUAL_OUT=<log dir>/visual-out npm run test:visual` | PASS on the second attempt: 123 tests across 3 files. The first attempt failed only on a 60-second timeout in `buyer.phone.en.light`; no pixel mismatch occurred in any attempt. |
| `git diff --check` | PASS: clean. |

The flaky browser timeouts above are environment load on this shared runner (other worktrees' browser suites run concurrently); the failed test names differ on every attempt, none touches the resale intent path, and none recurred. They are recorded here as failed attempts, not passes. Rerun logs for this final verification round are under `/tmp/kix-miv-verify/` alongside the earlier `/tmp/kix-market-intent-validation/` ledger.

Final uncommitted source identities (SHA-256): `resale-market.ts` = `fc6304be28db365afcacdbeb5906275ae45efac53e5a60957c036bb61ac348b6`; `resale-market-controller.ts` = `822bacfd948e3db27f396b8b5a0ca2207cca409f1931dadb2b95b1c8572167e7`. Baseline HEAD stays `1b42402018618a7da4c69c2ba750606383830555`; no commit, push, PR, issue or comment is created.

## Deviations and unresolved boundaries

The explicit Constraints document path takes precedence over the Objective's shorter path. Direct malformed mock inputs use design review option (a), a uniform INVALID_INPUT error, rather than the initial plan's cloneable-envelope/uncloneable-error split. Sharing descriptor validation and capture preserves non-enumerable required data and keeps bundle growth within existing limits. The baseline's existing malformed-amount test is updated for the selected direct error behavior. The repeated Set-size uniqueness checks share a local helper with identical validation semantics. Freshness/semantic rejection publication shares one branch, and the four mutation kinds use an explicit switch with shared product/variant fields. These deduplications are confined to the two authorized source files to satisfy the unchanged 785,000-byte entry test cap as well as the general budget. These are local implementation choices; no scope or contract expansion is required.

Producer mappings, real pricing/currency, fees, expiry, matching policy, ownership transfer, settlement, persistence/recovery and production integration remain **UNDETERMINED**. Qualification remains UNQUALIFIED, acceptance PENDING and release NOT_AUTHORIZED. No catalogue/gate change is consumed; both OpenAPI pins, PINNED_ACTIONS, CI KIX_PROTOCOL_GATE_SHA and protocolMergeSha remain unchanged and would have to move together for a future authorized update.

README fail-closed boundaries remain: stub default, explicit loopback http://127.0.0.1 only, one attempt, false production/truth flags, no retry, Idempotency-Key, redirect following, fallback, gate proxy or UI fetch. No funds, payment, public deployment, real KYC, credit disbursement, venue scanning, bank rail, live marketplace, SLO, secret, or copied Move/kernel/settlement math is introduced; kix-protocol remains read-only context. An unmerged dependency/contract, new protocol command, hardware, paid service, credential, production runtime, product policy value or boundary crossing requires root DECISION_REQUIRED.md with need, options, recommendation and decider. None is needed for this implementation.
