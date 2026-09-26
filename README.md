# kix-commerce-apps

Wave 6 commerce desk for KIX: box office, booking, admission, and resale.
Wave 7 adds marketing screens for ORIGINAL_32 labels M01–M05. Those screens are stub demos and stay 설계중.
This repository is the BeautifulMind-JT app host JunTae selected for product frontends.
Protocol, Move, and settlement contracts stay in [BeautifulMind-JT/kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol).

The UI is an operator desk over a protocol adapter, plus a separate marketing stub. The default adapter is an in-memory stub so the desk can run without a chain. The HTTP adapter is bound to the published contract-only local-call catalogue. It stays fail-closed unless an explicit base URL is configured, and desk methods stay not-bound when no command body matches. Neither adapter moves funds or disburses credit. The box office settlement case is that same stub: mock FSM phases, no live funds. The marketing stub does not call booking, resale, admission, or settlement writes.

## Non-goals

- Product frontend trees do not belong in `kix-protocol`. This repo does not copy Move, the kernel, or settlement math.
- Wave 7 marketing (M01–M05) is a browser-session stub. Labels stay 설계중. Limits are in [docs/wave7-marketing-m01-m05.md](docs/wave7-marketing-m01-m05.md). The contract-only OpenAPI pin is adapter-level. A live HTTP server remains a required gate before chain, payment, production, contract-conformance, or launch claims.
- No real money, no card capture, and no credit disbursement. F04 stays a mock/sim boundary in kix-protocol. This app has no disburse action (`CREDIT_BOUNDARY.action` is `none`).
- No product TPS, p99, or fail-rate SLOs.
- ZARI, film-unit, maeum-gyeol, SOULBOUND, ai-ops-control-plane, and beautiful-mind are out of this wave.
- Stub policies (single admission, hold expiry, resale lock) are desk behavior for tests and the demo. They are not protocol law.

## How the UI maps to kix-protocol

Charter labels are from Task 005. The app names those surfaces and calls an adapter. It does not redefine them.

| Desk | Route | ORIGINAL_32 / wave | Adapter call |
| --- | --- | --- | --- |
| Box office | `/` | E04 client over the catalog; settlement case F01–F03 (Wave 3, mock FSM, 설계중) | `listPerformances`, settlement case commands (`initiateSettlement` through `viewSettlement`) |
| Booking | `/booking/:eventId` | B01–B05 (Wave 4) and a rights reference from Wave 2 `rights` | `placeHold`, `releaseHold`, `confirmBooking` |
| Admission | `/admission` | P03 admission gate, referencing Wave 2 `zk_gate` | `checkAdmission` |
| Resale | `/resale` | R01–R05 (Wave 4) | `openResale`, `listResale`, `acceptResale` |

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

`packages/protocol-adapter` is the only seam:

- `StubProtocolAdapter` — default when `VITE_KIX_PROTOCOL_MODE` is unset or `stub`. In-memory fixtures. `proofMode` is `stub` because `zk_gate` is not evaluated here.
- `HttpProtocolAdapter` — used only when `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE` is an explicit http(s) URL. There is no default base URL. The client loads the vendored contract-only OpenAPI pin and rejects a wrong file sha256, a wrong `info.version`, or a contract status other than `contract-only`. Desk methods are not-bound: none of them has the same body as one of the 40 local-call commands, so they throw before any request. An explicit `invokeLocalCall` may POST `{ operationId, actor, action, body }` to the placeholder path `/x-kix-contract-only/local-call`. That path is marked contract-only in the published document. It is not a live HTTP service, and POST is the OpenAPI grammar slot rather than a published protocol method. `action` must be one of the 40 pinned command names. The `actor` string is only that local-call argument. It is not an authentication result, and this client defines no auth scheme. The client rejects booking payloads that are not marked `simulated-no-funds`, and it rejects settlement payloads that are not `mode: "mock"` with references `F01`, `F02`, `F03`.

View-model field names (`eventId`, `rightsRef`, and the rest) stay local. They are not Move struct layouts and they are not command bodies.

Marketing fixtures are not added to `CommerceProtocol` and do not read the OpenAPI pin. M02’s catalog list is display-only. A recorded presale interest does not place a hold. M05 consent flags keep `channelSend: "none"`.

## Protocol pin

The adapter vendors `packages/protocol-adapter/vendor/kix-protocol.contract-only.openapi.json` from [kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol) `main` `a744b0a036d7e1edb48416871af20cd182f23df4`, path `docs/contracts/openapi/kix-protocol.contract-only.openapi.json`.

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| `info.version` | `0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `contract-only`. `x-kix-live-http-server` and `x-kix-production-endpoint` are false |

The rest of kix-protocol is not vendored. This pin is not a live integration and not a production-conformance claim. The commit id is the recorded main tip of that artifact. Load time checks the file bytes. Settlement depth does not move this pin. The FSM dependency baseline is protocol main `85145eb33799a7c712890ff81708def8a7d61ee5` (feature commit `838370d9ce8e8aeeceeb94f3b4d212204e7ecf19`). Those lifecycle names are not catalogue commands.

## Settlement depth

The box office reads and commands a mock settlement case through `@kix/protocol-adapter`. The stub keeps phases `INITIATED`, `AUTHORIZED`, `CAPTURED`, `COMMITTED`, `FAILED`, and `CANCELLED`, echoes idempotency keys, leaves `FAILED` and `CANCELLED` immutable, and reports reconcile `matched` only as a process-local journal check. `CAPTURED` and `COMMITTED` on this desk are mock phase names. They are not live funds.

The authoritative machine remains `reference/settlement_f01_f03/settlement_fsm.py` in kix-protocol. This app does not copy the F01–F03 arithmetic. The charter surface `wave3.settlement.F01-F03.fsm` is a label for the desk case. F01, F02, F03, and P04 stay 설계중. Provenance on the case is `MOCK_SETTLEMENT_ONLY`.

`HttpProtocolAdapter` leaves the case commands not-bound. It does not send `settle_capture`. Live payment, a live HTTP server, and production integration stay on HOLD. See [docs/settlement-depth-apps-bind.md](docs/settlement-depth-apps-bind.md).

## Run locally

```bash
npm install
npm test
npm run dev
```

The desk listens on port 5173. Booking state, the marketing session, and the mock settlement case stay in the browser for that page load. A reload clears them.

The desk uses the stub. Setting `VITE_KIX_PROTOCOL_MODE=http` without `VITE_KIX_PROTOCOL_API_BASE` throws at startup. With a base URL, desk calls still throw `not-bound`. This repo does not start a server and does not ship a production base URL.

`npm run build` typechecks the adapter and builds the web app. `npm run typecheck` checks both packages.

## Tests

`npm test` runs the adapter suite and the web marketing stub:

- hold, confirm, and one-time admission
- resale lock, simulated transfer, and admission of only the new right
- hold release and unknown-right denial
- settlement preview stays a mock code pointer
- the stub settlement case walks mock FSM phases, rejects illegal and terminal mutations, and replays an idempotency key
- HTTP settlement case commands stay not-bound and do not send `settle_capture`
- settlement panel copy stays mock and does not use production-payment wording
- HTTP desk methods stay not-bound and do not call `/v1/commerce` or a credit route
- the vendored OpenAPI pin rejects a wrong file sha256, `info.version`, or contract status
- a local-call with an unknown `action` is rejected before any request
- marketing labels stay 설계중, with session-only cards, presale notes, coupon markers, referral markers, and consent flags
- marketing routes render, and the box office route still mounts
