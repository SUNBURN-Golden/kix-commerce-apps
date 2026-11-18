# Commerce journey change requests

The reviewed integration gate at `8ba7f6c36373ac0ec49246f51f7471c164ac3a28` defines writes and mock receipts for this journey. The following read-model names are copied from `final_expect.read_queries` in `reference/booking_resale_admission/fixtures/commerce_journey_conformance_v1.json`. The vectors describe projection data. The pinned gate exposes no corresponding read endpoint or command body. The adapter returns a typed `NOT_BOUND` with a reason before dispatch, in both modes. Reads never resolve an uncertain write in the app.

| Read name | Needed shape and reason | Proposed owner |
| --- | --- | --- |
| `list_shows` | Bounded current show list to choose a booking context. | KIX |
| `get_show` | One show and its reservation slot state by show identity. | KIX |
| `get_booking` | One reservation/order with separately sourced cancellation, payment-observation and issuance facts, including a source position. Needed to verify the current booking independently of the last receipt. | KIX |
| `list_bookings` | Bounded list of booking identities and states for re-entry. | KIX |
| `get_right` | Current holder, generation and version by issued right identity for resale or admission. | KIX |
| `get_presentation` | Current right presentation and source version validity after transfer or consumption. | KIX |
| `list_open_listings` | Bounded list of current listing identities and hold/expiry states. | KIX |
| `get_listing` | Current listing by listing identity, including separate payment observation, settlement binding and transfer facts. | KIX |
| `get_admission` | Authorization by admission identity with credential version and validity. | KIX |
| `get_credential` | Current credential by right identity, including distinct authorization and consumption facts. | KIX |
| `get_settlement` | Current settlement by settlement identity with separate cancellation, refund binding and mock acceptance evidence. | KIX |
| `get_credit_advance` | Credit-advance projection named by the fixture inventory. This journey performs no credit writes. | KIX |
| `get_credit_claim` | Credit-claim projection named by the fixture inventory. This journey performs no credit writes. | KIX |

The write fence also needs a producer decision for manual recovery after `UNKNOWN`. A reviewed lookup by operation or body idempotency key would need to correlate the attempted step and its exact subject with an authoritative result. The pin supplies no such lookup for reservation, payment observation, issuance, resale, admission, or refund. Reusing a write key to request recovery is outside this binding. Proposed owner is KIX.

The producer fixture demonstrates `reservation_cancel` before payment and independently binds a mock refund on `settle-refund`. There is no reviewed body that links that refund to the cancelled reservation or compensates a `PAYMENT_NOTED` cancellation. The gate returns `COMPENSATION_UNDEFINED` for that cancellation. If a future flow needs a linked post-payment cancellation and refund, KIX owns the contract proposal and 준태님 owns the compensation policy decision.
