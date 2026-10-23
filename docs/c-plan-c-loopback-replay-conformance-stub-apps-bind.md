# Offline loopback replay conformance

## Scope and ruling

Node `c-plan-c-loopback-replay-conformance-stub` replays the complete SDK0 mock scenario kit through `HttpProtocolAdapter` in `integration-http` mode. `test/support/fake-loopback-gate.ts` implements the fetch interface in process. It checks POST, the published local-call path, exact scenario envelope, manual redirects and absence of Idempotency-Key; it records each call and echoes integration-gate and trace headers. It serves fixture receipts/failures, never a protocol implementation.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. Only `create_event` → `prepare_trade` → `accept_trade` is composed. The locked desk bindings stay byte-identical. No other journey command is sent or rebound.

## Boundary

This is an **offline double**, BOOTSTRAP **catalogue-schema-binding only**, **not semantic conformance**, **not the live gate**. Synthetic fixture receipts are app-guarded shapes, not SDK-generated result types. The current v2 SDK consumption tuple remains unchanged, with v1 literals retained as history. No OpenAPI pin, SDK pin, vendor byte, PINNED_ACTIONS, protocolMergeSha or CI gate SHA changes.

There are no sockets, clock reads, randomness or timers in the double. The suite uses Vitest fake timers around the adapter's existing timeout and asserts no timers remain after each test. Earlier steps needed for a target journey step use same-seed fixture receipts with no fetch. Each target call has exactly one fetch, including failures; a subsequent journey write is fenced. NOT_BOUND has zero fetches. There is no retry, stub fallback, redirect following, UI fetch or gate proxy.

The offline suite runs with `KIX_REQUIRE_GATE=0`; unavailable live suites are **skipped, never passed**. It contains no raw live-helper marker and the existing web evidence scanner explicitly excludes it. `KIX_REQUIRE_GATE=1` requirements and the reviewed checkout helper are unchanged. This double cannot qualify that job.

## Replay matrix

Every row runs at seeds `0`, `7`, and `0xffffffff` (27 replay cases). A covered-set assertion equals `SDK0_MOCK_SCENARIO_IDS` exactly.

| Fixture | Adapter / journey | Fetches per replay |
| --- | --- | --- |
| booking-journey.create_event.success | exact fixture receipt; shared guards; RECEIPT | 1 |
| booking-journey.prepare_trade.success | exact fixture receipt; shared guards; RECEIPT | 1 |
| booking-journey.accept_trade.success | exact fixture receipt; shared guards; RECEIPT | 1 |
| booking-journey.create_event.reject | GateRejectedError, fixture code and trace, HTTP 422; REJECTED then FENCED | 1 |
| booking-journey.create_event.unknown | ProtocolError, fixture code and trace; UNKNOWN then FENCED | 1 |
| booking-journey.create_event.stale | ProtocolError, fixture code and trace; UNKNOWN then FENCED | 1 |
| not-bound.placeHold | method throws not-bound first; consideredAction reserve_listing | 0 |
| not-bound.confirmBooking | method throws not-bound first; locked consideredAction | 0 |
| not-bound.settlementPreview | method throws not-bound first; locked consideredAction | 0 |

## Mutation enumeration and precedence

`$` denotes the receipt root. Depth-first enumeration includes every object field and every array index. The three SUCCESS receipts have 11, 11 and 7 paths respectively. Every path receives six mutations: delete, swapType, addKey, and the three true claim injections. There are 174 field cases plus 12 envelope/transport cases per receipt: **210 rows** (78 create, 78 prepare, 54 accept). The suite independently lists all required paths, asserts every path/mutation pair, row count and uniqueness, and compares this table verbatim to the emitted output.

Root deletion sends an empty body. Object field deletion removes the field; array index deletion splices the array. Type swaps are string→number, number→string, boolean→string, array→object, object→array. Extra keys and flags are inserted in an object node. At scalar nodes the scalar is replaced with `{value: original, key: mutation}`; at array nodes an object element is appended, since named array properties disappear during JSON serialization. Every field mutation must change the serialized body; every transport mutation must change the response description. The table uses asserted expectations, never observed codes as its oracle.

Precedence remains origin/redirect (`GATE_TRANSPORT`), echoed trace (`STALE_RESPONSE`), transport markers (`GATE_TRANSPORT`), truth/conformance markers (`PRODUCTION_ENDPOINT`), then body parsing. Ambiguous/unsafe JSON is `GATE_STATUS` before payload scanning. A true `productionEndpoint` anywhere is `PRODUCTION_ENDPOINT` before result/envelope checks. Economic-finality guards keep their messages but uncoded local-call guard errors now become `GATE_STATUS` with trace IDs; funds claims and shape mutations also fail with `GATE_STATUS`. The three composed actions share the journey's existing closed result checks at the HTTP boundary. Other pinned actions retain their envelope checks. There are no accepted or uncoded sweep rows, and journey rejection is an additional assertion rather than a substitute for adapter rejection.

| Asserted code | Rows |
| --- | --- |
| GATE_STATUS | 157 |
| STALE_RESPONSE | 6 |
| GATE_TRANSPORT | 12 |
| PRODUCTION_ENDPOINT | 35 |

## Sweep table

<!-- loopback-sweep:start -->
| Fixture | Path | Mutation | ProtocolError code |
| --- | --- | --- | --- |
| booking-journey.create_event.success | $ | delete | GATE_STATUS |
| booking-journey.create_event.success | $ | swapType | GATE_STATUS |
| booking-journey.create_event.success | $ | addKey | GATE_STATUS |
| booking-journey.create_event.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $ | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.domain | delete | GATE_STATUS |
| booking-journey.create_event.success | $.domain | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.domain | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.operationId | delete | GATE_STATUS |
| booking-journey.create_event.success | $.operationId | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.operationId | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.sequence | delete | GATE_STATUS |
| booking-journey.create_event.success | $.sequence | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.sequence | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.action | delete | GATE_STATUS |
| booking-journey.create_event.success | $.action | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.action | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.action | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result.eventId | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result.eventId | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result.eventId | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result.eventId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result.eventId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result.eventId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result.policyHash | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result.policyHash | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result.policyHash | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result.policyHash | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result.policyHash | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result.policyHash | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result.inventoryIds | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result.inventoryIds.0 | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds.0 | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds.0 | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds.0 | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds.0 | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result.inventoryIds.0 | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $.result.reservationSeconds | delete | GATE_STATUS |
| booking-journey.create_event.success | $.result.reservationSeconds | swapType | GATE_STATUS |
| booking-journey.create_event.success | $.result.reservationSeconds | addKey | GATE_STATUS |
| booking-journey.create_event.success | $.result.reservationSeconds | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.create_event.success | $.result.reservationSeconds | inject:fundsExecuted | GATE_STATUS |
| booking-journey.create_event.success | $.result.reservationSeconds | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $ | operationId:changed | GATE_STATUS |
| booking-journey.create_event.success | $ | action:other-pinned | GATE_STATUS |
| booking-journey.create_event.success | $ | action:unpinned | GATE_STATUS |
| booking-journey.create_event.success | $headers | drop:x-request-id | STALE_RESPONSE |
| booking-journey.create_event.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| booking-journey.create_event.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| booking-journey.create_event.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| booking-journey.create_event.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| booking-journey.create_event.success | $origin | origin:other-port | GATE_TRANSPORT |
| booking-journey.create_event.success | $origin | origin:localhost | GATE_TRANSPORT |
| booking-journey.create_event.success | $ | array:two-receipts | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.domain | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.domain | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.domain | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.operationId | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.operationId | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.operationId | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.sequence | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.sequence | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.sequence | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.action | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.action | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.action | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.action | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result.tradeId | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.tradeId | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.tradeId | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.tradeId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.tradeId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.tradeId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result.ticketId | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.ticketId | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.ticketId | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.ticketId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.ticketId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.ticketId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result.externalOrderId | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.externalOrderId | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.externalOrderId | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.externalOrderId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.externalOrderId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.externalOrderId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result.status | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.status | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.status | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.status | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.status | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.status | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $.result.termsHash | delete | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.termsHash | swapType | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.termsHash | addKey | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.termsHash | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.termsHash | inject:fundsExecuted | GATE_STATUS |
| booking-journey.prepare_trade.success | $.result.termsHash | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $ | operationId:changed | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | action:other-pinned | GATE_STATUS |
| booking-journey.prepare_trade.success | $ | action:unpinned | GATE_STATUS |
| booking-journey.prepare_trade.success | $headers | drop:x-request-id | STALE_RESPONSE |
| booking-journey.prepare_trade.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| booking-journey.prepare_trade.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| booking-journey.prepare_trade.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| booking-journey.prepare_trade.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| booking-journey.prepare_trade.success | $origin | origin:other-port | GATE_TRANSPORT |
| booking-journey.prepare_trade.success | $origin | origin:localhost | GATE_TRANSPORT |
| booking-journey.prepare_trade.success | $ | array:two-receipts | GATE_STATUS |
| booking-journey.accept_trade.success | $ | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $ | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $ | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $ | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.domain | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.domain | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.domain | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.operationId | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.operationId | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.operationId | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.sequence | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.sequence | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.sequence | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.action | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.action | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.action | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.action | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.result | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.result | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.result | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.result | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $.result.accepted | delete | GATE_STATUS |
| booking-journey.accept_trade.success | $.result.accepted | swapType | GATE_STATUS |
| booking-journey.accept_trade.success | $.result.accepted | addKey | GATE_STATUS |
| booking-journey.accept_trade.success | $.result.accepted | inject:economicFinalityClaimed | GATE_STATUS |
| booking-journey.accept_trade.success | $.result.accepted | inject:fundsExecuted | GATE_STATUS |
| booking-journey.accept_trade.success | $.result.accepted | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $ | operationId:changed | GATE_STATUS |
| booking-journey.accept_trade.success | $ | action:other-pinned | GATE_STATUS |
| booking-journey.accept_trade.success | $ | action:unpinned | GATE_STATUS |
| booking-journey.accept_trade.success | $headers | drop:x-request-id | STALE_RESPONSE |
| booking-journey.accept_trade.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| booking-journey.accept_trade.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| booking-journey.accept_trade.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| booking-journey.accept_trade.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| booking-journey.accept_trade.success | $origin | origin:other-port | GATE_TRANSPORT |
| booking-journey.accept_trade.success | $origin | origin:localhost | GATE_TRANSPORT |
| booking-journey.accept_trade.success | $ | array:two-receipts | GATE_STATUS |
<!-- loopback-sweep:end -->

## Hostile JSON

Twelve raw text cases preserve the bytes through the double: root and nested `__proto__`; root `constructor.prototype`; nested `constructor` and nested `prototype` independently; duplicate `__proto__`; duplicate action with the same valid final value; duplicate policyHash with an otherwise valid final value; escaped high and low lone surrogates in the otherwise opaque policyHash; a lone surrogate embedded in that string; and an escape-equivalent duplicate key. Each is rejected by the adapter with `GATE_STATUS` after one fetch. Object.prototype names and all property descriptors are unchanged after each input, and `({}).polluted` stays undefined.

A positive control accepts ordinary whitespace, existing unsorted key order, and a paired Unicode character. The JSON preflight accepts standard JSON syntax rather than imposing the SDK request canonicalization format on gate responses. Its iterative scan adds no recursion; existing payload guards retain their depth limit. It rejects duplicate decoded keys and dangerous property names before a response can become evidence. JSON.parse only constructs own data properties; no remote object is merged into another object.

## Observed guard boundaries

The existing journey result readers were moved unchanged into `src/journey-receipts.ts` so HTTP and journey consumers use the same app-approved shapes. `closedResult` and `sameKeys` remain available through the original module exports. The HTTP adapter adds result validation for the composed three actions, coded guard normalization, and raw JSON safety checks. This is app fail-closed validation, not a new producer contract, protocol state machine, settlement computation or semantic verifier. The tests do not decide whether a nonempty opaque hash is a genuine hash or whether the reference core executed a command.

## Verification

Local verification used **Node v22.23.4** (`npm exec --yes --package=node@22 -- node -p process.execPath` resolved the binary), with `PATH=/home/box/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH` prefixed to npm/npx commands. A preliminary install/typecheck/replay ran on the host Node v20.19.2 before switching to CI's Node 22 major. Browser commands used `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1` (Google Chrome 156.0.8078.47). Every job stayed in a managed foreground process and was awaited. Coverage floors and CI configuration are unchanged.

Commands are relative to the repository root unless marked **adapter cwd** (`packages/protocol-adapter`). Exit 0 means the command passed locally, not a GitHub CI or live-gate attestation.

| Command actually run | Result |
| --- | --- |
| `npm ci` | Exit 0 on host Node 20, then exit 0 again on Node 22. Existing install warnings: five audit findings including dev dependencies; no dependency edits. |
| `npm run typecheck -w @kix/protocol-adapter` | Exit 0, preliminary check. |
| **adapter cwd** `KIX_REQUIRE_GATE=0 npx vitest run test/loopback-replay-conformance.test.ts` | Exit 0; 32 tests, 27 seeded replays, 210 sweep rows, 12 hostile raw inputs. Re-run after the double's final call-recording correction. |
| **adapter cwd** `KIX_REQUIRE_GATE=0 npx vitest run test/loopback-replay-conformance.test.ts test/booking-journey.test.ts test/http-transport-hardening.test.ts test/no-bypass.test.ts test/gate-requirement.test.ts test/prod-readiness.test.ts` | Exit 0; six files, 80 passed, one live-gate test skipped. |
| `npm run typecheck` | Exit 0; both workspaces, final source and test state. |
| `npm run build` | Exit 0; clean stub build. Existing large-chunk advisory remains. |
| `KIX_REQUIRE_GATE=0 npm test` | Exit 0; adapter 66 files / 1,367 passed, 23 skipped; web 81 files / 1,068 passed. Re-run after final runtime changes. |
| `npm run lint` | Exit 0. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Exit 0; all original floors met. Final adapter lines/statements 91.30%, functions 97.44%, branches 84.77%; web lines/statements 91.36%, functions 76.86%, branches 88.07%. |
| `npm run cycle-check` | Exit 0; no circular imports in adapter, web or e2e. |
| `npm run deps:check` | Exit 0; four package manifests and 630 lockfile entries checked. |
| `npm run audit:warn` | Exit 0; production audit reports zero vulnerabilities. |
| `npm run budget` | Exit 0; initial JS gzip 289,989 / 290,000; CSS 4,965 / 5,000; total 789,939 / 790,000; largest lazy chunk 28,279 / 30,000. No limits changed. |
| `npm run typecheck:e2e` | Exit 0. |
| `KIX_E2E_RECORD_OUT=/tmp/kix-loopback-browser-record.json npm run test:e2e` | Exit 0; 43 files, 174 tests. Browser environment as above. |
| `KIX_A11Y_RECORD_OUT=/tmp/kix-loopback-a11y-record-rerun.json npm run test:a11y` | Exit 0; 15 files, all 269 tests passed in the final full run. Browser environment as above; no timeout, baseline or finding changes. |
| `KIX_BUDGET_RECORD_OUT=/tmp/kix-loopback-browser-budget-record.json npm run test:budget` | Exit 0; three files, nine tests. Browser environment as above; all render, split and chunk-failure checks pass. |
| `KIX_VISUAL_RECORD_OUT=/tmp/kix-loopback-visual-record.json KIX_VISUAL_OUT=/tmp/kix-loopback-visual-out npm run test:visual` | Exit 0; three files, 42 tests. Browser environment as above; baselines unchanged. |
| **adapter cwd** `KIX_REQUIRE_GATE=1 npx vitest run test/http-integration-gate.test.ts` | Exit 1 as expected without the reviewed checkout: `Set KIX_PROTOCOL_ROOT to the kix-protocol checkout that contains integration_gate.` One test passed, two skipped, setup failed. Live gate is unverified; the missing prerequisite is not converted to an offline pass. |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/vendor .github .aiops docs/aiops package.json package-lock.json` | Exit 0; all locked files/directories unchanged. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` and `git rev-parse origin/main:packages/protocol-adapter/src/commerce-bindings.ts` | Both `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |
| `git diff --check` | Exit 0. |

### Failed iterations and fixes

The first single-file replay command (`npx vitest run test/loopback-replay-conformance.test.ts`, adapter cwd, Node 20) passed 31 tests and failed the expected doc-table comparison while the table block was empty. Its emitted table was copied into this document; subsequent comparisons pass. The preliminary six-file narrow run (same file list above without an explicit KIX_REQUIRE_GATE prefix, Node 22) passed 79 tests and failed the old HTTP `bad-result` expectation of INVALID_RECEIPT; the assertion now checks GATE_STATUS and both trace IDs. The same six-file command was also run successfully from the repository root (80 passed, one skipped), then from adapter cwd with KIX_REQUIRE_GATE=0.

The first `npm run lint` found two unnecessary regex escapes and one non-null assertion in the JSON preflight; these were removed and lint was re-run successfully. Bundle checks initially failed at 290,258 and 290,222 initial JS bytes; splitting the HTTP-only JSON preflight brought initial JS under its cap but measured 790,066 total bytes. Removing a redundant result-error branch and redundant recursive-depth handling from the iterative preflight brought both measures under the unchanged caps. Existing payload guards still enforce the depth limit. Build, narrow tests, typecheck, full stub tests, lint, coverage and budget were re-run for the resulting runtime code.

The first `KIX_A11Y_RECORD_OUT=/tmp/kix-loopback-a11y-record.json npm run test:a11y` run exited 1 with 268 passed and one timeout at `identity at narrow` (120,000 ms). A diagnostic command from `apps/e2e`, `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 npx vitest run -c vitest.a11y.config.ts tests/a11y/axe-scan.a11y.test.ts -t 'identity at narrow'`, passed the selected test in 1,350 ms (73 filtered tests skipped). Its overall exit was 1 because the existing teardown requires the complete accessibility matrix; that filtered command is diagnostic evidence only. A second full run (`KIX_A11Y_RECORD_OUT=/tmp/kix-loopback-a11y-record-final.json npm run test:a11y`) exited 1 with 267 passed and two timeouts in async-state and Korean locale; all 74 axe scans passed. A second diagnostic from `apps/e2e`, `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 DEBUG=pw:api npx vitest run -c vitest.a11y.config.ts tests/a11y/async-state.a11y.test.ts tests/a11y/locale.a11y.test.ts -t 'normal, held read|keeps Korean normal'`, exited 1: Korean locale passed, async-state was marked timed out, nine filtered tests were skipped, and teardown also rejected the incomplete matrix. The API trace shows the async-state UI steps completed and the page closed; the timeout cause is not established here. These diagnostic commands do not count as complete passes.

The final full command (`KIX_A11Y_RECORD_OUT=/tmp/kix-loopback-a11y-record-rerun.json npm run test:a11y`) exited 0 with all 269 tests in 15 files passed. No test, timeout, baseline or known-finding configuration was changed. Browser records for journeys, accessibility, budget and visual runs each report zero non-loopback requests, zero non-GET requests and zero app network calls. The earlier intermittent timeout observations remain recorded rather than being attributed to an unproven cause.

Logs and browser JSON records were written under `/tmp/kix-loopback-*`; the permanent review evidence is this document, its exact sweep table, and the executable assertions. No commit, push, PR, issue, comment, protected delivery marker or release was created.

## UNDETERMINED and not verified

Session retention stays **UNDETERMINED — 담당 사용자/법무**. User acceptance, protected producer approval, production readiness, release, live payments, real admission and semantic conformance are not established by this evidence. No external credentials or paid service is required or used.

## Plan deviations

- The objective names two bind-document paths. The explicit Constraints path, `docs/c-plan-c-loopback-replay-conformance-stub-apps-bind.md`, is used.
- The supplied design review supersedes the original test-only/two-layer proposal. Minimal source validation is necessary for acceptance: every mutation now throws a coded adapter ProtocolError after one fetch. Existing app result guards are shared rather than inventing a schema. The HTTP bad-result journey test is updated to expect GATE_STATUS plus trace IDs; non-HTTP journey invalid-result handling remains in place.
- An assertion in the existing web evidence matrix test verifies exclusion using the actual `liveGateFiles()` function; its scanner is unchanged.
- The strict bundle limits required deferring the JSON preflight module until an HTTP response needs it. Stub startup does not load that module; no budget or UI copy changed.
- No new protocol contract, command, policy value or dependency is consumed. The locked files and forbidden directories are unchanged.


## Files changed

- `README.md`: link to this offline evidence.
- `packages/protocol-adapter/src/gate-json.ts`: standard JSON preflight with duplicate-key, dangerous-key and lone-surrogate rejection.
- `packages/protocol-adapter/src/journey-receipts.ts`: shared existing result readers and HTTP assertion.
- `packages/protocol-adapter/src/booking-journey.ts`: import the shared readers; preserve helper exports.
- `packages/protocol-adapter/src/http-adapter.ts`: preflight JSON, validate composed results, normalize uncoded guard errors with trace IDs.
- `packages/protocol-adapter/src/payload-guards.ts`: reject a true productionEndpoint claim at any nesting level.
- `packages/protocol-adapter/test/support/fake-loopback-gate.ts`: offline fetch double with call recording before validation.
- `packages/protocol-adapter/test/loopback-replay-conformance.test.ts`: exhaustive seeded replay, sweep, hostile text, timer and import boundaries.
- `packages/protocol-adapter/test/booking-journey.test.ts`: assert the earlier HTTP rejection and its trace identity.
- `apps/web/test/local-evidence-matrix.test.ts`: actual scanner excludes the offline suite.
- `docs/c-plan-c-loopback-replay-conformance-stub-apps-bind.md`: scope, boundaries, exact table, commands and results.
