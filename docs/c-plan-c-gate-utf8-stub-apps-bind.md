# c-plan-c-gate-utf8-stub — strict gate response UTF-8

## Scope and ruling

The HTTP response reader now rejects malformed UTF-8 after its bounded read reaches EOF, before interpreting JSON, rejection bodies, receipts, or probes. This is an app-local response guard over the existing pinned wire contract. It adds no protocol command, schema, dependency, policy value, or desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

`BookingJourney` still composes only `create_event` → `prepare_trade` → `accept_trade` through `invokeLocalCall`. `capture`, `settle_capture`, `commit_trade`, `open_admission`, and `admit` remain uncomposed by that journey; their not-bound reasons remain recorded. `placeHold.consideredAction` remains `reserve_listing` and `placeHold` remains not-bound. `prepare_trade` is never a new `placeHold` mapping.

The recorded base is `e9d226d4b1253e5a4e4b3d652cb402aa4ec8654f`. The locked `packages/protocol-adapter/src/commerce-bindings.ts` SHA-256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

## Processing and error order

The existing order remains: transport/origin/echoed-trace checks → actual-byte bounded read through EOF → **fatal UTF-8 decode** → depth preflight and JSON checks → remote payload guards → rejection or receipt validation.

`readGateResponseText(response, signal)` retains its signature, the 1,048,576-byte ceiling, depth limit 32, EOF requirement (including exactly the byte ceiling), cancellation, and abort-listener/reader-lock cleanup. Only the decoder operation is caught and normalized to `ProtocolError("Integration gate returned invalid UTF-8.", "GATE_STATUS")`. Stream interruption remains `GATE_UNAVAILABLE`; exchange timeout remains `REQUEST_TIMEOUT`. The existing HTTP reader-error branch adds the original request and correlation IDs; it needed no edit. A dispatched write with invalid response bytes remains `UNKNOWN`, and a later dependent write is `FENCED`.

Valid UTF-8 is decoded once after chunks are joined. Default BOM stripping remains. Literal UTF-8 U+FFFD and JSON `\uFFFD` escapes remain accepted; U+FFFD itself is not a malformed encoding.

The published POST path `/x-kix-contract-only/local-call`, envelope `{ operationId, actor, action, body }`, and exact receipt `{ domain, operationId, sequence, action, result }` remain unchanged. An explicit rejection still requires HTTP 400/422, a non-array object, `rejected: true`, and a nonblank string `error`, after all preceding validation. `/health` and `/ready` remain process probes only.

## UTF-8 case matrix

`gate-utf8.test.ts` constructs literal `Uint8Array` vectors between independently encoded JSON prefixes/suffixes. Malformed bytes never pass through a JavaScript string before the response reader sees them.

| Class | Bytes (hex) | Delivery and placement |
| --- | --- | --- |
| Invalid continuation | `C3 28`, isolated `80` | Whole body and one byte per chunk |
| Overlong encoding | `C0 AF`, `E0 80 AF`, `F0 80 80 AF` | Whole body and one byte per chunk |
| Encoded surrogate | `ED A0 80`, `ED BF BF` | Whole body and one byte per chunk |
| Incomplete sequence before JSON delimiter | `E2 82`, `F0 9F 98` | Whole body and one byte per chunk |
| Incomplete sequence at EOF | `F0 9F 98` with no suffix | Whole body and one byte per chunk |
| Valid Korean and supplementary character | UTF-8 `한글😀` | Every internal byte split in 200/400/422 bodies |
| Explicit replacement code point | `EF BF BD`, JSON `\uFFFD` | Accepted in 200/400/422 bodies |
| Null body / BOM controls | Empty body; `EF BB BF` before valid JSON | Direct reader tests |

Each of the ten malformed vectors is crossed with statuses 200, 400, and 422 and both delivery modes (60 write cases). Success vectors occupy `create_event.result.policyHash`; rejection vectors occupy `error`. Every case asserts the decoding-specific message, `ProtocolError` rather than `GateRejectedError`, both echoed IDs, `UNKNOWN`, no completed step, and a subsequent `prepareTrade` fence. There is exactly one fetch, manual redirect mode, no `Idempotency-Key`, and unchanged HTTP/non-production adapter metadata.

All ten vectors also exercise each direct probe and each transport observation (40 probe cases). Malformed health stops before ready. Valid health followed by malformed ready yields unavailable, with `localFileJournal: null`, false production readiness/conformance/truth/public deployment/durability flags, no retry, and no stub fallback.

## Acceptance mapping

| Acceptance | Evidence |
| --- | --- |
| Malformed success and 400/422 responses cannot become replacement characters in accepted JSON | 60 raw-byte write cases, decoding-specific error assertions |
| Traces and post-send uncertainty survive decoding failure | Error IDs equal the recorded request headers; journey outcome and halt are `UNKNOWN` |
| No dependent write, retry, fallback, or redirect following | `prepareTrade` is `FENCED`; fetch count remains one; metadata and request options asserted |
| Legitimate Unicode remains supported | Korean/supplementary splits, literal and escaped U+FFFD, BOM/null controls |
| Probe failure grants no readiness | 40 direct-probe/observation cases with unavailable state and false flags |
| Existing limits and contract stay intact | Existing response-bounds, transport-hardening, replay, composer, no-bypass, and full adapter pin regressions |
| Budgets, coverage floors, pins, bindings, and CI remain unchanged | Final changed-file review and lock hash comparison; verification below |

## Verification results

Results are local observations on the recorded checkout, not remote CI or live-gate evidence. Node `v22.23.4` was obtained with `npm exec --yes --package=node@22 -- node --version`; npm is `11.21.1`. The default workspace Node was `v24.22.1`, so commands used this PATH prefix:

```bash
PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
```

The initial narrow run encountered four timeouts (new UTF-8, existing response-bounds, replay hook, and composer tests); 357 tests passed. Repeating with `--maxWorkers=2` passed all 361 tests without source changes, timeout changes, or threshold changes. Full stub and coverage runs use `VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1` to constrain local concurrency; these are environment settings, not repository configuration edits.

The exact narrow command (initial run omitted only `--maxWorkers=2`):

```bash
KIX_REQUIRE_GATE=0 npm run test -w @kix/protocol-adapter -- \
  test/gate-utf8.test.ts test/gate-json.test.ts \
  test/response-bounds.test.ts test/http-transport-hardening.test.ts \
  test/loopback-replay-conformance.test.ts \
  test/composer-loopback-conformance.test.ts test/no-bypass.test.ts --maxWorkers=2
```

Commands were run from the repository root with the Node 22 PATH above. Output logs were captured under `/tmp/kixc-utf8-*.log` (local temporary evidence).

| Command | Actual result |
| --- | --- |
| `npm ci` | PASS, exit 0; 535 packages installed. npm reported 24 dependency audit findings including dev dependencies; no dependency files were changed. |
| Narrow command above, without worker cap | FAIL, exit 1; 4 timeouts, 357 passed. |
| Narrow command above, `--maxWorkers=2` | PASS, exit 0; 7 files, 361 tests. |
| `npm run typecheck` | PASS, exit 0; adapter and web. |
| `npm run build` | PASS, exit 0; adapter typecheck, web typecheck and Vite build. |
| `KIX_REQUIRE_GATE=0 npm test` (worker environment above) | PASS, exit 0; adapter 1,959 passed / 23 live-gate tests skipped; web 1,419 passed; cold entry 6 passed. |
| `npm run lint` | PASS, exit 0. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` (worker environment above) | PASS, exit 0; all unchanged floors met. Adapter lines/statements 91.56%, functions 97.77%, branches 85.46%; web lines/statements 93.84%, functions 84.72%, branches 90.06%. |
| `npm run budget` | PASS, exit 0; initial JS gzip 160,206 bytes (ceiling 290,000); total gzip 784,275; CSS, route chunks and total growth pass. |
| `npm run deps:check` | PASS, exit 0; 4 package manifests / 630 lockfile entries. |
| `npm run audit:warn` | PASS, exit 0; production audit reported zero vulnerabilities. |
| `npm run cycle-check` | PASS, exit 0; no circular imports in adapter, web or e2e. |
| `npm run typecheck:e2e` | PASS, exit 0. |
| `npm run test:e2e` | PASS, exit 0; 48 files, 207 tests. |
| `npm run test:a11y` | PASS, exit 0; 21 files, 394 tests; 89/89 applicable keyboard outcome cells. Automated observation, not user acceptance. |
| `npm run test:budget` | PASS, exit 0; 3 files, 9 tests; existing split, chunk-failure, and long-list caps. |
| `npm run test:visual` | PASS, exit 0; 3 files, 123 tests against committed baselines; 108 screenshots MATCH with zero pixel differences on `linux-d29b2e9b`; no baseline or tolerance updates. |
| `git diff --check` | PASS, exit 0. |
| Changed-file whitelist and byte comparison against recorded base | PASS; exactly the four permitted files changed; locked binding bytes and SHA-256 match. All other tracked files, including pins, budgets, coverage floors and CI, remain unchanged. |

Browser commands use `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` with Google Chrome `156.0.8078.47`. The journey record was written using `KIX_E2E_RECORD_OUT=/tmp/kixc-utf8-browser-record.json`. The accessibility record used `KIX_A11Y_RECORD_OUT=/tmp/kixc-utf8-a11y-record.json`. The browser budget record used `KIX_BUDGET_RECORD_OUT=/tmp/kixc-utf8-browser-budget-record.json`. Visual evidence used `KIX_VISUAL_RECORD_OUT=/tmp/kixc-utf8-visual-record.json KIX_VISUAL_OUT=/tmp/kixc-utf8-visual-out`; baseline update mode was not set. Browser suites retain their pinned serial execution, timeouts, retry settings, baselines, and thresholds.

The bind document uses the explicit Constraints path, `docs/c-plan-c-gate-utf8-stub-apps-bind.md`, rather than the shorter path in the objective. Other than this resolved path ambiguity and local worker limits after the initial timeout run, implementation follows the reviewed design. No `http-adapter.ts` edit was necessary: its existing trace-preserving reader-error mapping passed the raw-byte matrix.

## UNDETERMINED and unverified boundaries

Product retention, prices, fees, compensation, and other product policy values remain **UNDETERMINED**. No real payment, real KYC, credit disbursement, bank rail, live marketplace, venue scanning, public deployment, production runtime, or SLO is introduced or verified. Semantic conformance, production readiness, and browser gate access remain unverified. Stub mode remains the default; HTTP remains explicit `http://127.0.0.1` only, with one attempt, no retry, no `Idempotency-Key`, no redirects, no fallback, and false production/truth flags. There is no UI fetch or proxy around the gate.

The private reviewed live gate was not started or tested in this node; `KIX_REQUIRE_GATE=0` deliberately skips those tests. No credential was requested or used. No kix-protocol file, vendored artifact, pin, fixture catalogue, UI, CI, budget, coverage configuration, `.aiops/`, or `docs/aiops/` is changed. No Git commit, push, PR, issue, comment, or ASTRA marker was created.
