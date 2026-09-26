# Reservation depth apps bind

Booking and admission render a mock reservation case from the protocol adapter stub. The web app calls `@kix/protocol-adapter` only. It does not fetch kix-protocol, and it does not embed `reservation_fsm.py`.

## What the stub mirrors

The in-process case uses the protocol phase names:

`HELD` → `CONFIRMED` → `PAYMENT_NOTED` → `ISSUED` → `ADMISSION_AUTHORIZED` → `CONSUMED`

`RELEASED` replaces a hold only when release runs. An expired mock hold stays `HELD` until that release. `CANCELLED` is the pre-payment terminal. `RELEASED`, `CANCELLED`, and `CONSUMED` reject later mutation. `reconcile` and `view` still read a terminal case.

The same idempotency key and the same arguments replay the first result (`duplicate: true`). The same key with a different body is `IDEMPOTENCY_CONFLICT`. A rejected key stays rejected. The desk advances its key after a mock rejection and keeps that counter for the browser tab, so a later click can use a new key. A second consume is `ALREADY_CONSUMED`. Reconcile `matched: true` means this process replayed its own journal and the case still agreed. It is not admission routing, not a venue scan, and not chain finality.

Slot rows are occupancy labels (`FREE`, `RESERVED`, `ISSUED`). They are not catalog capacity and not MockGates arithmetic. The Wave 4 `placeHold` counter stays a separate desk pointer.

`economicFinalityClaimed` stays false. Issue with no settlement binding stays unbound. A bound issue is refused until the mock settlement case view is `COMMITTED`. That observation does not move settlement and does not claim funds. Prices, shares, and inventory math stay in kix-protocol.

## Dependency baseline

Protocol main `a47828dd4517c5a7397e09eb6b563a64e4265c82`.

Feature commit `2183d0b5b5010ec2692c43c277e99926ad9250db`.

Machine: `reference/booking_resale_admission/reservation_fsm.py`.

Case provenance: `MOCK_GATE_ONLY`.

The desk surfaces `wave4.booking.B01-B05.fsm` and `wave4.admission.P03.fsm` are charter labels. Protocol truth remains in kix-protocol. B01–B05, R01–R05, and P03 stay **설계중**.

## OpenAPI pin

The vendored contract-only catalogue is unchanged:

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `contract-only`. `liveHttpServer` and `productionEndpoint` are false |
| Catalogue tip recorded for that file | `a744b0a036d7e1edb48416871af20cd182f23df4` |

FSM lifecycle names are not OpenAPI operations and are not `protocol_contract` commands. `HttpProtocolAdapter` leaves the reservation and admission FSM methods not-bound. It does not send `capture` or `settle_capture`, and it does not invent a venue scan endpoint.

Stub mode is the default. `mode=http` without a base URL throws.

## Hold

No live admission, no venue inventory, no production ticket issuance, no live HTTP server, and no PG or bank settlement. This bind does not expand resale or credit.
