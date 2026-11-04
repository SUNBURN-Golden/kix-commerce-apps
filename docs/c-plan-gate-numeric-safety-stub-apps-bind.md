# Gate numeric safety — consumer binding and evidence

## Scope and authority

Node: `c-plan-gate-numeric-safety-stub`. Baseline: `92e9cf448846f5a2f2aac3becfffd45da42a359b` on `agent/kixc-c-plan-gate-numeric-safety-stub`. `contract_change=NO`: these are consumer representation guards, not protocol rules or a new SDK/catalogue consumption.

> M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The booking journey remains `create_event` → `prepare_trade` → `accept_trade`. `capture`, `settle_capture`, `commit_trade`, `open_admission`, and `admit` remain uncomposed by that journey. `placeHold` stays not-bound with considered action `reserve_listing`. No desk method is remapped. Composer tests use existing published fixture bodies; fixture prerequisites are explicitly supplied offline, not additional HTTP writes or authoritative producer evidence.

Only `gate-json.ts`, `payload-guards.ts`, adapter tests, and this document change. The Constraints document path takes precedence over the shorter path in the objective. No CI, budget, dependency, export, HTTP adapter, composer, vendor, `.aiops/`, or `docs/aiops/` edits.

## Representation and processing order

`parseGateJson(text): unknown` keeps the lexical depth preflight before **any** `JSON.parse`. The main parse now uses a reviver that rejects every parsed numeric value for which `Number.isFinite` is false, including root values and nested object/array values. It throws `ProtocolError("Integration gate returned a non-finite number.", "GATE_STATUS")`. Finite values return unchanged, including fractions, large finite exponents, zero and negative zero. Numeric-looking strings remain strings. No clamping, coercion, decimal arithmetic, or substitution with `null` occurs.

The existing decoded-key/string scan follows parsing. A depth-33 body containing overflow still fails the depth preflight first; overflow at depth 32 reaches the numeric guard. A parsed overflow beside an unsafe key or lone surrogate produces the numeric error first. If a later duplicate property overwrites an earlier overflow, the reviver sees only the final property value; the unchanged duplicate-key scan still rejects that body as unsafe JSON.

`isCatalogueReceipt` alone changes its sequence requirement from `Number.isInteger` to `Number.isSafeInteger`. The exact five receipt keys remain `domain`, `operationId`, `sequence`, `action`, `result`: pinned domain, matching string operation/action, safe numeric sequence, non-array result object, plus existing downstream result validation. Sequence zero, negative zero, negative safe integers and both safe boundaries are accepted. No sign, monotonicity, positivity or business policy is added. Other finite numeric fields do not acquire a safe-integer restriction.

The transport/trace/header checks still precede bounded response reading, fatal UTF-8 decoding, depth preflight, JSON parse/reviver, decoded-key/string scan, and payload/status/receipt interpretation. The response ceiling remains **1,048,576 bytes** and maximum value depth **32**. HTTP wrapping attaches the exchange request/correlation IDs to numeric failures. Only validated HTTP 400/422 bodies with `rejected: true` and a nonblank string `error` prove rejection. Numeric corruption after dispatch stays `UNKNOWN`/`GATE_STATUS`, never `REJECTED` or `NOT_SENT`.

## Case matrix and acceptance mapping

All overflow/unsafe-sequence tokens below are inserted as **raw JSON text**. `JSON.stringify(Infinity)` would produce `null`, and unsafe JS literals may already have rounded; neither is used to construct corrupt numeric evidence.

| Raw input / placement | HTTP status or path | Expected result | Traces / request count / fence | Test evidence |
| --- | --- | --- | --- | --- |
| `1e400`, `-1e400` at root, property, array element and mixed nesting | Parser | Numeric `GATE_STATUS` | No dispatch | `gate-json.test.ts`: finite JSON numbers |
| Both overflow signs in object/array/mixed depth 32; depth 33 | Parser | Numeric error at 32; depth error before any parse at 33 | No dispatch | Same suite; JSON.parse spy |
| Finite maximum, exponents, fractions, `0`, `-0`, strings and mixed arrays | Parser | Values preserved | No dispatch | Same suite; existing finite depth controls |
| `9007199254740992`, `9007199254740993`, negative counterparts, `1e20` in `sequence` | Receipt guard and HTTP 200 | Receipt `GATE_STATUS` | Matching trace IDs; one fetch | `gate-numeric-safety.test.ts`: receipt sequence representation |
| `1.5`, `"1"`, `null`, `true` in `sequence` | Receipt guard and HTTP 200 | Existing invalid receipt rejection | Matching trace IDs; one fetch | Same suite |
| `0`, `-0`, `1`, `-1`, `9007199254740991`, `-9007199254740991` in `sequence` | Receipt guard and HTTP 200 | Valid receipt | One fetch | Same suite |
| Nested overflow under successful receipt result | HTTP 200 | Numeric `GATE_STATUS`, composer `UNKNOWN` | Exact operation/body and trace identity; one fetch; next action `FENCED`/`halted` | Four-composer numeric matrix |
| Nested overflow diagnostics beside valid rejection markers | HTTP 400, 422 | Numeric `GATE_STATUS`, composer `UNKNOWN`; not `GateRejectedError` | Same trace, one-fetch and fence assertions | Four-composer numeric matrix |
| Every unsafe sequence token in otherwise-valid target receipts | HTTP 200 | Receipt `GATE_STATUS`, composer `UNKNOWN` | Same trace, one-fetch and fence assertions | Four-composer numeric matrix |
| Finite diagnostics / numeric-looking strings beside valid rejection markers | HTTP 400, 422 | `GateRejectedError` with original rejection code | Matching trace IDs; one fetch | Finite diagnostics controls |
| Finite `1e20` in unrelated result field | HTTP 200 | Valid receipt | One fetch | Unrelated finite-number control |
| Nested overflow in valid probe bodies | `/health`, `/ready` | Numeric `GATE_STATUS` | Matching trace IDs; one GET; no retry | Numeric response guards |
| Finite exponents/fractions/zero/negative zero and strings in probe diagnostics | `/health`, `/ready` | Valid probe | One GET | Numeric probe controls |

The four-composer matrix exercises `BookingJourney.prepareTrade`, `GiftTransfer.acceptGift`, `OrganizerConsole.closeSales`, and `ConsentBind.authorizeMarketing`. Confirmed progress stays respectively at `create_event`, offered/unresolved, no confirmed organizer command, and consented/not authorized. Each UNKNOWN retains the full target identity and halts; a subsequent dependent call returns `FENCED` with reason `halted`, changes no state, invokes no invoker and sends no fetch. The adapter metadata stays HTTP/non-production with no funds, live chain, public deployment, production conformance or protocol truth.

Each target uses injected `createFakeLoopbackGate` fetch on `http://127.0.0.1:8765`, asserts the exact POST URL and `{ operationId, actor, action, body }` envelope, `redirect: "manual"`, absence of `Idempotency-Key`, nonempty request/correlation IDs and exactly one request. No fallback, retry, redirect following, gate proxy or UI fetch is introduced. Existing UTF-8, response bounds, transport, replay, composer conformance and no-bypass tests supplement these assertions.

## Unchanged pin tuple and locked files

No producer catalogue, gate or SDK change is consumed. Fixture catalogue **v2** and the existing SDK consumption/release/handoff tuple remain unchanged, including:

| Item | Preserved value |
| --- | --- |
| Domain / action count | `kix:fixture:lifecycle:0.3` / 40 |
| Contract-only OpenAPI SHA-256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Integration-gate OpenAPI SHA-256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| `protocolMergeSha` and CI `KIX_PROTOCOL_GATE_SHA` | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` |
| SDK manifest SHA-256 | `1cce4ee5a9aa64ef40825c0e6dedf920050e594cf20ea0aaf087ecbde46f0cca` |
| SDK catalogue SHA-256 | `891ddd65f29262603bd0f76746a9308c810a71d4afd717b0f4d2e3f7d46dbaa2` |
| Locked `commerce-bindings.ts` SHA-256 | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` |

## Local verification

Commands run from repository root. The host default was Node v24.22.1 / npm 11.21.1. `npm exec --yes --package=node@22 -- node --version` provided **Node v22.23.4**; all install, test, build and check commands below use its bin directory prepended to `PATH`. Linux kernel: `6.12.94+`. Browser: `/usr/bin/google-chrome`, Google Chrome **156.0.8078.47**.

Logs are local `/tmp/kix-numeric-*.log` files, outside tracked source. All commands execute in the foreground (tool sessions are polled to completion).

The exact narrow command was:

```bash
KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- \
  test/gate-json.test.ts test/gate-numeric-safety.test.ts \
  test/gate-utf8.test.ts test/response-bounds.test.ts \
  test/http-transport-hardening.test.ts test/loopback-replay-conformance.test.ts \
  test/composer-loopback-conformance.test.ts test/no-bypass.test.ts
```

| Command actually run | Result |
| --- | --- |
| `npm exec --yes --package=node@22 -- node --version` | PASS: v22.23.4 |
| `npm ci` | PASS: 535 packages added, 539 audited; lockfile unchanged |
| Narrow command above, first run | FAIL: 480 passed, 1 failed; a new test incorrectly expected the reviver to see an overwritten duplicate value |
| Narrow command above, corrected rerun | PASS: 8 files / 482 tests, including 90 parser and 78 numeric HTTP/receipt/probe/composer tests |
| `npm run typecheck` | PASS: adapter and web |
| `npm run build` | PASS: adapter typecheck, web typecheck and Vite build |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 74 files / 2,125 tests passed, 5 live-gate files / 23 tests skipped; web 104 files / 1,468 tests plus 6 entry tests passed (3,599 passed total) |
| `npm run budget` | PASS: initial JS 160,170; initial CSS 4,974; total 784,798 gzip bytes; largest noninitial JS chunk 27,516; 86 measured files / 76 chunks |
| `npm run lint` | PASS |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all unchanged floors; adapter lines/statements 91.60%, functions 97.79%, branches 85.70%; web lines/statements 93.86%, functions 84.89%, branches 90.25% |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries |
| `npm run cycle-check` | PASS: no circular imports in any workspace |
| `npm run audit:warn` | PASS (warning-only command): production audit found 0 vulnerabilities |
| `npm run typecheck:e2e` | PASS |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-numeric-browser-record.json npm run test:e2e` | PASS: 48 files / 215 tests |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-numeric-a11y-record.json npm run test:a11y` | PASS: 21 files / 395 tests; automated observation only, not user acceptance or conformance |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-numeric-browser-budget-record.json npm run test:budget` | PASS: 3 files / 9 tests; landing JS 391,283 gzip bytes; render maxima 468 / 400 / 468 ms against unchanged 5,000 ms tripwires |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-numeric-visual-record.json KIX_VISUAL_OUT=/tmp/kix-numeric-visual-out npm run test:visual` | PASS: 3 files / 123 tests (108 screenshots plus 15 harness checks), profile `linux-d29b2e9b`, zero differing pixels; no baseline updates |
| `git diff --check` | PASS |
| `git --no-optional-locks status --short` and Python allowlist assertion using `git diff --name-only HEAD` / `git ls-files --others --exclude-standard` | PASS: exactly the five allowed files changed |
| `git diff --exit-code HEAD --` restricted metadata, locked binding, vendor, pin/tuple, CI, budget and lockfile paths | PASS: byte-identical to baseline |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: expected `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, checked before and after work |

The existing ceilings remain initial JS 290,000, initial CSS 5,000, each route chunk 30,000, landing JS 400,000 and total gzip 790,000 bytes. No baseline or limit was changed. `npm ci` reported 24 all-dependency audit findings (21 moderate, 1 high, 2 critical), deprecation notices and an esbuild install-script notice; no dependency changes were made. The production-only audit above is clean. Vite emits a non-failing existing marketing chunk-cycle warning; import-cycle checks pass. Browser builds also emit non-failing EventEmitter listener warnings. Browser measurements are local regression observations, not SLOs or qualification. All four browser records report zero non-loopback requests, non-GET requests and app network calls. Existing accessibility acceptance/conformance/release claims remain false.

Deviations: the duplicate-key precedence test was corrected as described above; the design's implementation and file scope are unchanged. Node 22 was obtained through npm because the host defaults to Node 24. Live producer checks are skipped as described below.

## Limitations and STOP boundaries

Product prices, fees, retention, compensation, and authoritative UNKNOWN resolution stay **UNDETERMINED** or outside scope. This does not guarantee arbitrary-precision or decimal-exact JSON, nor add safe-integer constraints to unrelated numbers. It does not establish sequence positivity/order or protocol semantic conformance.

Stub remains default; local HTTP success is not production approval, payment, issuance or admission. No real payments, KYC, disbursement, venue scanning, bank rail, live marketplace, public deployment, secrets, copied protocol math or SLOs are introduced. No producer repository is modified. A new protocol/schema/command, unmerged dependency, product policy value, locked-binding edit, paid resource, hardware, credential or production runtime would require a separate decision under the node STOP rules; none is needed here.

Live-gate execution is **skipped, never passed**: this node's evidence is offline injected fetch/stub evidence and does not check out or start kix-protocol. Supervisor verification of Commerce apps CI at the eventual delivery HEAD remains separate from these local results. No commit, push, PR, issue, comment, or ASTRA marker is produced by the builder.
