# Production-readiness apps bind

This bind is the desk side of the loopback readiness journal. It does not deploy the desk, and it does not turn a local file into production conformance.

Stub mode stays the default. `VITE_KIX_PROTOCOL_MODE=http` and `integration-http` are the same explicit loopback environment. Names such as `production`, `prod`, and `public` are refused. They do not select the stub. A failed HTTP call stays on `HttpProtocolAdapter`.

Public production deployment, DNS, TLS productization, live PG, KYC, venue, and bank rails stay on HOLD.

## What changed

The contract-only catalogue pin is unchanged. The integration-gate file moved with protocol PR #71.

| Pin | Value |
| --- | --- |
| Contract-only OpenAPI sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Integration-gate OpenAPI sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Protocol merge | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` |
| Protocol feature | `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd` |

Those two protocol commits share one tree. The gate document still has 40 commands, no `servers` entry, `productionEndpoint` false, and `publicHost` false. `x-kix-protocol-truth` and `x-kix-production-conformance` are false. `durableAcrossRestart` stays false. `maxInFlight` is 8. The optional file journal defaults off.

## Runtime

`createProtocol()` with no mode builds the stub. HTTP mode still requires `http://127.0.0.1:<port>`. There is no default host.

Each local call is one attempt. The client does not loop, does not retry a non-idempotent command, and does not send `Idempotency-Key`. The identity remains `envelope.operationId`. A different fingerprint for that id is still `OPERATION_ID_CONFLICT`.

The client sends `X-Request-Id` and `X-Correlation-Id`. The response must echo both. A mismatch is `STALE_RESPONSE` and is not applied. Those ids are transport correlation. They are not an authentication result and not client authority.

Responses must also carry `X-Kix-Transport: integration-gate`, `X-Kix-Production-Endpoint: false`, `X-Kix-Protocol-Truth: false`, and `X-Kix-Production-Conformance: false`.

`observeTransport` reads `GET /health` and then `GET /ready`. Health is liveness. Ready means the reference core is loaded. When `--readiness-dir` is set, ready also reports `localFileJournal: true` and a `journalRecords` count. `durable` stays false. `productionReadiness` stays false. `NOT_READY`, `OVERLOADED`, `CORE_BUSY`, and `JOURNAL_BUDGET` are degraded. A closed port, a stale response, a transport mismatch, and a production claim are unavailable. The desk banner prints that state. It does not switch the adapter to the stub.

A reachable gate is still not venue entry. `presentAdmission` reads health only and does not post `admit`.

## Run the reviewed server

From the kix-protocol checkout at the merge above. The feature commit is the same tree.

```bash
python3 -m integration_gate --port 8765
```

Optional process-local journal. This is still loopback-only. It is not production conformance.

```bash
python3 -m integration_gate --port 8765 --readiness-dir /tmp/kix-ig-journal
```

The process binds `127.0.0.1` only. The in-flight cap defaults to 8. Then:

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765 npm run dev
```

Without the base URL, HTTP mode throws at startup. Desk methods stay not-bound. A successful local call is not production approval.

## Hold

No public deploy, no public host, no secrets manager, no live PG, no KYC-AML, no venue scan, no bank rail, and no production-conformance claim. F01–F03, B01–B05, R01–R05, P03, F04, and E06 stay 설계중 on their own desks.
