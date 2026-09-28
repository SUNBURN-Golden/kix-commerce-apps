# kix-commerce-apps

Wave 6 commerce desk for KIX: box office, booking, admission, and resale.
Wave 7 adds marketing screens for ORIGINAL_32 labels M01–M05. Those screens are stub demos and stay 설계중.
This repository is the BeautifulMind-JT app host JunTae selected for product frontends.
Protocol, Move, and settlement contracts stay in [BeautifulMind-JT/kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol).

The UI is an operator desk over a protocol adapter, plus a separate marketing stub. The default adapter is an in-memory stub so the desk can run without a chain. HTTP mode is explicit and non-production. It runs only with an `http://127.0.0.1` base URL and posts the published local-call envelope to the reviewed integration gate. Desk methods stay not-bound when no command body matches. There is no default public host. A failed HTTP call stays on the HTTP adapter. It does not fall back to the stub. Each local call is one attempt. A successful local call is not production approval. Neither adapter moves funds or disburses credit. The box office settlement case is that same stub: mock FSM phases, no live funds. Booking and admission read a mock reservation case from that stub: mock FSM phases, not live admission. Resale reads a mock resale case from that stub: mock FSM phases, not a live marketplace. Credit reads a mock credit case from that stub: mock FSM phases, not live credit. The marketing stub does not call booking, resale, admission, settlement, or credit writes.

## Non-goals

- Product frontend trees do not belong in `kix-protocol`. This repo does not copy Move, the kernel, or settlement math.
- Wave 7 marketing (M01–M05) is a browser-session stub. Labels stay 설계중. Limits are in [docs/wave7-marketing-m01-m05.md](docs/wave7-marketing-m01-m05.md). The contract-only OpenAPI pin is the command catalogue. The integration-gate pin is a loopback transport only. Neither pin is production deployment, a public endpoint, or a contract-conformance claim. Local HTTP success is not approval for chain, payment, production, or launch.
- No real money, no card capture, and no credit disbursement. The credit desk is a mock case. F04 and E06 stay 설계중 in kix-protocol. This app has no disburse action (`CREDIT_BOUNDARY.action` is `none`).
- No product TPS, p99, or fail-rate SLOs.
- ZARI, film-unit, maeum-gyeol, SOULBOUND, ai-ops-control-plane, and beautiful-mind are out of this wave.
- Stub policies (single admission, hold expiry, resale lock) are desk behavior for tests and the demo. They are not protocol law.

## How the UI maps to kix-protocol

Charter labels are from Task 005. The app names those surfaces and calls an adapter. It does not redefine them.

| Desk | Route | ORIGINAL_32 / wave | Adapter call |
| --- | --- | --- | --- |
| Box office | `/` | E04 client over the catalog; settlement case F01–F03 (Wave 3, mock FSM, 설계중) | `listPerformances`, settlement case commands (`initiateSettlement` through `viewSettlement`) |
| Booking | `/booking/:eventId` | B01–B05 (Wave 4, 설계중) and charter label `wave4.booking.B01-B05.fsm` | `placeHold`, `releaseHold`, `confirmBooking`, plus stub reservation commands (`registerReservationShow` through `viewReservation`) |
| Admission | `/admission` | P03 admission gate (설계중), referencing Wave 2 `zk_gate`, and charter label `wave4.admission.P03.fsm` | `checkAdmission`, plus `authorizeReservationAdmission` and `consumeReservation` |
| Resale | `/resale` | R01–R05 (Wave 4) and charter label `wave4.resale.R01-R05.fsm` | `openResale`, `listResale`, `acceptResale`, plus stub resale commands (`adoptResaleIssued` through `viewResaleCase`) |
| Credit | `/credit` | F04 (Wave 5, mock FSM, 설계중) and charter label `wave5.credit.F04.fsm` | stub credit commands (`offerCredit` through `viewCredit`) |

Wave 7 marketing routes use the local stub in `apps/web/src/marketing`. They are not protocol calls, except a display-only `listPerformances` read on M02.

| Marketing | Route | ORIGINAL_32 | Write target |
| --- | --- | --- | --- |
| Hub | `/marketing` | M01–M05, status 설계중 | marketing session stub |
| Fan qualification / membership | `/marketing/m01` | M01 팬 자격 / 멤버십 | marketing session stub |
| Presale | `/marketing/m02` | M02 선예매 | marketing session stub |
| Coupon / promotion | `/marketing/m03` | M03 쿠폰 / 프로모션 | marketing session stub |
| Referral / rewards | `/marketing/m04` | M04 추천 / 리워드 | marketing session stub |
| CRM / data use | `/marketing/m05` | M05 CRM / 데이터 활용 | marketing session stub |

`confirmBooking` and `acceptResale` record `payment: "simulated-no-funds"`. The settlement panel renders a mock FSM case from the stub. It lists F01, F02, and F03 and does not compute shares. Limits are in [docs/settlement-depth-apps-bind.md](docs/settlement-depth-apps-bind.md).

The booking and admission panels render a mock reservation case from the same stub. They list B01–B05 and P03 and do not compute inventory. Limits are in [docs/reservation-depth-apps-bind.md](docs/reservation-depth-apps-bind.md).

Admission also renders a mock credential label from that adapter: `valid`, `invalid`, `stale`, `already-consumed`, `transferred`, `cancelled`, or `unavailable-server`. The adapter assigns the label. The page prints it. HTTP mode reads the loopback health probe and does not post `admit`. A reachable gate is not entry. Limits are in [docs/admission-harden-apps-bind.md](docs/admission-harden-apps-bind.md).

`packages/protocol-adapter` is the only seam:

- `StubProtocolAdapter` — default when `VITE_KIX_PROTOCOL_MODE` is unset or `stub`. In-memory fixtures. `proofMode` is `stub` because `zk_gate` is not evaluated here. The environment name is `stub`. A base URL in this mode does not open HTTP.
- `HttpProtocolAdapter` — used only when `VITE_KIX_PROTOCOL_MODE` is `http` or `integration-http` and `VITE_KIX_PROTOCOL_API_BASE` is an explicit `http://127.0.0.1:<port>` origin. The environment name is `integration-http`. Modes named production or public are refused and do not select the stub. There is no default base URL and no public host. `https`, `localhost`, a missing or default port, port 0, and any other host are rejected. A transport failure stays on this adapter. The client sends each local call once and does not retry. It does not follow redirects. A redirect or a response from another origin is `GATE_TRANSPORT`. An exchange that runs past twice the pinned gate timeout is `REQUEST_TIMEOUT`. `X-Request-Id` and `X-Correlation-Id` must be echoed. A mismatch is `STALE_RESPONSE`. The client loads both vendored pins and rejects a wrong file sha256, a wrong `info.version`, a contract-only file that is not `contract-only`, or an integration-gate file whose status is not `integration-gate` with `productionEndpoint: false`. Desk methods are not-bound: none of them has the same body as one of the 40 local-call commands, so they throw before any request. An explicit `invokeLocalCall` POSTs `{ operationId, actor, action, body }` to `/x-kix-contract-only/local-call` on that loopback origin. That path is the published integration-gate transport for `Core.execute`. It is not a REST resource tree. `action` must be one of the 40 pinned command names. The `actor` string is only that local-call argument. It is not an authentication result, and this client defines no auth scheme. A non-success status, a missing integration-gate transport header, or `X-Kix-Production-Endpoint` other than `false` is a reject. A success must be exactly one published receipt for the same `operationId` and `action`. An empty body or extra receipt keys are a reject. The client rejects booking payloads that are not marked `simulated-no-funds`, settlement payloads that are not `mode: "mock"` with references `F01`, `F02`, `F03`, reservation payloads that claim economic finality or leave mock mode, resale payloads that claim economic finality, a venue reissue, a fee split, or leave mock mode, and credit payloads that claim economic finality, executed funds, a currency posting, or leave mock mode. Those checks apply to every nested object in a response. A published catalogue receipt is not rewritten into a desk FSM phase. `disburseCredit` is still rejected. `GET /health` and `GET /ready` are process probes on the adapter, not protocol commands and not production readiness. The web UI does not call them with `fetch`.

View-model field names (`eventId`, `rightsRef`, and the rest) stay local. They are not Move struct layouts and they are not command bodies.

Marketing fixtures are not added to `CommerceProtocol` and do not read the OpenAPI pin. M02’s catalog list is display-only. A recorded presale interest does not place a hold. M05 consent flags keep `channelSend: "none"`.

## Protocol pin

The adapter vendors two OpenAPI files from [kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol). The command catalogue is unchanged. The integration-gate file is the loopback transport description from feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, merged as `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`. Those two commits share one tree. Apps tests start that process from either checkout. The contract-only bytes are unchanged.

Contract-only catalogue, path `docs/contracts/openapi/kix-protocol.contract-only.openapi.json`, recorded at main `a744b0a036d7e1edb48416871af20cd182f23df4`. Those bytes are the same at the integration-gate merge.

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| `info.version` | `0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Source git blob | `619ae21c82ca3df5661bd3831613f15fa65225ff` |
| Status | `contract-only`. `x-kix-live-http-server` and `x-kix-production-endpoint` are false |

Integration-gate transport, path `docs/contracts/openapi/kix-protocol.integration-gate.openapi.json`.

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| `info.version` | `0.3-rc1-integration-gate+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `integration-gate` |
| Live HTTP server | `non-production-local-integration`, production false, public host false, loopback only, bind `127.0.0.1` |
| `x-kix-production-endpoint` | false |
| `x-kix-protocol-truth` | false |
| `x-kix-production-conformance` | false |
| In-flight cap | 8. `durableAcrossRestart` stays false. The optional file journal defaults off |

The rest of kix-protocol is not vendored. These pins are not a production-conformance claim. Load time checks the file bytes. The settlement FSM dependency baseline is protocol main `85145eb33799a7c712890ff81708def8a7d61ee5` (feature commit `838370d9ce8e8aeeceeb94f3b4d212204e7ecf19`). The reservation FSM dependency baseline is protocol main `a47828dd4517c5a7397e09eb6b563a64e4265c82` (feature commit `2183d0b5b5010ec2692c43c277e99926ad9250db`). The resale FSM dependency baseline is protocol main `ef942b7713c7468e8851c6b372b64d42b5333ad8` (feature commit `70c6d52d4289e23d0d4141b7f3a6b310eea236f2`). The credit FSM dependency baseline is protocol main `8c1a4db7cfe70b0e772a2ef0f24492967c84f7f1` (feature commit `4608460ba1fe57165e88e74f6e8d8c23e8e53277`). Those lifecycle names are not catalogue commands. How to run the gate is in [docs/http-integration-gate-apps-bind.md](docs/http-integration-gate-apps-bind.md).

## Settlement depth

The box office reads and commands a mock settlement case through `@kix/protocol-adapter`. The stub keeps phases `INITIATED`, `AUTHORIZED`, `CAPTURED`, `COMMITTED`, `FAILED`, and `CANCELLED`, echoes idempotency keys, leaves `FAILED` and `CANCELLED` immutable, and reports reconcile `matched` only as a process-local journal check. `CAPTURED` and `COMMITTED` on this desk are mock phase names. They are not live funds.

The authoritative machine remains `reference/settlement_f01_f03/settlement_fsm.py` in kix-protocol. This app does not copy the F01–F03 arithmetic. The charter surface `wave3.settlement.F01-F03.fsm` is a label for the desk case. F01, F02, F03, and P04 stay 설계중. Provenance on the case is `MOCK_SETTLEMENT_ONLY`.

`HttpProtocolAdapter` leaves the case commands not-bound. It does not map them onto `settle_capture`. An explicit `invokeLocalCall` may post the published `settle_capture` body to the loopback gate. That receipt is the reference model, not this desk's mock phase, and it is not production settlement. See [docs/settlement-depth-apps-bind.md](docs/settlement-depth-apps-bind.md) and [docs/http-integration-gate-apps-bind.md](docs/http-integration-gate-apps-bind.md).

## Reservation depth

Booking and admission read and command a mock reservation case through `@kix/protocol-adapter`. The stub keeps phases `HELD`, `RELEASED`, `CONFIRMED`, `CANCELLED`, `PAYMENT_NOTED`, `ISSUED`, `ADMISSION_AUTHORIZED`, and `CONSUMED`. `RELEASED`, `CANCELLED`, and `CONSUMED` are terminal. An expired hold stays `HELD` until release. The stub echoes idempotency keys, rejects a second consume, and reports reconcile `matched` only as a process-local journal check.

`economicFinalityClaimed` stays false. A bound issue is refused unless the mock settlement view is `COMMITTED`. That observation is not economic finality. Slot rows are occupancy labels. They do not change catalog capacity and they are not MockGates arithmetic.

The authoritative machine remains `reference/booking_resale_admission/reservation_fsm.py` in kix-protocol. The charter surfaces `wave4.booking.B01-B05.fsm` and `wave4.admission.P03.fsm` are labels for the desk case. B01–B05, R01–R05, and P03 stay 설계중. Provenance on the case is `MOCK_GATE_ONLY`.

`HttpProtocolAdapter` leaves the reservation and admission commands not-bound. It does not map them onto `capture`, `admit`, or a venue scan. An explicit `invokeLocalCall` may post those published bodies to the loopback gate. A reference reject or receipt is not this desk's mock phase and is not live admission. See [docs/reservation-depth-apps-bind.md](docs/reservation-depth-apps-bind.md).

## Resale depth

The resale desk reads and commands a mock resale case through `@kix/protocol-adapter`. The stub keeps phases `LISTED`, `BUY_HELD`, `PAYMENT_NOTED`, `TRANSFERRED`, `CLOSED`, and `CANCELLED`. A right with no live listing is eligible. `CLOSED` and `CANCELLED` are terminal. The stub echoes idempotency keys, rejects a second live listing, a stale version, a consumed or cancelled reservation, and a transfer after the prior holder no longer matches. `economicFinalityClaimed` stays false. A bound transfer is refused unless the mock settlement view is `COMMITTED`. A failed mock settlement stays a non-claim.

The authoritative machine remains `reference/booking_resale_admission/resale_fsm.py` in kix-protocol. The charter surface `wave4.resale.R01-R05.fsm` is a label for the desk case. R01–R05 stay 설계중. Provenance on the case is `MOCK_GATE_ONLY`. Prices and fee splits stay in kix-protocol.

`HttpProtocolAdapter` leaves the resale commands not-bound. It does not map them onto `create_listing`, `accept_trade`, or a marketplace path. An explicit `invokeLocalCall` may post those published bodies to the loopback gate. That is not a live marketplace. See [docs/resale-depth-apps-bind.md](docs/resale-depth-apps-bind.md).

## Credit depth

The credit desk reads and commands a mock credit case through `@kix/protocol-adapter`. The stub keeps phases `OFFERED`, `APPROVED`, `REJECTED`, `CANCELLED`, `DRAWN`, `CLOSED`, and `DEFAULTED`. `REJECTED`, `CANCELLED`, `CLOSED`, and `DEFAULTED` are terminal. The stub echoes idempotency keys, rejects a second draw id, keeps a shared open-face ceiling in process order, and does not free that ceiling on partial repayment. `economicFinalityClaimed` and `fundsExecuted` stay false. A bound draw is refused unless the mock settlement view is `COMMITTED`. A failed mock settlement stays a non-claim.

The authoritative machine remains `reference/credit_advance_f04/credit_fsm.py` in kix-protocol. The charter surface `wave5.credit.F04.fsm` is a label for the desk case. F04 and E06 stay 설계중. Provenance on the case is `MOCK_CREDIT_F04_ONLY`. Amounts are mock units. This client does not port MockCredit arithmetic and does not disburse to a bank.

`HttpProtocolAdapter` leaves the credit commands not-bound. The published catalogue has no credit command, so HTTP mode does not invent a lending endpoint. `offer_gift` is not a credit draw. Live underwriting, KYC-AML, interest, PG or bank rails, and real lending stay on HOLD. The credit desk does not mutate booking or resale ownership. See [docs/credit-depth-apps-bind.md](docs/credit-depth-apps-bind.md).

## Run locally

```bash
npm install
npm test
npm run dev
```

The desk listens on port 5173. Booking state, the marketing session, the mock settlement case, the mock reservation case, the mock resale case, and the mock credit case stay in the browser for that page load. A reload clears them.

The desk uses the stub. Setting `VITE_KIX_PROTOCOL_MODE=http` or `integration-http` without `VITE_KIX_PROTOCOL_API_BASE` throws at startup. It does not fall back to the stub. With `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`, desk calls still throw `not-bound`. Catalogue calls go through `invokeLocalCall` on the adapter. This repo does not start the protocol server and does not ship a production base URL.

To point the app at the reviewed gate, start that server from the kix-protocol checkout at merge `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` and then start this app:

```bash
python3 -m integration_gate --port 8765
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765 npm run dev
```

An optional process-local journal replays committed local calls after a restart of that loopback process. It is not production conformance:

```bash
python3 -m integration_gate --port 8765 --readiness-dir /tmp/kix-ig-journal
```

The process binds `127.0.0.1` only. `GET /health` is liveness. `GET /ready` means the in-memory reference core is loaded, and, when the journal flag is set, that the file recovered or the process is fail-closed. `localFileJournal` is that file bit. `durable` stays false. Neither probe is production readiness. The desk banner shows unavailable and degraded states, and in HTTP mode it reads the probes again on each route change and every 15 seconds.

The reviewed gate does not answer CORS, so from a browser at `:5173` the banner reads unavailable. The desk stays on integration HTTP and does not fall back to the stub. The live gate is exercised by the Node adapter tests. A browser path needs a gate change in kix-protocol. Details are in [docs/http-integration-gate-apps-bind.md](docs/http-integration-gate-apps-bind.md) and [docs/prod-readiness-apps-bind.md](docs/prod-readiness-apps-bind.md).

`npm run build` typechecks the adapter and builds the web app. `npm run typecheck` checks both packages.

## CI

`.github/workflows/ci.yml` runs on pushes to `main`, on pull requests, and on demand. It has two jobs:

- `desk` runs `npm ci`, `npm run typecheck`, `npm run build`, and `npm test`. It sets `KIX_REQUIRE_GATE=0`, so the live gate suites are skipped there on purpose.
- `live-gate` checks out kix-protocol at the pinned merge `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` and runs the adapter suite with `KIX_REQUIRE_GATE=1` against that checkout. kix-protocol is private, so this job needs a `KIX_PROTOCOL_READ_TOKEN` repository secret with read-only contents access to it. A small `gate-token` job checks for the secret first. Without it, `gate-token` posts a warning and `live-gate` shows as skipped, never as a pass.

A test checks that the workflow's gate SHA equals `OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha`. Moving the pin means moving both.

## Tests

`npm test` runs the adapter suite and the web marketing stub:

- hold, confirm, and one-time admission
- resale lock, simulated transfer, and admission of only the new right
- hold release and unknown-right denial
- settlement preview stays a mock code pointer
- the stub settlement case walks mock FSM phases, rejects illegal and terminal mutations, and replays an idempotency key
- HTTP settlement case commands stay not-bound. The desk method does not send `settle_capture`
- settlement panel copy stays mock and does not use production-payment wording
- the stub reservation case walks mock FSM phases, rejects illegal and terminal mutations, replays an idempotency key, and rejects a second consume
- a bound reservation issue stays refused unless the mock settlement view is `COMMITTED`, and `economicFinalityClaimed` stays false
- HTTP reservation and admission FSM commands stay not-bound. The desk methods do not send `capture`, `settle_capture`, or a venue scan
- reservation and admission panel copy stays mock and does not use production-admission wording
- the admission credential walks fresh, stale, transferred, cancelled, already-consumed, and unavailable labels from the adapter
- a credential consume before authorize stays `ADMISSION_REQUIRED` and does not consume the reservation
- HTTP `presentAdmission` reads loopback health only, does not post `admit`, and labels a closed port `unavailable-server`
- a live missing `admit` and an unknown credential both label `invalid`, and `authorize_admission` never leaves the client
- the stub resale case walks mock FSM phases, rejects a second live listing, a stale version, a consumed or cancelled reservation, and a post-transfer replay of the prior holder
- a bound resale transfer stays refused unless the mock settlement view is `COMMITTED`, a failed mock settlement stays a non-claim, and `economicFinalityClaimed` stays false
- HTTP resale FSM commands stay not-bound. The desk methods do not send `create_listing`, `accept_trade`, or `settle_capture`
- resale panel copy stays mock and does not use production-marketplace wording
- the stub credit case walks mock FSM phases, rejects an illegal transition, a second draw, a limit race, and a terminal mutation, and keeps partial repayment from freeing the ceiling
- a bound credit draw stays refused unless the mock settlement view is `COMMITTED`, a failed mock settlement stays a non-claim, and `economicFinalityClaimed` stays false
- HTTP credit FSM commands stay not-bound and do not invent a lending endpoint
- credit panel copy stays mock and does not use production-finance wording
- credit commands do not mutate booking or resale ownership
- HTTP desk methods stay not-bound and do not call `/v1/commerce` or a credit route
- the vendored OpenAPI pin rejects a wrong file sha256, `info.version`, or contract status
- a local-call with an unknown `action` is rejected before any request
- marketing labels stay 설계중, with session-only cards, presale notes, coupon markers, referral markers, and consent flags
- marketing routes render, and the box office route still mounts
- HTTP mode rejects a missing base URL, a public host, `localhost`, and a non-loopback scheme
- production and public mode names are refused and do not select the stub
- a closed port, a stale response, and a degraded ready probe stay on the HTTP adapter and do not retry
- the integration-gate pin rejects a wrong file sha256, a wrong status, a production flag, protocol truth, and production conformance
- adapter tests start `python3 -m integration_gate --port 0` from the reviewed protocol checkout and send settlement, reservation, admission, resale, and credit-adjacent catalogue calls over that transport. On a local run without a checkout those suites are skipped with a warning. A set `KIX_PROTOCOL_ROOT`, `CI=true`, or `KIX_REQUIRE_GATE=1` makes a missing checkout fail. `KIX_REQUIRE_GATE=0` allows the skip
- a redirect off the loopback origin is not followed, a gate that never answers is `REQUEST_TIMEOUT` after one attempt, and a body cut off mid-read is a `ProtocolError`
- a success that is empty, a bare value, a receipt for another call, or a receipt with extra keys is rejected, and nested payment, mode, fee, and finality claims are rejected at any depth
- a `["string", "null"]` schema field accepts null or a checked string, and body keys that only exist on the object prototype are rejected before a request
- resale reconcile stays matched after the reservation is later admitted or consumed
- the box office reaches `COMMITTED` after a mis-ordered click, and each reconcile click checks the case again
- an abandoned booking hold gives its capacity back after it expires, and the booking form returns to Place hold
- with `--readiness-dir`, one committed local call replays after restart and a second id does not apply it again. `durable` stays false
- those desk methods stay not-bound against the live process, unknown actions never leave the client, and a closed port is `GATE_UNAVAILABLE`
- stub replay and HTTP `operationId` replay both avoid a second apply inside their own process, and they do not share a phase journal
