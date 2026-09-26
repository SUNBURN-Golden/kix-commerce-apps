# Settlement depth apps bind

The box office renders a mock settlement case from the protocol adapter stub. The web app calls `@kix/protocol-adapter` only. It does not fetch kix-protocol, and it does not embed `settlement_fsm.py`.

## What the stub mirrors

The in-process case uses the protocol phase names:

`INITIATED` → `AUTHORIZED` → `CAPTURED` → `COMMITTED`

`FAILED` and `CANCELLED` are the terminal phases. A later mutation command is rejected and the phase stays put. `reconcile` and `view` still read a terminal case.

The same idempotency key and the same arguments replay the first result (`duplicate: true`). The same key with a different body is `IDEMPOTENCY_CONFLICT`. Reconcile `matched: true` means this process replayed its own journal and the case still agreed. It is not a bank match, not exactly-once funds, and not chain finality.

Amounts, fee splits, and refund arithmetic stay in kix-protocol. This app does not compute them and does not put an amount on the case.

## Dependency baseline

Protocol main `85145eb33799a7c712890ff81708def8a7d61ee5`.

Feature commit `838370d9ce8e8aeeceeb94f3b4d212204e7ecf19`.

Machine: `reference/settlement_f01_f03/settlement_fsm.py`.

Case provenance: `MOCK_SETTLEMENT_ONLY`.

The desk surface `wave3.settlement.F01-F03.fsm` is a charter label. Protocol truth remains in kix-protocol. F01, F02, F03, and P04 stay **설계중**.

## OpenAPI pin

The vendored contract-only catalogue is unchanged:

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `contract-only`. `liveHttpServer` and `productionEndpoint` are false |
| Catalogue tip recorded for that file | `a744b0a036d7e1edb48416871af20cd182f23df4` |

FSM lifecycle names are not OpenAPI operations and are not `protocol_contract` commands. `HttpProtocolAdapter` leaves `initiateSettlement`, `authorizeSettlement`, `captureSettlement`, `commitSettlement`, `failSettlement`, `cancelSettlement`, `reconcileSettlement`, and `viewSettlement` not-bound. `settle_capture` remains a published catalogue command. The desk does not map the mock case onto it. An explicit `invokeLocalCall` may post that body to the loopback integration gate. The reference result is not this desk's mock phase.

Stub mode is the default. `mode=http` requires an explicit `http://127.0.0.1` origin. See [http-integration-gate-apps-bind.md](http-integration-gate-apps-bind.md).

## Hold

No live payment, no card capture, no PG or bank settlement, and no production endpoint. Local HTTP success is not production approval.
