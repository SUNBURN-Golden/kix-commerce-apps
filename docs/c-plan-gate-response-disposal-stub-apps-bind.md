# Gate response disposal — consumer binding and evidence

## Scope and recorded ruling

Node: `c-plan-gate-response-disposal-stub`. Baseline: `20138ca5b5b419fe0f52427630915ff75b0499bd` on `agent/kixc-c-plan-gate-response-disposal-stub`. `contract_change=NO`: this is app-local response cleanup with offline injected fetch evidence. No producer contract or catalogue change is consumed.

> M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

The booking journey stays `create_event` → `prepare_trade` → `accept_trade`. `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission` and `admit` stay uncomposed by that journey. `placeHold` stays not-bound with considered action `reserve_listing`; `prepare_trade` remains only an explicit `invokeLocalCall` body. No desk method is remapped.

Only `packages/protocol-adapter/src/http-adapter.ts`, `packages/protocol-adapter/test/response-bounds.test.ts`, and this document change. The Constraints document path takes precedence over the shorter `docs/gate-response-disposal-stub-apps-bind.md` path in the objective. Locked bindings, pins, fixtures, dependencies, composer implementations, UI, budgets, CI, `.aiops/` and `docs/aiops/` stay unchanged.

## Implementation and error order

The module-private `cancelUnreadResponseBody(response): void` calls `response.body?.cancel()` once and synchronously attaches a rejection handler returning `undefined`. A commented catch handles synchronous cancellation errors. It returns without awaiting cancellation. A null body has no cancellation target: the helper is invoked but no `body.cancel()` call occurs.

The helper runs immediately before each existing rejection, preserving this order and the exact existing messages, codes and sent request/correlation IDs:

1. Followed/opaque/status redirect or foreign/malformed response origin: `GATE_TRANSPORT`.
2. Missing or mismatched echoed request/correlation header: `STALE_RESPONSE`.
3. Missing/incorrect integration-gate transport or production-endpoint header: `GATE_TRANSPORT`.
4. Missing/incorrect protocol-truth or production-conformance header: `PRODUCTION_ENDPOINT`.

The fetch-resolved-after-abort branch uses the same helper and still throws the original signal reason. The defensive missing-signal branch also disposes before its existing `GATE_TRANSPORT` error. Cleanup acquires no reader, drains/parses nothing, aborts no controller and starts no timer. `readGateResponseText()` retains ownership of ingestion cancellation and lock release; it is unchanged.

The wire interface remains POST `/x-kix-contract-only/local-call` with `{ operationId, actor, action, body }` and the same receipt shape; process probes remain GET `/health` and `/ready`. Error identity stays `code`, `requestId`, `correlationId`. Only validated HTTP 400/422 object bodies with `rejected: true` and a nonblank `error` prove business rejection. Cleanup changes none of these rules.

## Case matrix

The direct matrix contains 24 distinct faults × three entry points × six disposal modes = **432 cases**. Modes are resolving, immediately rejecting, never settling, null body, synchronous throw, and deferred rejection after the exchange settles. Non-null cases spy on `body.cancel()` itself and the source cancellation callback. Null cases have no response body or cancellation target; the unused source spies remain untouched.

| Case | Entry point | Cancellation behavior | Expected code | Cancellation calls / source callbacks | Reads/parses | Traces preserved | Fetch count | Subsequent fence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Followed redirect; `opaqueredirect`; statuses 300, 307, 399 | Local call, health, ready | All six modes | `GATE_TRANSPORT` | 1 / 1 normally; 1 / 0 on synchronous throw; 0 / 0 for null | 0 | Yes | 1 | Composer cases below |
| Foreign host, port, scheme; malformed URL | Same three | All six | `GATE_TRANSPORT` | Same | 0 | Yes | 1 | Same |
| Missing/mismatched `x-request-id`, independently `x-correlation-id` | Same three | All six | `STALE_RESPONSE` | Same | 0 | Yes | 1 | Same |
| Missing/incorrect `x-kix-transport`, independently `x-kix-production-endpoint` | Same three | All six | `GATE_TRANSPORT` | Same | 0 | Yes | 1 | Same |
| Missing/incorrect `x-kix-protocol-truth`, independently `x-kix-production-conformance` | Same three | All six | `PRODUCTION_ENDPOINT` | Same | 0 | Yes | 1 | Same |
| Combined faults proving redirect → trace → transport → truth precedence | Same three | All six | First applicable code above | Same | 0 | Yes | 1 | Same |
| All 24 faults in booking, gift, organizer and consent target writes (96 cases) | `prepareTrade`, `acceptGift`, `closeSales`, `authorizeMarketing` | Never settling | Traced `UNKNOWN` with original code | 1 / 1 | 0 | Full target identity | 1 even after next action | `FENCED`, `blockedBy.reason: "halted"` |
| Fetch ignores abort, then resolves after timeout | Local call | All six; plus an unresolved-fetch control | Original `REQUEST_TIMEOUT` | Same as direct matrix for late responses | 0 | Yes | 1 | Existing timeout/fence suites |
| Injected fetch removes `init.signal` (defensive branch) | Local call | All six | Original missing-signal `GATE_TRANSPORT` | Same | 0 | Yes | 1 | Not a native-fetch path |
| Valid receipts at/below byte limit; valid health/ready at limit | Local call, health, ready | Normal decode | Success | 0 / 0 | Normal consumption/parse | Yes | 1 | Normal behavior |
| Explicit validated rejection at byte limit, HTTP 400 and 422 | Local call | Normal decode | `GateRejectedError` | 0 / 0 | Normal consumption/parse | Existing trace wrapping | 1 | Existing business rejection behavior |

## Acceptance mapping

- Every early matrix case asserts zero producer pulls with `highWaterMark: 0`, zero `getReader()` calls, and zero `text()`, `json()` or `arrayBuffer()` calls. No consumed bytes can reach the response parser. This uses the consumption/JSON.parse observation precedent of `gate-json.test.ts` and `gate-numeric-safety.test.ts`; it avoids redefining a real ESM export, including the adapter's dynamic import. Late-timeout cases additionally spy on `JSON.parse` after request setup.
- Direct cases settle without advancing the 50 ms exchange deadline, assert `body.locked === false`, `vi.getTimerCount() === 0`, an un-aborted signal, exact error message/code/traces, `ProtocolError` rather than `GateRejectedError`, and no `REQUEST_TIMEOUT` reclassification. Deferred cancellation rejects only after the exchange has settled; a fake-timer event-loop flush runs with Vitest's default unhandled-rejection detection enabled. Immediately rejecting and never-settling modes have the same primary result.
- Composer prerequisites use existing successful SDK0/composer fixtures through the invoker, with only the target dispatched to the fake gate. Last confirmed progress stays `create_event` for booking, offered/unresolved for gift, no confirmed organizer command, and consented/not authorized for consent. UNKNOWN retains the exact envelope and sent traces. The next dependent action is fenced, state is unchanged, and the invoker is not called again.
- Every target remains one fetch with `redirect: "manual"` and no `Idempotency-Key`; fake-loopback validation checks the exact POST URL and envelope. Probes send one GET. Adapter HTTP/non-production metadata stays unchanged, with no funds movement, live chain, public deployment, production conformance or protocol truth. Existing transport, replay, composer and no-bypass regressions remain in the narrow run.
- Valid responses retain normal bounded decoding with zero disposal calls, including valid receipt/probe bodies and explicit 400/422 business rejections. Existing overflow, UTF-8, JSON-depth, numeric-safety, interrupted-body and timeout tests continue to run.

## Verification results

Commands run from repository root. The host default is Node **v24.22.1**. `npm exec --yes --package=node@22 -- node --version` returned **v22.23.4**; `npm exec --yes --package=node@22 -- node -p process.execPath` located `/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node`. All npm install, test, build and check commands below prepend that bin directory to `PATH`. Chrome is `/usr/bin/google-chrome`, **156.0.8078.47**. Logs and browser records use `/tmp/kix-disposal-*`, outside tracked source. Commands run in the foreground; yielded tool sessions are polled to completion.

The exact narrow command is:

```bash
KIX_REQUIRE_GATE=0 npm run test -w @kix/protocol-adapter -- \
  test/response-bounds.test.ts test/http-transport-hardening.test.ts \
  test/gate-json.test.ts test/gate-utf8.test.ts test/gate-numeric-safety.test.ts \
  test/loopback-replay-conformance.test.ts \
  test/composer-loopback-conformance.test.ts test/no-bypass.test.ts
```

| Command actually run | Result |
| --- | --- |
| `node --version` (host default) | v24.22.1 |
| `npm exec --yes --package=node@22 -- node --version` | PASS: v22.23.4 |
| `npm ci` | PASS: 535 packages added, 539 audited; lockfile unchanged |
| Narrow command above | PASS: 8 files / 1,017 tests; response-bounds 631 tests |
| `npm run typecheck` | PASS: adapter and web |
| `npm run build` | PASS: adapter/web typecheck and Vite production build |
| `npm run budget` | PASS: initial JS 160,184; initial CSS 4,974; total 784,811 gzip bytes; largest noninitial JS 27,517; 86 files / 76 chunks |
| `npm run lint` | PASS |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries |
| `npm run cycle-check` | PASS: no circular imports in any workspace |
| `npm run audit:warn` | PASS (warning-only command): production audit found 0 vulnerabilities |
| `npm run typecheck:e2e` | PASS |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter 75 files / 2,833 passed, 5 live-gate files / 23 tests skipped; web 107 files / 1,515 tests plus 6 cold-entry tests passed (4,354 passed total) |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all unchanged floors; adapter lines/statements 91.62%, functions 97.79%, branches 85.80%; web lines/statements 94.07%, functions 86.28%, branches 90.50% |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-disposal-browser-record.json npm run test:e2e` (first run) | FAIL: 218 passed / 1 failed across 49 files; credit-servicing NOT_BOUND timed out waiting 15 s for `#servicing-scenario`; teardown correctly reported the missing matrix check |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-disposal-visual-record.json KIX_VISUAL_OUT=/tmp/kix-disposal-visual-out npm run test:visual` (first run) | FAIL: 122 passed / 1 failed; `resale-product.desktop.ko.light` exceeded the unchanged 60 s timeout; no pixel mismatch was reported |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-disposal-a11y-record.json npm run test:a11y` (first run) | FAIL: 395 passed / 1 failed across 22 files; credit-origination SUCCESS keyboard case hit the unchanged 120 s test timeout |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_VISUAL_RECORD_OUT=/tmp/kix-disposal-visual-serial-record.json KIX_VISUAL_OUT=/tmp/kix-disposal-visual-serial-out npm run test:visual` (serial rerun) | PASS: 3 files / 123 tests; 108 screenshots match with zero differing pixels, profile `linux-d29b2e9b`; no baseline updates; host clock step at most 1 ms |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kix-disposal-browser-budget-record.json npm run test:budget` | PASS: 3 files / 9 tests; landing JS 391,391 gzip bytes; render maxima 397 / 381 / 404 ms against unchanged 5,000 ms tripwires; all split/chunk-failure checks passed |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-disposal-e2e-serial-record.json npm run test:e2e` (serial rerun) | FAIL: 207 passed / 12 failed; 11 cascading resale-market failures after a Chrome context closed, plus a marketing-journey element timeout coinciding with a recorded 406,413 ms wall-clock step and 15,978 ms event-loop stall |
| `DEBUG=pw:browser KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kix-disposal-e2e-diagnostic-record.json npm run test:e2e` (serial diagnostic rerun) | PASS: 49 files / 219 tests; previously failing files passed without code/settings changes; no browser exit failure reported |
| `DEBUG=pw:browser KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kix-disposal-a11y-serial-record.json npm run test:a11y` (serial diagnostic rerun) | PASS: 22 files / 396 tests, including all 91 keyboard outcomes and the previously timed-out case; all 89 applicable keyboard facets covered; automated observation, not user acceptance |
| `git diff --check` | PASS |
| `git diff --name-only`, `git ls-files --others --exclude-standard`, and Python allowlist/hash assertions | PASS: exactly the three allowed files changed |
| `git diff --exit-code HEAD -- .` with the three allowed paths excluded | PASS: every other tracked file, including bindings, pins, tuples, CI, budgets, fixtures, dependencies and program metadata, is byte-identical to baseline |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS: expected `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, checked before and after work |
| Python assertions over the four passing browser JSON records | PASS: stub mode, zero non-loopback/non-GET/app network calls and zero failed tests in every passing record |

The existing ceilings remain initial JS 290,000, initial CSS 5,000, each route chunk 30,000, landing JS 400,000 and total gzip 790,000 bytes. No baseline, budget, coverage floor, retry setting or accessibility threshold changes. `npm ci` reported 19 all-dependency audit findings (16 moderate, 1 high, 2 critical), existing deprecation notices and an esbuild install-script notice; dependencies were not changed. The production-only audit found zero vulnerabilities. Vite emits the existing non-failing marketing chunk-cycle warning; import-cycle checks pass. Browser builds also emit non-failing EventEmitter listener warnings. The four passing browser records (e2e diagnostic, a11y serial, budget and visual serial) each report stub mode, zero non-loopback requests, zero non-GET requests and zero application network calls. Browser timings are regression observations only; automated accessibility results grant no user acceptance, conformance, qualification or release.

Deviations: no implementation or scope deviation. The first e2e, visual and a11y runs hit the timeouts recorded above while browser suites overlapped; their reruns are serialized with all thresholds and baselines unchanged. The three first-run timing records all classify their sole failed test as `withHostEvent: 1`, `withoutHostEvent: 0`, and record a shared event at `2026-11-07T18:38:07Z`: approximately 104,600 ms wall-clock step and 16,000 ms event-loop stall. This is observed correlation; overlapping suites alone are not an established root cause. The extra serial e2e attempt also lost one Chrome context (11 cascading failures, cause not established), and another element timeout coincided with a later host event. The following diagnostic e2e run passed all 219 tests and the serial a11y rerun passed all 396 tests without source or settings changes. `DEBUG=pw:browser` adds process logging only. No host clock or harness setting is changed. As directed by the design review, zero reads prove zero response parsing without spying on the real ESM `parseGateJson` export; null bodies explicitly have zero cancellation targets; the Constraints documentation path wins. Node 22 was obtained through npm because the host defaults to Node 24. These are local CI equivalents; remote delivery-head CI is not observed here.

## Locked boundaries and limitations

The locked `packages/protocol-adapter/src/commerce-bindings.ts` SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. Both OpenAPI pins, `PINNED_ACTIONS`, CI `KIX_PROTOCOL_GATE_SHA`, `protocolMergeSha`, SDK manifest/catalogue/vector pins and fixture catalogue v2 stay byte-identical to baseline. No catalogue/gate change is consumed, so no pin movement is required.

Cancellation is best-effort: one attempt does not prove transport resource reclamation, especially for a synchronously throwing or never-settling cancellation. The change adds no retry, fallback, redirect following, `Idempotency-Key`, gate proxy, UI fetch, controller abort or cleanup timeout. Stub stays default, and HTTP remains explicit `http://127.0.0.1` only. Browser suites run the stub production bundle on their own loopback origin; they do not exercise browser integration HTTP access. Measurements are local regression observations, not SLOs.

Product policies, compensation and authoritative UNKNOWN resolution remain **UNDETERMINED**. No real payment, public deployment, KYC, credit disbursement, venue scanning, bank rail, live marketplace, secrets or copied Move/kernel/settlement math is introduced. Production/truth/conformance flags remain false; qualification, user acceptance and release remain outside scope. No file in kix-protocol is changed or needed.

STOP if the work requires an unmerged contract/dependency, new protocol command/schema, product policy value, hardware, paid service, money, credential/secret, production runtime, locked-binding edit or another prohibited behavior: record the need, options, recommendation and decision owner in root `DECISION_REQUIRED.md`. None is required for this implementation.

Live-gate execution is **skipped, never passed**: the stub test run skips 23 live-gate tests. No producer checkout or gate server is started. Supervisor verification of Commerce apps CI at the eventual delivery HEAD remains separate from these local results. The builder creates no commit, push, PR, issue, comment or ASTRA marker.
