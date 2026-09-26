# Resale depth apps bind

The resale desk renders a mock resale case from the protocol adapter stub. The web app calls `@kix/protocol-adapter` only. It does not fetch kix-protocol, and it does not embed `resale_fsm.py`.

The Wave 4 `openResale`, `listResale`, and `acceptResale` pointers stay on the same page. They are not the FSM case.

## What the stub mirrors

The in-process case uses the protocol listing phases:

`LISTED` → `BUY_HELD` → `PAYMENT_NOTED` → `TRANSFERRED` → `CLOSED`

`PAYMENT_NOTED` can also follow `LISTED` directly. `CANCELLED` is the open-sale terminal. `CLOSED` and `CANCELLED` reject later mutation. `TRANSFERRED` is not terminal until close. `reconcile` and `view` still read a terminal case.

A right with no live listing is `ELIGIBLE`. A live listing locks that right. A second open listing is `RIGHT_SALE_LOCKED`. A listed version other than the holder version is `STALE_VERSION`. After transfer the holder version moves by one, the prior presentation no longer matches, and `priorCredentialInvalidated` is true. That flag is not a venue credential reissue.

The same idempotency key and the same arguments replay the first result (`duplicate: true`). The same key with a different body is `IDEMPOTENCY_CONFLICT`. A rejected key stays rejected. A consumed reservation is `ALREADY_CONSUMED`. A cancelled reservation is `TICKET_CANCELLED`. Reconcile `matched: true` means this process replayed its own journal and the case still agreed. It is not a marketplace match and not chain finality.

`economicFinalityClaimed` stays false. An unbound transfer does not observe a settlement commit. A bound transfer is refused until the mock settlement case view is `COMMITTED`. A `FAILED` mock settlement view is a settlement failure on the case and still refuses the transfer. That observation does not move settlement and does not claim funds. Prices, fee splits, caps, and inventory math stay in kix-protocol.

## Dependency baseline

Protocol main `ef942b7713c7468e8851c6b372b64d42b5333ad8`.

Feature commit `70c6d52d4289e23d0d4141b7f3a6b310eea236f2`.

Machine: `reference/booking_resale_admission/resale_fsm.py`.

Case provenance: `MOCK_GATE_ONLY`.

The desk surface `wave4.resale.R01-R05.fsm` is a charter label. Protocol truth remains in kix-protocol. R01–R05 stay **설계중**.

## OpenAPI pin

The vendored contract-only catalogue is unchanged:

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `contract-only`. `liveHttpServer` and `productionEndpoint` are false |
| Catalogue tip recorded for that file | `a744b0a036d7e1edb48416871af20cd182f23df4` |

FSM lifecycle names are not OpenAPI operations and are not `protocol_contract` commands. `HttpProtocolAdapter` leaves the resale FSM methods not-bound. It does not send `create_listing`, `accept_trade`, or `settle_capture`, and it does not invent a marketplace endpoint.

Stub mode is the default. `mode=http` without a base URL throws.

## Hold

No live marketplace, no identity KYC, no venue credential reissue, no live HTTP server, and no PG or bank settlement. This bind does not write the credit case. Credit depth is a separate adapter stub. There is no ownership bypass around the adapter.
