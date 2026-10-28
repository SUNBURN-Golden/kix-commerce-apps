# Bounded HTTP response ingestion and JSON nesting

## Scope and ruling

Node `c-plan-c-response-bounds-stub` bounds response ingestion in `packages/protocol-adapter/src/http-adapter.ts` and `gate-json.ts` before unbounded buffering, `JSON.parse`, or recursive payload guards. The guards cover `POST /x-kix-contract-only/local-call` and the `/health` and `/ready` loopback probes — every response path on `HttpProtocolAdapter`. These are app-local client resource guards, not new protocol contracts, not product policy, and not limits the gate is asked to honor.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The locked `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). No pin, generated SDK, binding, export, dependency, UI, CI or budget change accompanies this node. The stub adapter path is untouched; the new guards are loaded only on the HTTP boundary.

## Limits and counting

- `MAX_GATE_RESPONSE_BYTES = 1_048_576` (1 MiB) — the largest response body this client retains. `readGateResponseText` reads `response.body` through a stream reader and counts each `Uint8Array.byteLength` as it arrives. `Content-Length` is never trusted, allocated from, or consulted: absent, zero, understated, overstated and malformed values cannot change the actual-byte outcome. Retention grows geometrically up to the ceiling, so many tiny chunks do not allocate one object per chunk. Exactly the ceiling is accepted, but only after EOF is observed; the chunk that would cross the ceiling is refused without being copied or decoded, the reader is cancelled, and overflow raises `ProtocolError` code `GATE_STATUS`. Overflow never aborts the exchange controller, whose aborted state selects `REQUEST_TIMEOUT`. A null body keeps the existing empty-body behavior. Bytes are decoded once with `TextDecoder`, so UTF-8 code points split across chunk boundaries (Korean and supplementary-plane characters verified at every byte offset) decode identically to `response.text()`, and bytes — not characters — determine the limit.
- `MAX_GATE_JSON_DEPTH = 32` — unchanged from `payload-guards.ts` (`MAX_PAYLOAD_DEPTH`). `parseGateJson` now runs an iterative lexical scan before any `JSON.parse`. The root value is depth 0; each object-property value or array element adds one; scalar leaves and empty containers count; object keys do not. Depth 32 is accepted and 33 refused for objects, arrays, mixed nesting, empty containers and primitive leaves — identical boundaries to the recursive guards, verified case-by-case in `test/gate-json.test.ts`. The scanner skips quoted strings and escapes, so braces inside strings do not add depth, and its stack is bounded by the depth ceiling rather than by payload width. `JSON.parse` remains syntax authority; duplicate decoded keys, `__proto__`/`constructor`/`prototype` keys and lone surrogates keep their existing rejections.

Cancellation is connected to the exchange's existing abort signal: aborting cancels the reader, a pending read resolves, and the aborted check runs before EOF is honored, so a timed-out exchange never parses a complete JSON prefix that never reached EOF. Cancellation is fire-and-forget — a rejecting or hanging source cannot delay or replace the primary error — and reader locks and signal listeners are released in cleanup.

## Processing and error order

Order on the HTTP boundary is unchanged before the new guards and extended after:

1. Fetch failure → `GATE_UNAVAILABLE`. Fetch resolving after the timeout race → the body is cancelled and `REQUEST_TIMEOUT` is thrown.
2. Redirect/type/origin → `GATE_TRANSPORT`; echoed trace mismatch → `STALE_RESPONSE`; transport marker mismatch → `GATE_TRANSPORT`; truth/conformance claims → `PRODUCTION_ENDPOINT`. All of these run before a single body chunk is pulled.
3. Bounded read: stream error → `GATE_UNAVAILABLE`; stall → `REQUEST_TIMEOUT` via the existing exchange timer (one timer, no new deadline); byte overflow → `GATE_STATUS` with reader cancellation.
4. Depth preflight → `GATE_STATUS` before `JSON.parse`; then existing unsafe-JSON checks → `GATE_STATUS`.
5. Existing behavior after the body is produced is unchanged: `enforceRemotePayloadGuards`, the 400/422 + `rejected: true` + nonblank `error` shape → `GateRejectedError`, ambiguous rejection → `GATE_STATUS`, receipt/envelope/composer assertions.

A byte- or depth-overflowing rejection-looking body never becomes `GateRejectedError`; composers classify it `UNKNOWN` and fence subsequent writes. Every dispatched invalid response keeps the request's `requestId`/`correlationId`, produces `UNKNOWN` (never `REJECTED`), and makes exactly one fetch with no retry, no Idempotency-Key, no redirect and no stub fallback.

## Acceptance matrix

| Case | Bytes | Max depth | Advertised length | Expected outcome | Cancel | Trace kept | Fetches | Fence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Valid receipt padded | limit−1, limit | ≤32 | absent / `0` / `1` / `999999999` / malformed | resolves receipt | no | n/a | 1 | n/a |
| Valid receipt padded | limit+1 | ≤32 | same five variants | `GATE_STATUS` | 1 | yes | 1 | n/a |
| Limit reached, extra byte after | limit, then +1 | ≤32 | — | `GATE_STATUS` | 1 | yes | 1 | n/a |
| Korean/emoji receipt | split at each UTF-8 byte | ≤32 | — | resolves receipt | no | n/a | 1 | n/a |
| UTF-8 receipt padded | limit, limit+1 | ≤32 | char length (misleading) | resolve / `GATE_STATUS` | 0/1 | yes | 1 | n/a |
| Object/array/mixed nesting | small | 32 accepted, 33 refused | — | depth gate precedes `JSON.parse` | no | n/a | unit | n/a |
| Oversized success / 400 / 422 rejection | limit+1 | ≤32 | — | `GATE_STATUS`, not `GateRejectedError` | 1 | yes | 1 | FENCED |
| Over-nested success / 400 / 422 rejection | small | 33 | — | `GATE_STATUS`, not `GateRejectedError` | 0 | yes | 1 | FENCED |
| Interrupted stream, success / 422 | prefix | ≤32 | — | `GATE_UNAVAILABLE` | 0 | yes | 1 | FENCED |
| Stalled stream, success / 422 | prefix incl. full-JSON | ≤32 | — | `REQUEST_TIMEOUT`, `JSON.parse` never called | 1 | yes | 1 | FENCED |
| Fetch ignores abort, resolves late | full | ≤32 | — | `REQUEST_TIMEOUT`; body cancelled, never pulled or parsed | 1 | yes | 1 | n/a |
| Valid explicit rejection at limit | limit | ≤32 | — | `GateRejectedError` preserved | 0 | yes | 1 | n/a |
| `/health`, `/ready` | limit ok, limit+1, depth 33, interrupted, stalled | 32/33 | `0` (misleading) | resolve body / `GATE_STATUS` / `GATE_STATUS` / `GATE_UNAVAILABLE` / `REQUEST_TIMEOUT` | per case | yes | 1 | n/a |

UNKNOWN-then-FENCED is run through `BookingJourney`, `GiftTransfer`, `OrganizerConsole` and `ConsentBind` for every invalid case, with prerequisite receipts supplied through the invoker and the target call made once over the fake loopback gate.

## Verification results

| Command | Result |
| --- | --- |
| `npm ci` | clean install, 534 packages |
| `npm run typecheck` | passed (`tsc --noEmit` for `@kix/protocol-adapter` and `@kix/web`) |
| `npm run build` | passed (`tsc --noEmit` + `vite build`, index JS 115.84 kB gzip) |
| `KIX_REQUIRE_GATE=0 npm test` | passed: protocol-adapter 69 files / 1618 tests (5 files / 23 tests skipped — live-gate only), web 90+1 files / 1275 tests |
| `KIX_REQUIRE_GATE=0 npm run test -w @kix/protocol-adapter -- test/response-bounds.test.ts test/gate-json.test.ts test/http-transport-hardening.test.ts test/loopback-replay-conformance.test.ts test/composer-loopback-conformance.test.ts test/http-integration-gate.test.ts` | 286 passed, 2 skipped (live-gate requires KIX_REQUIRE_GATE=1; skipped, never passed) |
| `KIX_REQUIRE_GATE=0 vitest run test/gate-json.test.ts test/response-bounds.test.ts` | 152 tests passed |
| `npm run lint` | passed |
| `npm run budget` | passed: initialJsGzip=160720 ≤ 290000, totalGzip=779629, all route budgets within limits |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | all coverage floors met |
| `npm run deps:check` | production dependency gate passed |
| `npm run cycle-check` | no circular imports in any workspace |
| `npm run typecheck:e2e` | passed |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npm run test:e2e` | 47 files / 195 tests passed |
| `npm run test:a11y` (same Chrome env) | 17 files / 363 tests passed |
| `npm run test:budget` (same Chrome env) | 3 files / 9 tests passed |
| `npm run test:visual` (same Chrome env) | 3 files / 109 tests passed — committed baselines match |
| `git diff --check` | clean |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` — locked file unchanged |

## Unverified boundaries

- The byte limit bounds application-retained response data; buffers already allocated inside the fetch implementation itself are outside it.
- Live-gate evidence (`KIX_REQUIRE_GATE=1`, reviewed kix-protocol checkout) is unavailable in this environment and remains skipped, never passed.
- These are client guards only: no protocol contract, catalogue, pin, `PINNED_ACTIONS`, `protocolMergeSha` or `KIX_PROTOCOL_GATE_SHA` value changes, and no SLO is implied.
