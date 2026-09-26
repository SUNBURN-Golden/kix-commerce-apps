# HTTP integration gate apps bind

This bind points `@kix/protocol-adapter` at the reviewed non-production loopback gate in kix-protocol. Stub mode stays the default. HTTP mode is opt-in. A successful local call is not production deployment approval, not a public endpoint, and not a conformance claim.

The OpenAPI bytes come from feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, merged as `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`. Those commits share one tree. That tip does not add commands. Admission labeling is in [admission-harden-apps-bind.md](admission-harden-apps-bind.md). Operational limits are in [prod-readiness-apps-bind.md](prod-readiness-apps-bind.md).

## What HTTP mode does

`createProtocol({ mode: "http", baseUrl })` builds `HttpProtocolAdapter` only when `baseUrl` is an explicit `http://127.0.0.1:<port>` origin. There is no default host. `https`, `localhost`, a missing port, a path, and any other host are rejected.

The only protocol request is:

`POST /x-kix-contract-only/local-call`

The JSON body is `{ operationId, actor, action, body }`. `action` is one of the 40 published command names. `body` is checked against that command schema in the vendored contract-only catalogue before the request. Unknown actions fail closed in the client.

Desk methods stay not-bound. Their arguments are not those command bodies. The adapter does not invent `/v1` resources for events, tickets, payments, venues, credit, or a marketplace. The web UI imports `@kix/protocol-adapter` and does not call `fetch`.

`GET /health` and `GET /ready` are process probes on the adapter. Health is liveness. Ready means the in-memory reference core loaded. Ready is not production readiness. The probes are not OpenAPI path items.

Responses must carry `X-Kix-Transport: integration-gate`, `X-Kix-Production-Endpoint: false`, `X-Kix-Protocol-Truth: false`, and `X-Kix-Production-Conformance: false`. The client sends `X-Request-Id` and `X-Correlation-Id` and requires the response to echo them. A mismatch is `STALE_RESPONSE`. Any other transport marker is rejected. HTTP 422 and any body with `rejected: true` stay rejects. A closed port is `GATE_UNAVAILABLE`. The client does not retry and does not fall back to the stub.

## Pins

| File | sha256 | Status |
| --- | --- | --- |
| `kix-protocol.contract-only.openapi.json` | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` | `contract-only`. Live server flag false. `productionEndpoint` false |
| `kix-protocol.integration-gate.openapi.json` | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` | `integration-gate`. Mode `non-production-local-integration`. `productionEndpoint` false. Protocol truth false. Production conformance false. Public host false. Loopback only |

Both files pin `protocol_contract.json` sha256 `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` and git blob `619ae21c82ca3df5661bd3831613f15fa65225ff`. The gate `info.version` is `0.3-rc1-integration-gate+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e`.

The contract-only file stays a catalogue. It does not declare this server. The gate file does not add commands.

## Run the reviewed server

From the kix-protocol checkout at the merge above:

```bash
python3 -m integration_gate --port 8765
```

Optional process-local journal. Restart replay is still not production conformance. `durableAcrossRestart` in the pin stays false.

```bash
python3 -m integration_gate --port 8765 --readiness-dir /tmp/kix-ig-journal
```

The process listens on `127.0.0.1` only. Then point this app at that origin:

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765 npm run dev
```

`GET http://127.0.0.1:8765/health` answers when the process is up. `GET http://127.0.0.1:8765/ready` answers when the in-memory core is accepting calls. Desk commands stay not-bound. `presentAdmission` is the one desk read that calls `GET /health` in HTTP mode. It does not post `admit`. The box office, booking, admission, resale, and credit panels keep their mock cases on the stub. They do not become live payment, live admission, a live marketplace, or live credit when the gate is up.

## What the adapter tests run

`packages/protocol-adapter/test/http-integration-gate.test.ts` starts the same module as a subprocess:

```bash
python3 -m integration_gate --port 0
```

The working directory is `KIX_PROTOCOL_ROOT`, or `../kix-protocol-http-gate` when that checkout is present. The test requires that checkout's `HEAD` to be the merge SHA above, requires a clean worktree, and requires the OpenAPI file hashes to match the vendored pins. The process prints `integration-gate listening 127.0.0.1 <port>`. The test uses that port and stops the process when it finishes.

Against that process the test calls:

- settlement catalogue commands `capture` and `settle_capture` (reference reject `TRADE_NOT_FOUND` for a missing trade)
- reservation catalogue commands `reserve_listing` and `release_inventory` (missing listing and missing inventory)
- admission catalogue commands `open_admission` on a created fixture event, and `admit` (missing ticket). `presentAdmission` reads `/health` only. `authorize_admission` and `consume_admission` are rejected before a request. A missing `admit` is labeled `invalid`, the same desk label as an unknown stub credential. A closed port is `unavailable-server`
- resale catalogue commands `create_listing` and `accept_trade` (missing ticket and missing trade)
- credit: desk `offerCredit` and `drawCredit` stay not-bound and send no request. `offer_gift` is sent as itself and rejects `TICKET_NOT_FOUND`. The action `draw` is rejected in the client before a request

`advance_clock` with the same `operationId` and body replays one receipt. A different body for that id is `OPERATION_ID_CONFLICT`. The stub settlement case still replays with `duplicate: true` inside its own journal. Those are separate machines. The HTTP receipt has no desk phase.

Without `--readiness-dir`, the gate state is in-memory. Restarting the process drops it. With that directory, committed local calls replay from the file and a second id does not apply the same effect again. `localFileJournal` reports the file. `durable` on the ready probe stays false. An HTTP `Idempotency-Key` header is not the protocol identity. The client does not send one.

## Hold

No production deploy, no public host, no real PG, no KYC-AML, no venue scan, no bank rail, and no marketplace. External adapters in the gate document stay `forbidden`. F01–F03, B01–B05, R01–R05, P03, F04, and E06 stay 설계중 on their own desks.
