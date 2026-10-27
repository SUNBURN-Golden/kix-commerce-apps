# Composer offline HTTP conformance

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

Acceptance 2 applies to every mutation row without exception: each expects a coded ProtocolError after exactly one fetch and fences the next write with zero further fetches. The previously cited October 26 amendment is absent from the authoritative rulings supplied for fix round 2 and is not relied upon.

The existing predicates are preserved: [organizer receipt checks](organizer-admin-console-apps-bind.md#receipt-checks) permit other keys for `close_sales` (only `salesStatus === "CLOSED"`) and `issue_invitation` (nonempty `ticketId`, `financialEntries === 0`); `complete_event` and `cancel_event` only require a record. The HTTP boundary additionally closes these four results to their existing app fixture keys: `salesStatus`; `ticketId`, `financialEntries`; and an empty result for `complete_event` and `cancel_event`. These are app guards, not a producer schema or an SDK receipt contract.

All fixtures are deterministic app shapes, not generated SDK receipt types or live gate receipts. Eleven actions, 88 enumerated paths, six mutations per path and twelve envelope/header/origin/array cases per action give **660 rows per seed**: 660 errors. Seeds 0, 7 and 0xffffffff give **1,980 mutation executions**, 33 unmodified success replays, and 36 hostile JSON replays (one action per composer). Trace generation is mocked for every new invocation; fake timers must be empty and mocks/timers are restored in a finally block.

The contextual gift acceptance predicate still rejects missing offer context and compares ticket/recipient with the offer. The HTTP boundary separately checks the closed structural shape and cannot establish the offer's ticket or recipient from the accept body. Composer causal equality checks remain intact. Shared readers load dynamically at the HTTP boundary; route composers share them directly.

No additional command is composed or rebound. Stub remains default; offline HTTP uses an injected fetch double at http://127.0.0.1 only, one request, manual redirect handling, no Idempotency-Key or fallback. The new conformance suite opens no sockets. Required existing repository tests include their pre-existing loopback transport server regressions; no reviewed/live gate is launched. Live suites at KIX_REQUIRE_GATE=0 are skipped, never passed. No catalogue, pin, vendor, binding or CI changes.

## Sweep table (seed 7)

The table is emitted by the test and compared verbatim. Codes are asserted expectations, selected before execution. Missing x-kix-production-endpoint expects GATE_TRANSPORT. Every row expects an error code; there are no ACCEPT exceptions.

<!-- composer-loopback-sweep:start -->
| Fixture | Path | Mutation | Expected outcome |
| --- | --- | --- | --- |
| gift.offer_gift.success | $ | delete | GATE_STATUS |
| gift.offer_gift.success | $ | swapType | GATE_STATUS |
| gift.offer_gift.success | $ | addKey | GATE_STATUS |
| gift.offer_gift.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $ | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.domain | delete | GATE_STATUS |
| gift.offer_gift.success | $.domain | swapType | GATE_STATUS |
| gift.offer_gift.success | $.domain | addKey | GATE_STATUS |
| gift.offer_gift.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.operationId | delete | GATE_STATUS |
| gift.offer_gift.success | $.operationId | swapType | GATE_STATUS |
| gift.offer_gift.success | $.operationId | addKey | GATE_STATUS |
| gift.offer_gift.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.sequence | delete | GATE_STATUS |
| gift.offer_gift.success | $.sequence | swapType | GATE_STATUS |
| gift.offer_gift.success | $.sequence | addKey | GATE_STATUS |
| gift.offer_gift.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.action | delete | GATE_STATUS |
| gift.offer_gift.success | $.action | swapType | GATE_STATUS |
| gift.offer_gift.success | $.action | addKey | GATE_STATUS |
| gift.offer_gift.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.action | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.result | delete | GATE_STATUS |
| gift.offer_gift.success | $.result | swapType | GATE_STATUS |
| gift.offer_gift.success | $.result | addKey | GATE_STATUS |
| gift.offer_gift.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.result | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.result.giftId | delete | GATE_STATUS |
| gift.offer_gift.success | $.result.giftId | swapType | GATE_STATUS |
| gift.offer_gift.success | $.result.giftId | addKey | GATE_STATUS |
| gift.offer_gift.success | $.result.giftId | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.result.giftId | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.result.giftId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $.result.termsHash | delete | GATE_STATUS |
| gift.offer_gift.success | $.result.termsHash | swapType | GATE_STATUS |
| gift.offer_gift.success | $.result.termsHash | addKey | GATE_STATUS |
| gift.offer_gift.success | $.result.termsHash | inject:economicFinalityClaimed | GATE_STATUS |
| gift.offer_gift.success | $.result.termsHash | inject:fundsExecuted | GATE_STATUS |
| gift.offer_gift.success | $.result.termsHash | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $ | operationId:changed | GATE_STATUS |
| gift.offer_gift.success | $ | action:other-pinned | GATE_STATUS |
| gift.offer_gift.success | $ | action:unpinned | GATE_STATUS |
| gift.offer_gift.success | $headers | drop:x-request-id | STALE_RESPONSE |
| gift.offer_gift.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| gift.offer_gift.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| gift.offer_gift.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| gift.offer_gift.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| gift.offer_gift.success | $origin | origin:other-port | GATE_TRANSPORT |
| gift.offer_gift.success | $origin | origin:localhost | GATE_TRANSPORT |
| gift.offer_gift.success | $ | array:two-receipts | GATE_STATUS |
| gift.accept_gift.success | $ | delete | GATE_STATUS |
| gift.accept_gift.success | $ | swapType | GATE_STATUS |
| gift.accept_gift.success | $ | addKey | GATE_STATUS |
| gift.accept_gift.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $ | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.domain | delete | GATE_STATUS |
| gift.accept_gift.success | $.domain | swapType | GATE_STATUS |
| gift.accept_gift.success | $.domain | addKey | GATE_STATUS |
| gift.accept_gift.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.operationId | delete | GATE_STATUS |
| gift.accept_gift.success | $.operationId | swapType | GATE_STATUS |
| gift.accept_gift.success | $.operationId | addKey | GATE_STATUS |
| gift.accept_gift.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.sequence | delete | GATE_STATUS |
| gift.accept_gift.success | $.sequence | swapType | GATE_STATUS |
| gift.accept_gift.success | $.sequence | addKey | GATE_STATUS |
| gift.accept_gift.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.action | delete | GATE_STATUS |
| gift.accept_gift.success | $.action | swapType | GATE_STATUS |
| gift.accept_gift.success | $.action | addKey | GATE_STATUS |
| gift.accept_gift.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.action | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.result | delete | GATE_STATUS |
| gift.accept_gift.success | $.result | swapType | GATE_STATUS |
| gift.accept_gift.success | $.result | addKey | GATE_STATUS |
| gift.accept_gift.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.result | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.result.ticketId | delete | GATE_STATUS |
| gift.accept_gift.success | $.result.ticketId | swapType | GATE_STATUS |
| gift.accept_gift.success | $.result.ticketId | addKey | GATE_STATUS |
| gift.accept_gift.success | $.result.ticketId | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.result.ticketId | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.result.ticketId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.result.owner | delete | GATE_STATUS |
| gift.accept_gift.success | $.result.owner | swapType | GATE_STATUS |
| gift.accept_gift.success | $.result.owner | addKey | GATE_STATUS |
| gift.accept_gift.success | $.result.owner | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.result.owner | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.result.owner | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.result.rightsVersion | delete | GATE_STATUS |
| gift.accept_gift.success | $.result.rightsVersion | swapType | GATE_STATUS |
| gift.accept_gift.success | $.result.rightsVersion | addKey | GATE_STATUS |
| gift.accept_gift.success | $.result.rightsVersion | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.result.rightsVersion | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.result.rightsVersion | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $.result.financialEntries | delete | GATE_STATUS |
| gift.accept_gift.success | $.result.financialEntries | swapType | GATE_STATUS |
| gift.accept_gift.success | $.result.financialEntries | addKey | GATE_STATUS |
| gift.accept_gift.success | $.result.financialEntries | inject:economicFinalityClaimed | GATE_STATUS |
| gift.accept_gift.success | $.result.financialEntries | inject:fundsExecuted | GATE_STATUS |
| gift.accept_gift.success | $.result.financialEntries | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $ | operationId:changed | GATE_STATUS |
| gift.accept_gift.success | $ | action:other-pinned | GATE_STATUS |
| gift.accept_gift.success | $ | action:unpinned | GATE_STATUS |
| gift.accept_gift.success | $headers | drop:x-request-id | STALE_RESPONSE |
| gift.accept_gift.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| gift.accept_gift.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| gift.accept_gift.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| gift.accept_gift.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| gift.accept_gift.success | $origin | origin:other-port | GATE_TRANSPORT |
| gift.accept_gift.success | $origin | origin:localhost | GATE_TRANSPORT |
| gift.accept_gift.success | $ | array:two-receipts | GATE_STATUS |
| gift.cancel_gift.success | $ | delete | GATE_STATUS |
| gift.cancel_gift.success | $ | swapType | GATE_STATUS |
| gift.cancel_gift.success | $ | addKey | GATE_STATUS |
| gift.cancel_gift.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $ | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.domain | delete | GATE_STATUS |
| gift.cancel_gift.success | $.domain | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.domain | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.operationId | delete | GATE_STATUS |
| gift.cancel_gift.success | $.operationId | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.operationId | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.sequence | delete | GATE_STATUS |
| gift.cancel_gift.success | $.sequence | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.sequence | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.action | delete | GATE_STATUS |
| gift.cancel_gift.success | $.action | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.action | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.action | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.result | delete | GATE_STATUS |
| gift.cancel_gift.success | $.result | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.result | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.result | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $.result.giftState | delete | GATE_STATUS |
| gift.cancel_gift.success | $.result.giftState | swapType | GATE_STATUS |
| gift.cancel_gift.success | $.result.giftState | addKey | GATE_STATUS |
| gift.cancel_gift.success | $.result.giftState | inject:economicFinalityClaimed | GATE_STATUS |
| gift.cancel_gift.success | $.result.giftState | inject:fundsExecuted | GATE_STATUS |
| gift.cancel_gift.success | $.result.giftState | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $ | operationId:changed | GATE_STATUS |
| gift.cancel_gift.success | $ | action:other-pinned | GATE_STATUS |
| gift.cancel_gift.success | $ | action:unpinned | GATE_STATUS |
| gift.cancel_gift.success | $headers | drop:x-request-id | STALE_RESPONSE |
| gift.cancel_gift.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| gift.cancel_gift.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| gift.cancel_gift.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| gift.cancel_gift.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| gift.cancel_gift.success | $origin | origin:other-port | GATE_TRANSPORT |
| gift.cancel_gift.success | $origin | origin:localhost | GATE_TRANSPORT |
| gift.cancel_gift.success | $ | array:two-receipts | GATE_STATUS |
| organizer.create_event.success | $ | delete | GATE_STATUS |
| organizer.create_event.success | $ | swapType | GATE_STATUS |
| organizer.create_event.success | $ | addKey | GATE_STATUS |
| organizer.create_event.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.domain | delete | GATE_STATUS |
| organizer.create_event.success | $.domain | swapType | GATE_STATUS |
| organizer.create_event.success | $.domain | addKey | GATE_STATUS |
| organizer.create_event.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.operationId | delete | GATE_STATUS |
| organizer.create_event.success | $.operationId | swapType | GATE_STATUS |
| organizer.create_event.success | $.operationId | addKey | GATE_STATUS |
| organizer.create_event.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.sequence | delete | GATE_STATUS |
| organizer.create_event.success | $.sequence | swapType | GATE_STATUS |
| organizer.create_event.success | $.sequence | addKey | GATE_STATUS |
| organizer.create_event.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.action | delete | GATE_STATUS |
| organizer.create_event.success | $.action | swapType | GATE_STATUS |
| organizer.create_event.success | $.action | addKey | GATE_STATUS |
| organizer.create_event.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result | delete | GATE_STATUS |
| organizer.create_event.success | $.result | swapType | GATE_STATUS |
| organizer.create_event.success | $.result | addKey | GATE_STATUS |
| organizer.create_event.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result.eventId | delete | GATE_STATUS |
| organizer.create_event.success | $.result.eventId | swapType | GATE_STATUS |
| organizer.create_event.success | $.result.eventId | addKey | GATE_STATUS |
| organizer.create_event.success | $.result.eventId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result.eventId | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result.eventId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result.policyHash | delete | GATE_STATUS |
| organizer.create_event.success | $.result.policyHash | swapType | GATE_STATUS |
| organizer.create_event.success | $.result.policyHash | addKey | GATE_STATUS |
| organizer.create_event.success | $.result.policyHash | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result.policyHash | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result.policyHash | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result.inventoryIds | delete | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds | swapType | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds | addKey | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result.inventoryIds.0 | delete | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds.0 | swapType | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds.0 | addKey | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds.0 | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds.0 | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result.inventoryIds.0 | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $.result.reservationSeconds | delete | GATE_STATUS |
| organizer.create_event.success | $.result.reservationSeconds | swapType | GATE_STATUS |
| organizer.create_event.success | $.result.reservationSeconds | addKey | GATE_STATUS |
| organizer.create_event.success | $.result.reservationSeconds | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.create_event.success | $.result.reservationSeconds | inject:fundsExecuted | GATE_STATUS |
| organizer.create_event.success | $.result.reservationSeconds | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $ | operationId:changed | GATE_STATUS |
| organizer.create_event.success | $ | action:other-pinned | GATE_STATUS |
| organizer.create_event.success | $ | action:unpinned | GATE_STATUS |
| organizer.create_event.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.create_event.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.create_event.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.create_event.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.create_event.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.create_event.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.create_event.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.create_event.success | $ | array:two-receipts | GATE_STATUS |
| organizer.close_sales.success | $ | delete | GATE_STATUS |
| organizer.close_sales.success | $ | swapType | GATE_STATUS |
| organizer.close_sales.success | $ | addKey | GATE_STATUS |
| organizer.close_sales.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.domain | delete | GATE_STATUS |
| organizer.close_sales.success | $.domain | swapType | GATE_STATUS |
| organizer.close_sales.success | $.domain | addKey | GATE_STATUS |
| organizer.close_sales.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.operationId | delete | GATE_STATUS |
| organizer.close_sales.success | $.operationId | swapType | GATE_STATUS |
| organizer.close_sales.success | $.operationId | addKey | GATE_STATUS |
| organizer.close_sales.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.sequence | delete | GATE_STATUS |
| organizer.close_sales.success | $.sequence | swapType | GATE_STATUS |
| organizer.close_sales.success | $.sequence | addKey | GATE_STATUS |
| organizer.close_sales.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.action | delete | GATE_STATUS |
| organizer.close_sales.success | $.action | swapType | GATE_STATUS |
| organizer.close_sales.success | $.action | addKey | GATE_STATUS |
| organizer.close_sales.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.result | delete | GATE_STATUS |
| organizer.close_sales.success | $.result | swapType | GATE_STATUS |
| organizer.close_sales.success | $.result | addKey | GATE_STATUS |
| organizer.close_sales.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $.result.salesStatus | delete | GATE_STATUS |
| organizer.close_sales.success | $.result.salesStatus | swapType | GATE_STATUS |
| organizer.close_sales.success | $.result.salesStatus | addKey | GATE_STATUS |
| organizer.close_sales.success | $.result.salesStatus | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.close_sales.success | $.result.salesStatus | inject:fundsExecuted | GATE_STATUS |
| organizer.close_sales.success | $.result.salesStatus | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $ | operationId:changed | GATE_STATUS |
| organizer.close_sales.success | $ | action:other-pinned | GATE_STATUS |
| organizer.close_sales.success | $ | action:unpinned | GATE_STATUS |
| organizer.close_sales.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.close_sales.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.close_sales.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.close_sales.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.close_sales.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.close_sales.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.close_sales.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.close_sales.success | $ | array:two-receipts | GATE_STATUS |
| organizer.open_admission.success | $ | delete | GATE_STATUS |
| organizer.open_admission.success | $ | swapType | GATE_STATUS |
| organizer.open_admission.success | $ | addKey | GATE_STATUS |
| organizer.open_admission.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.domain | delete | GATE_STATUS |
| organizer.open_admission.success | $.domain | swapType | GATE_STATUS |
| organizer.open_admission.success | $.domain | addKey | GATE_STATUS |
| organizer.open_admission.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.operationId | delete | GATE_STATUS |
| organizer.open_admission.success | $.operationId | swapType | GATE_STATUS |
| organizer.open_admission.success | $.operationId | addKey | GATE_STATUS |
| organizer.open_admission.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.sequence | delete | GATE_STATUS |
| organizer.open_admission.success | $.sequence | swapType | GATE_STATUS |
| organizer.open_admission.success | $.sequence | addKey | GATE_STATUS |
| organizer.open_admission.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.action | delete | GATE_STATUS |
| organizer.open_admission.success | $.action | swapType | GATE_STATUS |
| organizer.open_admission.success | $.action | addKey | GATE_STATUS |
| organizer.open_admission.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.result | delete | GATE_STATUS |
| organizer.open_admission.success | $.result | swapType | GATE_STATUS |
| organizer.open_admission.success | $.result | addKey | GATE_STATUS |
| organizer.open_admission.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $.result.admissionStatus | delete | GATE_STATUS |
| organizer.open_admission.success | $.result.admissionStatus | swapType | GATE_STATUS |
| organizer.open_admission.success | $.result.admissionStatus | addKey | GATE_STATUS |
| organizer.open_admission.success | $.result.admissionStatus | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.open_admission.success | $.result.admissionStatus | inject:fundsExecuted | GATE_STATUS |
| organizer.open_admission.success | $.result.admissionStatus | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $ | operationId:changed | GATE_STATUS |
| organizer.open_admission.success | $ | action:other-pinned | GATE_STATUS |
| organizer.open_admission.success | $ | action:unpinned | GATE_STATUS |
| organizer.open_admission.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.open_admission.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.open_admission.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.open_admission.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.open_admission.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.open_admission.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.open_admission.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.open_admission.success | $ | array:two-receipts | GATE_STATUS |
| organizer.complete_event.success | $ | delete | GATE_STATUS |
| organizer.complete_event.success | $ | swapType | GATE_STATUS |
| organizer.complete_event.success | $ | addKey | GATE_STATUS |
| organizer.complete_event.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $.domain | delete | GATE_STATUS |
| organizer.complete_event.success | $.domain | swapType | GATE_STATUS |
| organizer.complete_event.success | $.domain | addKey | GATE_STATUS |
| organizer.complete_event.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $.operationId | delete | GATE_STATUS |
| organizer.complete_event.success | $.operationId | swapType | GATE_STATUS |
| organizer.complete_event.success | $.operationId | addKey | GATE_STATUS |
| organizer.complete_event.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $.sequence | delete | GATE_STATUS |
| organizer.complete_event.success | $.sequence | swapType | GATE_STATUS |
| organizer.complete_event.success | $.sequence | addKey | GATE_STATUS |
| organizer.complete_event.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $.action | delete | GATE_STATUS |
| organizer.complete_event.success | $.action | swapType | GATE_STATUS |
| organizer.complete_event.success | $.action | addKey | GATE_STATUS |
| organizer.complete_event.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $.result | delete | GATE_STATUS |
| organizer.complete_event.success | $.result | swapType | GATE_STATUS |
| organizer.complete_event.success | $.result | addKey | GATE_STATUS |
| organizer.complete_event.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.complete_event.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.complete_event.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $ | operationId:changed | GATE_STATUS |
| organizer.complete_event.success | $ | action:other-pinned | GATE_STATUS |
| organizer.complete_event.success | $ | action:unpinned | GATE_STATUS |
| organizer.complete_event.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.complete_event.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.complete_event.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.complete_event.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.complete_event.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.complete_event.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.complete_event.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.complete_event.success | $ | array:two-receipts | GATE_STATUS |
| organizer.cancel_event.success | $ | delete | GATE_STATUS |
| organizer.cancel_event.success | $ | swapType | GATE_STATUS |
| organizer.cancel_event.success | $ | addKey | GATE_STATUS |
| organizer.cancel_event.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $.domain | delete | GATE_STATUS |
| organizer.cancel_event.success | $.domain | swapType | GATE_STATUS |
| organizer.cancel_event.success | $.domain | addKey | GATE_STATUS |
| organizer.cancel_event.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $.operationId | delete | GATE_STATUS |
| organizer.cancel_event.success | $.operationId | swapType | GATE_STATUS |
| organizer.cancel_event.success | $.operationId | addKey | GATE_STATUS |
| organizer.cancel_event.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $.sequence | delete | GATE_STATUS |
| organizer.cancel_event.success | $.sequence | swapType | GATE_STATUS |
| organizer.cancel_event.success | $.sequence | addKey | GATE_STATUS |
| organizer.cancel_event.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $.action | delete | GATE_STATUS |
| organizer.cancel_event.success | $.action | swapType | GATE_STATUS |
| organizer.cancel_event.success | $.action | addKey | GATE_STATUS |
| organizer.cancel_event.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $.result | delete | GATE_STATUS |
| organizer.cancel_event.success | $.result | swapType | GATE_STATUS |
| organizer.cancel_event.success | $.result | addKey | GATE_STATUS |
| organizer.cancel_event.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.cancel_event.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.cancel_event.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $ | operationId:changed | GATE_STATUS |
| organizer.cancel_event.success | $ | action:other-pinned | GATE_STATUS |
| organizer.cancel_event.success | $ | action:unpinned | GATE_STATUS |
| organizer.cancel_event.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.cancel_event.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.cancel_event.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.cancel_event.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.cancel_event.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.cancel_event.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.cancel_event.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.cancel_event.success | $ | array:two-receipts | GATE_STATUS |
| organizer.issue_invitation.success | $ | delete | GATE_STATUS |
| organizer.issue_invitation.success | $ | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $ | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $ | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.domain | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.domain | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.domain | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.operationId | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.operationId | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.operationId | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.sequence | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.sequence | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.sequence | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.action | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.action | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.action | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.action | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.result | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.result | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.result | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.result | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.result.ticketId | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.result.ticketId | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.result.ticketId | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.result.ticketId | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.result.ticketId | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.result.ticketId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $.result.financialEntries | delete | GATE_STATUS |
| organizer.issue_invitation.success | $.result.financialEntries | swapType | GATE_STATUS |
| organizer.issue_invitation.success | $.result.financialEntries | addKey | GATE_STATUS |
| organizer.issue_invitation.success | $.result.financialEntries | inject:economicFinalityClaimed | GATE_STATUS |
| organizer.issue_invitation.success | $.result.financialEntries | inject:fundsExecuted | GATE_STATUS |
| organizer.issue_invitation.success | $.result.financialEntries | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $ | operationId:changed | GATE_STATUS |
| organizer.issue_invitation.success | $ | action:other-pinned | GATE_STATUS |
| organizer.issue_invitation.success | $ | action:unpinned | GATE_STATUS |
| organizer.issue_invitation.success | $headers | drop:x-request-id | STALE_RESPONSE |
| organizer.issue_invitation.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| organizer.issue_invitation.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| organizer.issue_invitation.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| organizer.issue_invitation.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| organizer.issue_invitation.success | $origin | origin:other-port | GATE_TRANSPORT |
| organizer.issue_invitation.success | $origin | origin:localhost | GATE_TRANSPORT |
| organizer.issue_invitation.success | $ | array:two-receipts | GATE_STATUS |
| consent.set_consent.success | $ | delete | GATE_STATUS |
| consent.set_consent.success | $ | swapType | GATE_STATUS |
| consent.set_consent.success | $ | addKey | GATE_STATUS |
| consent.set_consent.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $ | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.domain | delete | GATE_STATUS |
| consent.set_consent.success | $.domain | swapType | GATE_STATUS |
| consent.set_consent.success | $.domain | addKey | GATE_STATUS |
| consent.set_consent.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.operationId | delete | GATE_STATUS |
| consent.set_consent.success | $.operationId | swapType | GATE_STATUS |
| consent.set_consent.success | $.operationId | addKey | GATE_STATUS |
| consent.set_consent.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.sequence | delete | GATE_STATUS |
| consent.set_consent.success | $.sequence | swapType | GATE_STATUS |
| consent.set_consent.success | $.sequence | addKey | GATE_STATUS |
| consent.set_consent.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.action | delete | GATE_STATUS |
| consent.set_consent.success | $.action | swapType | GATE_STATUS |
| consent.set_consent.success | $.action | addKey | GATE_STATUS |
| consent.set_consent.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.action | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.result | delete | GATE_STATUS |
| consent.set_consent.success | $.result | swapType | GATE_STATUS |
| consent.set_consent.success | $.result | addKey | GATE_STATUS |
| consent.set_consent.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.result | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.result.allowed | delete | GATE_STATUS |
| consent.set_consent.success | $.result.allowed | swapType | GATE_STATUS |
| consent.set_consent.success | $.result.allowed | addKey | GATE_STATUS |
| consent.set_consent.success | $.result.allowed | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.result.allowed | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.result.allowed | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $.result.consentVersion | delete | GATE_STATUS |
| consent.set_consent.success | $.result.consentVersion | swapType | GATE_STATUS |
| consent.set_consent.success | $.result.consentVersion | addKey | GATE_STATUS |
| consent.set_consent.success | $.result.consentVersion | inject:economicFinalityClaimed | GATE_STATUS |
| consent.set_consent.success | $.result.consentVersion | inject:fundsExecuted | GATE_STATUS |
| consent.set_consent.success | $.result.consentVersion | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $ | operationId:changed | GATE_STATUS |
| consent.set_consent.success | $ | action:other-pinned | GATE_STATUS |
| consent.set_consent.success | $ | action:unpinned | GATE_STATUS |
| consent.set_consent.success | $headers | drop:x-request-id | STALE_RESPONSE |
| consent.set_consent.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| consent.set_consent.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| consent.set_consent.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| consent.set_consent.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| consent.set_consent.success | $origin | origin:other-port | GATE_TRANSPORT |
| consent.set_consent.success | $origin | origin:localhost | GATE_TRANSPORT |
| consent.set_consent.success | $ | array:two-receipts | GATE_STATUS |
| consent.authorize_marketing.success | $ | delete | GATE_STATUS |
| consent.authorize_marketing.success | $ | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $ | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $ | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $ | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $ | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.domain | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.domain | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.domain | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.domain | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.domain | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.domain | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.operationId | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.operationId | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.operationId | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.operationId | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.operationId | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.operationId | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.sequence | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.sequence | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.sequence | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.sequence | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.sequence | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.sequence | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.action | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.action | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.action | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.action | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.action | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.action | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.result | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.result | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.result | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.result | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.result | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.result | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.result.authorizedAt | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.result.authorizedAt | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.result.authorizedAt | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.result.authorizedAt | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.result.authorizedAt | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.result.authorizedAt | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.result.consentVersion | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.result.consentVersion | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.result.consentVersion | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.result.consentVersion | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.result.consentVersion | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.result.consentVersion | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.result.dispatchDecision | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.result.dispatchDecision | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.result.dispatchDecision | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.result.dispatchDecision | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.result.dispatchDecision | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.result.dispatchDecision | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $.result.networkSendPerformed | delete | GATE_STATUS |
| consent.authorize_marketing.success | $.result.networkSendPerformed | swapType | GATE_STATUS |
| consent.authorize_marketing.success | $.result.networkSendPerformed | addKey | GATE_STATUS |
| consent.authorize_marketing.success | $.result.networkSendPerformed | inject:economicFinalityClaimed | GATE_STATUS |
| consent.authorize_marketing.success | $.result.networkSendPerformed | inject:fundsExecuted | GATE_STATUS |
| consent.authorize_marketing.success | $.result.networkSendPerformed | inject:productionEndpoint | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $ | operationId:changed | GATE_STATUS |
| consent.authorize_marketing.success | $ | action:other-pinned | GATE_STATUS |
| consent.authorize_marketing.success | $ | action:unpinned | GATE_STATUS |
| consent.authorize_marketing.success | $headers | drop:x-request-id | STALE_RESPONSE |
| consent.authorize_marketing.success | $headers | drop:x-correlation-id | STALE_RESPONSE |
| consent.authorize_marketing.success | $headers | drop:x-kix-transport | GATE_TRANSPORT |
| consent.authorize_marketing.success | $headers | drop:x-kix-production-endpoint | GATE_TRANSPORT |
| consent.authorize_marketing.success | $headers | drop:x-kix-protocol-truth | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $headers | drop:x-kix-production-conformance | PRODUCTION_ENDPOINT |
| consent.authorize_marketing.success | $origin | origin:other-port | GATE_TRANSPORT |
| consent.authorize_marketing.success | $origin | origin:localhost | GATE_TRANSPORT |
| consent.authorize_marketing.success | $ | array:two-receipts | GATE_STATUS |
<!-- composer-loopback-sweep:end -->

## Compatibility and deviations

Reader predicates moved unchanged into `composer-receipts.ts`. Extracting the gift method passes its existing offer context explicitly (and still returns false for null); the separate structural HTTP check does not fabricate causal context. The organizer create predicate is retained as its original boolean predicate, rather than replacing it with the journey's object-returning reader. Consent authorization accepts a minimal structural input containing the same `expectedConsentVersion`; the predicate body is unchanged.

No assertions or expected codes in existing composer/invoker tests changed. Nine existing HTTP success result fixtures now include `salesStatus: "CLOSED"` so transport/payload tests reach their intended assertions under the newly enforced reader:

| Test file | Success fixtures updated |
| --- | --- |
| `http-transport-hardening.test.ts` | manual redirect option; global fetch receiver |
| `critical-flows.test.ts` | initial local-call envelope; simulated booking payload; mock settlement payload |
| `credit-fsm.test.ts` | mock credit payload |
| `reservation-fsm.test.ts` | mock reservation payload; stub admission payload |
| `resale-fsm.test.ts` | mock resale payload |

All negative payload/production guards stay intact. The original open composer predicates are preserved; HTTP rejects extra result keys, including otherwise safe mock payload extensions. The expectation updates for those HTTP tests are documented in fix round 2 below. No web scanner exclusion was needed. The earlier design's optional live execution was removed per review. The four former ACCEPT exceptions are removed in fix round 2; no acceptance amendment is claimed.

Scope provenance: [Wave 6 gate record](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343), and kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7 (read-only references; no producer source consumed or pin moved).

## Verification (initial implementation; superseded by fix-round evidence below)

Base implementation HEAD: `a96f14e8adefc44fd13e4cd99c75940b0965d1d6`. Local Node `v20.19.2` (repository engine supports >=20; CI uses Node 22), npm lockfile toolchain. Fresh baseline and final build use the same toolchain and settings. Baseline: initial JS gzip **160704**, total gzip **776245**. Final: initial JS gzip **160747**, delta **+43 bytes**; total gzip **778007**. `npm run budget` passes with every limit unchanged. The extra shared receipt module is a deferred chunk; initial JS stays within both the node delta and repository ceilings.

These are local equivalents, not a claim that GitHub Commerce apps CI ran. Actual exact-commit GitHub checks remain the supervisor's responsibility. No commit, push, PR, issue or comment was created. Live suites at `KIX_REQUIRE_GATE=0` are reported as skipped.

### Commands and results

Validation commands are run from the repository root. Output redirections only retain local logs under `/tmp/kix-composer-*`; jobs are foreground commands, with no background shell jobs.

| Command | Result |
| --- | --- |
| `npm ci` | PASS twice (baseline install and required verification sequence); 534 packages installed, existing audit warnings: 2 moderate, 1 high, 2 critical |
| `npm run build` | PASS baseline and implementation builds |
| `npm run budget` | PASS baseline and implementation; metrics above |
| `npm run typecheck -w @kix/protocol-adapter` | PASS after reader extraction and fixture addition |
| `KIX_REQUIRE_GATE=0 npx vitest run test/composer-loopback-conformance.test.ts --root packages/protocol-adapter` | Initial run: 44 passed, one table comparison failed while capturing the emitted table; table was populated from that output |
| `KIX_REQUIRE_GATE=0 npx vitest run --root packages/protocol-adapter test/composer-loopback-conformance.test.ts test/loopback-replay-conformance.test.ts test/gift-transfer.test.ts test/organizer-console.test.ts test/consent-bind.test.ts test/gift-invoker.test.ts test/organizer-invoker.test.ts test/consent-invoker.test.ts test/http-transport-hardening.test.ts` | Initial run: 140 passed, two transport success fixtures failed the newly enforced reader; after fixture updates: **142 passed / 9 files** |
| `npm run typecheck` | PASS three runs, including after the final fixture corrections |
| `KIX_REQUIRE_GATE=0 npm test` | First run: 1462 adapter tests passed, four fixture-related failures, 23 skipped; final **PASS: adapter 1466 passed / 23 skipped, web 1220 passed, cold-start 6 passed** |
| `KIX_REQUIRE_GATE=0 npx vitest run --root packages/protocol-adapter test/credit-fsm.test.ts test/critical-flows.test.ts test/reservation-fsm.test.ts test/resale-fsm.test.ts` | Progressive fixture corrections: 34 passed / 2 failed, then 35 passed / 1 failed; final **36 passed / 4 files** |
| `npm run lint` | PASS twice |
| `npm run cycle-check` | PASS: no circular dependencies |
| `npm run deps:check` | PASS: 4 manifests, 630 lockfile entries |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | Initial run: adapter floors passed; web failed on a worker module timeout and one 5000ms test timeout (85 files passed, two failed). No source/config/timeout changes made |
| `VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 KIX_REQUIRE_GATE=0 npm run coverage:check` | **PASS**: all tests and all coverage floors met with workers capped at two |
| `KIX_REQUIRE_GATE=0 npx vitest run --root packages/protocol-adapter test/composer-loopback-conformance.test.ts` | Final **45 passed**; final document table matches emitted output |
| `git diff --check` | PASS |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f` |
| `git diff --exit-code origin/main -- packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts packages/protocol-adapter/vendor .github .aiops docs/aiops apps/web/bundle-budget.json` | PASS: empty protected diff (also checked against HEAD) |

The worker cap is a local execution adjustment, not a CI or test timeout change. Coverage: adapter lines/statements **91.29%**, functions **97.45%**, branches **84.90%**; web lines/statements **92.93%**, functions **80.98%**, branches **89.26%**. Live suites remain skipped in both test and coverage runs.

Additional read-only AST comparison (`node --input-type=module` with TypeScript and `git show HEAD:<source>`) verified all **10 extracted reader bodies match the base revision**, normalizing whitespace and the explicit `this.gift` → `gift` context reference only. At initial implementation, an independent Python table check confirmed **660 unique rows with four expected ACCEPT rows**; fix round 2 supersedes those four expectations with errors and fences. The full commands used for these checks only read source, git blobs and this document.

### Changed files

- `packages/protocol-adapter/src/composer-receipts.ts` (new)
- `packages/protocol-adapter/src/gift-transfer.ts`
- `packages/protocol-adapter/src/organizer-console.ts`
- `packages/protocol-adapter/src/consent-bind.ts`
- `packages/protocol-adapter/src/http-adapter.ts`
- `packages/protocol-adapter/test/composer-loopback-conformance.test.ts` (new)
- `packages/protocol-adapter/test/support/composer-loopback-fixtures.ts` (new)
- `packages/protocol-adapter/test/support/fake-loopback-gate.ts`
- `packages/protocol-adapter/test/http-transport-hardening.test.ts`
- `packages/protocol-adapter/test/critical-flows.test.ts`
- `packages/protocol-adapter/test/credit-fsm.test.ts`
- `packages/protocol-adapter/test/reservation-fsm.test.ts`
- `packages/protocol-adapter/test/resale-fsm.test.ts`
- `docs/c-plan-d-invoker-loopback-conformance-stub-apps-bind.md` (new)

## PR fix round 1 — total bundle regression

The reported CI failure is valid. Its 785,942-byte total exceeded the preceding
node's stricter 785,000-byte entry-import-graph tripwire, even though the separate
790,000-byte repository budget passed. The branch was based on `a96f14e`; current
`origin/main` (`0990caf`) also contains the merged diagnostics UI. An isolated
copy of that merged main with this node's source overlaid reproduces the total
size pressure. No unmerged dependency was consumed.

The final fix groups the existing BookingJourney, GiftTransfer, OrganizerConsole
and ConsentBind implementations in `packages/protocol-adapter/src/composer-runtime.ts`.
Their original module paths re-export the same values and types. Keeping those
implementations in one deferred module lets gzip share their existing vocabulary
and avoids another shared runtime chunk. The shared result readers and the HTTP
boundary's lazy reader import are unchanged. No receipt predicate, command body,
state transition, fence, error classification, not-bound wording or test expectation
changes in this fix round.

A TypeScript token comparison against submitted HEAD `5be81ee` checks all **87**
moved declarations. Every token matches after prefixing only the private
`deskQuote`, `attemptIdentity` and `createEventBody` helper names to avoid collisions.
The receipt reader file is byte-identical to submitted HEAD. The sweep table above
is unchanged and remains compared verbatim by the suite.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
At fix round 1, the four open-result ACCEPT exceptions remained unchanged; fix round 2 removes them.
No command is newly composed or rebound. No CI, budget limit, pin, vendor,
commerce binding, `.aiops/` or `docs/aiops/` file is changed.

Final local verification uses Node **22.23.4** and a fresh `npm ci`. Isolated
baseline and integration builds use the same installed lockfile dependencies.
These runs are local evidence; they do not claim a newly posted GitHub check.
No commit, push, issue, PR or comment was created.

| Clean build, gzip level 9 | Initial JS | Total JS + CSS | Files |
| --- | ---: | ---: | ---: |
| Branch base `a96f14e` | 161447 | 778382 | 100 |
| Submitted node `5be81ee` | 161484 | 780213 | 101 |
| Fix-round branch | **161452** | **777624** | **100** |
| Current merged main `0990caf` | 161679 | 784542 | 103 |
| Current merged main + final node sources (isolated copy) | **161662** | **783528** | **103** |

The branch initial-JS delta is **+5 bytes** against its base (allowance: +200).
The combined tree's initial JS decreases by 17 bytes against current merged main.
The combined total leaves **1,472 bytes** below the stricter 785,000 tripwire;
all repository budget limits are unchanged. Local build logs are retained under
`/tmp/kix-invoker-*`.

| Fix-round check | Result |
| --- | --- |
| `npm ci` (Node 22.23.4) | PASS; no lockfile change |
| `npm run typecheck` | PASS on branch and isolated combined tree |
| `npm run build` | PASS on branch; isolated combined Vite stub build also PASS |
| `npm run budget` | PASS; branch and isolated combined metrics above |
| `KIX_REQUIRE_GATE=0 npm test` | Initial unrestricted run hit worker/RPC and two test timeouts under host contention; no product assertion failure, no timeout/config change |
| `VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 KIX_REQUIRE_GATE=0 npm test` | PASS: adapter **1466 passed / 23 skipped**; web **1220 passed**; cold-start **6 passed** |
| Isolated combined `KIX_REQUIRE_GATE=0 npm test -w @kix/web` | PASS: **1237 web tests / 89 files**, plus **6 cold-start tests** |
| Isolated combined `npx vitest run test/entry-import-graph.test.ts` | PASS: **2 tests**, including the exact previously failing total-size assertion |
| Composer sweep (included in full adapter suite) | PASS: **45 tests**, all 1980 mutation executions, 33 success receipts, 36 hostile JSON replays; emitted table unchanged, no pending fake timers |
| `npm run lint` | PASS |
| `npm run cycle-check` | PASS: no circular imports |
| `npm run deps:check` | PASS: 4 manifests / 630 lockfile entries |
| `VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1 KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all adapter and web coverage floors met; adapter lines 91.29%, functions 97.45%, branches 84.90%; web lines 92.93%, functions 80.98%, branches 89.26% |
| `git diff --check` | PASS |
| Read-only TypeScript token comparison against `5be81ee` | PASS: **87 declarations**, only private helper identifiers prefixed |
| Protected paths compared with `origin/main` | PASS: empty diff for bindings, three pin sources, vendor, `.github`, `.aiops`, `docs/aiops`, bundle budget |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f` |

Fix-round changes are limited to this evidence document, the four existing
composer modules as re-export facades, and the new `composer-runtime.ts`. No
expectations, test files or protocol inputs change in this round. Live gate suites
remain skipped, never passed.

## PR fix round 2 — reject every mutated result

The blocking finding is valid. The authoritative rulings supplied for this round
contain no October 26 exception to acceptance 2. The unsupported amendment claim
has been removed; the four `$.result × addKey` rows for `close_sales`,
`issue_invitation`, `complete_event` and `cancel_event` now expect `GATE_STATUS`.

`assertComposerResult` closes these four HTTP result shapes with `closedResult`
before calling the existing readers. All ten extracted composer reader bodies
remain byte-identical to submitted HEAD `6a34f1a`; the composers' state machines,
bodies and stub predicates are unchanged. The boundary uses existing app fixture
shapes, adds no producer contract, and remains in the dynamically imported module.
The sweep's expected-code type permits only the four specified ProtocolError codes,
and its execution asserts UNKNOWN and the next-write fence unconditionally for
every row. There is no success branch for a mutation.

The seed-7 table above is updated to match the emitted table verbatim: **660 unique
error rows across exactly 11 actions**. Seeds **0, 7, 0xffffffff** execute **1,980**
mutations, each with the expected code and trace IDs, exactly one fetch, and a
fenced next write with zero further fetches. The **33** unmodified success fixtures
still pass. The **36** hostile JSON replays (12 per composer) leave Object.prototype
unchanged. Fake timers have zero pending timers after every test.

Existing GiftTransfer, OrganizerConsole and ConsentBind tests and invoker tests
have no changes. The following existing HTTP expectations change because mock
payload extensions are now extra result keys on a closed `close_sales` receipt:

| Test file | Expectation update |
| --- | --- |
| `critical-flows.test.ts` | Simulated booking and mock settlement result extensions now reject with `GATE_STATUS`. |
| `credit-fsm.test.ts` | Mock credit result extension now rejects with `GATE_STATUS`. |
| `reservation-fsm.test.ts` | Mock reservation and stub admission result extensions now reject with `GATE_STATUS`. |
| `resale-fsm.test.ts` | Mock resale result extension now rejects with `GATE_STATUS`. |
| `http-transport-hardening.test.ts` | Exact `salesStatus` result still succeeds. Nested `fundsExecuted: false` is explicitly accepted by the payload guard but rejected as an extra HTTP result key. Production-claim precedence and unsafe payload assertions are retained. |

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
No command is newly composed or rebound. Live-gate suites remain skipped, never
passed. No commit, push, PR, issue, comment or marker is created. The supplied CI
log contains no failure; the checks below are local evidence, not a claim that
GitHub CI ran on these uncommitted changes.

Validation uses Node **22.20.0**, a fresh `npm ci`, and the unchanged lockfile.
Test and coverage runs use the existing local worker cap:
`VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 VITEST_MAX_FORKS=2 VITEST_MIN_FORKS=1`.
No worker, timeout, CI, or budget configuration is edited. Logs are retained under
`/tmp/kix-round2-*`.

| Round 2 check | Evidence |
| --- | --- |
| `npm ci` | PASS; lockfile unchanged. |
| `npm run typecheck` | PASS for adapter and web. |
| `npm run build` | PASS before and after the fix. |
| `npm run budget` | PASS with unchanged limits. Fresh submitted-HEAD baseline: initial JS **161452**, total **777624** gzip bytes; final: initial JS **161454** (**+2**), total **777827**. Initial JS is **+7** against the recorded original node-base **161447**, within the +200 allowance. |
| `KIX_REQUIRE_GATE=0 npx vitest run --root packages/protocol-adapter` with the 13 affected composer, invoker, replay, transport and FSM test files | PASS: **178 tests / 13 files**, including **45 conformance tests**, all mutation errors and fences, unmodified successes, hostile JSON, zero pending timers and verbatim table comparison. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS: adapter **1466 passed / 23 skipped**, web **1220 passed**, cold-start **6 passed**. |
| `npm run lint` | PASS. |
| `npm run cycle-check` | PASS; no circular imports. |
| `npm run deps:check` | PASS; 4 manifests / 630 lockfile entries. |
| Read-only TypeScript AST comparison against `HEAD` | PASS: all **10 composer reader bodies** are identical, without normalization. |
| Independent document table check | PASS: **660 unique rows**, exactly **11 actions**, every row expects one of the four required error codes; each reported addKey row expects `GATE_STATUS`. |
| Protected paths compared with `origin/main` | PASS: empty diff for bindings, three pin sources, vendor, `.github`, `.aiops`, `docs/aiops`, bundle budget. |
| `git hash-object packages/protocol-adapter/src/commerce-bindings.ts` | `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. |
| `git diff --check` | PASS. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | PASS: all floors met; adapter lines/statements **91.29%**, functions **97.45%**, branches **84.91%**; web lines/statements **92.93%**, functions **80.98%**, branches **89.26%**. Live-gate tests skipped. |
