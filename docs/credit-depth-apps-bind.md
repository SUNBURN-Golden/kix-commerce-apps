# Credit depth apps bind

The credit desk renders a mock credit case from the protocol adapter stub. The web app calls `@kix/protocol-adapter` only. It does not fetch kix-protocol, and it does not embed `credit_fsm.py`.

There is no client credit authority. Mock draw and repay are accounting-state labels on the stub. They do not disburse to a bank. The desk does not mutate booking or resale ownership.

## What the stub mirrors

The in-process case uses the protocol phase names:

`OFFERED` → `APPROVED` → `DRAWN` → `CLOSED`

`DRAWN` can stay `DRAWN` across repayment notes. `DEFAULTED` replaces `DRAWN` while mock exposure remains. `REJECTED` and `CANCELLED` are the pre-draw terminals. `REJECTED`, `CANCELLED`, `CLOSED`, and `DEFAULTED` reject later mutation. `reconcile` and `view` still read a terminal case.

The same idempotency key and the same arguments replay the first result (`duplicate: true`). The same key with a different body is `IDEMPOTENCY_CONFLICT`. A rejected key stays rejected in this process. A second `draw_id` on an open draw is `DUPLICATE_DRAW`. The same `draw_id` does not increase exposure again.

Available credit is the offered open face minus reserved mock exposure. A draw takes the full offer amount once. Two cases on one claim are ordered in this process: the later draw is `ADVANCE_EXCEEDS_OPEN_FACE` when it does not fit, and that case stays `APPROVED`. Partial repayment does not free the ceiling. `close` frees it only after outstanding exposure is 0. `default` does not free it.

This stub does not port MockCredit face arithmetic. Confirmed cash, recovery, and refund faces stay in kix-protocol. Amounts here are mock integers. They are not a currency posting.

`economicFinalityClaimed` stays false. `fundsExecuted` stays false. An unbound draw does not observe settlement. A bound draw is refused until the mock settlement case view is `COMMITTED`. A `FAILED` mock settlement view is a settlement failure on the case and still refuses the draw. That observation does not move settlement and does not claim funds.

`rejectUnsupportedCredit` refuses real-funds labels and undefined product labels, including interest and KYC labels. The phase does not change. `CREDIT_BOUNDARY.action` stays `none`. Payloads that carry `disburseCredit` are still rejected.

## Dependency baseline

Protocol main `8c1a4db7cfe70b0e772a2ef0f24492967c84f7f1`.

Feature commit `4608460ba1fe57165e88e74f6e8d8c23e8e53277`.

Machine: `reference/credit_advance_f04/credit_fsm.py`.

Case provenance: `MOCK_CREDIT_F04_ONLY`.

The desk surface `wave5.credit.F04.fsm` is a charter label. Protocol truth remains in kix-protocol. F04 and E06 stay **설계중**.

## OpenAPI pin

The vendored contract-only catalogue is unchanged:

| Pin | Value |
| --- | --- |
| OpenAPI file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |
| Status | `contract-only`. `liveHttpServer` and `productionEndpoint` are false |
| Catalogue tip recorded for that file | `a744b0a036d7e1edb48416871af20cd182f23df4` |

FSM lifecycle names are not OpenAPI operations and are not `protocol_contract` commands. `HttpProtocolAdapter` leaves the credit FSM methods not-bound. It does not invent a lending endpoint and it does not send `settle_capture`.

Stub mode is the default. `mode=http` without a base URL throws.

## Hold

No live underwriting, no KYC-AML, no interest calculation, no PG or bank rail, no real lending, no production credit claim, and no live HTTP server. There is no ownership bypass around the adapter.
