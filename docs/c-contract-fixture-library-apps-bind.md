# Contract fixture library apps bind

This bind is Catalogue version `1` of the shared fixture library. Adapter tests and UI tests import `packages/protocol-adapter/src/contract-fixtures.ts`. A recorded pass names one case on the current pin tuple. It does not verify a different case or a different tuple. A failed live call is not replaced with a stub success. The generator copies result key names and does not compute finance or rights.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. SDK, manifest, and vector digests stay null. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. The branch base is `fb80cf9835a37fefaaae87eb1a8960e3b36eb398`. This delivery is the uncommitted diff on `agent/kixc-c-contract-fixture-library`. The supervisor commits.

## Tuple this catalogue is bound to

`assertCatalogueBound` compares these literals with the live pins. A mismatch is `DIFFERENT_TUPLE`. Neither test suite accepts a pass until the literals and the live pins are the same tuple.

| Field | Literal |
| --- | --- |
| Catalogue version | `1` |
| Contract-only OpenAPI sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Integration-gate OpenAPI sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| `protocolMergeSha` / CI `KIX_PROTOCOL_GATE_SHA` | `52a9b5cbf7777df55d2d2062cb8d99d862b423bb` |
| Domain | `kix:fixture:lifecycle:0.3` |
| `PINNED_ACTIONS` | the 40 names copied in `FIXTURE_PINNED_ACTIONS_LITERAL` |
| SDK digest | null. Not consumed |
| Manifest digest | null. Not consumed |
| Vector digest | null. Not consumed |

## Classes

| Class | Screen status | Confirmed |
| --- | --- | --- |
| `SUCCESS` | `confirmed` | Only for the case that owns the pass, on this tuple, with a stub-shape or integration-gate source |
| `REJECT` | `rejected` | No |
| `UNKNOWN` | `unknown` | No. A read does not confirm it |
| `NOT_BOUND` | `not-bound` | No. The desk method is not sent |
| `STALE` | `stale` | No. A stale response does not update the track |

`STALE_RESPONSE` is class `STALE`. The journey helper still reports a traced protocol error as `UNKNOWN`, because that call may have applied. The catalogue does not collapse those two labels, and neither one is a success. `STALE_CONSENT_VERSION` stays `REJECT`. The letters in the code do not choose the class.

`placeHold` stays `NOT_BOUND` with `consideredAction` `reserve_listing` and `mappedOntoPrepareTrade` false. `prepare_trade` is only an `invokeLocalCall` body. `confirmBooking` stays not-bound to `capture`. `settlementPreview` stays not-bound to `settle_capture`. Those actions are never a `SUCCESS` case. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Screen map

Every workspace surface is one row. A desk method is one `not-bound.<method>` case on the surface that already lists it. An empty row says `no fixture pass` and owns no case. A pass on one screen does not verify another screen.

| Screen | Route | Cases |
| --- | --- | --- |
| `box-office-catalog` | `/` | `not-bound.listPerformances` |
| `box-office-journey-view` | `/` | `box-office-journey-view.unknown` |
| `box-office-settlement` | `/` | one `NOT_BOUND` case for each settlement desk method. Shares are not computed |
| `booking-journey` | `/booking/:eventId` | the six outcome rows below, plus `not-bound.placeHold`, `not-bound.releaseHold`, `not-bound.confirmBooking` |
| `reservation-case` | `/booking/:eventId` | one `NOT_BOUND` case for each mock reservation method |
| `admission-credential` | `/admission` | `admission-credential.label-stale`, plus the admission desk methods |
| `resale-desk` | `/resale` | `resale-desk.version-stale`, plus the resale desk methods |
| `gift-transfer` | `/gift` | the three `offer_gift` rows below |
| `credit-desk` | `/credit` | one `NOT_BOUND` case for each credit method. No disbursement |
| `organizer-console` | `/organizer` | the two `create_event` rows below |
| `operator-transport` | `/` | `operator-transport.unavailable`, `operator-transport.stale` |
| `operator-unshown-desk` | `/` | `NOT_BOUND` for the methods with no page control, including `checkAdmission` and `settlementPreview` |
| `marketing-hub` | `/marketing` | no fixture pass |
| `marketing-m01` | `/marketing/m01` | no fixture pass |
| `marketing-m02` | `/marketing/m02` | no fixture pass. A presale note does not place a hold |
| `marketing-m03` | `/marketing/m03` | no fixture pass |
| `marketing-m04` | `/marketing/m04` | no fixture pass. Markers are not a payout |
| `marketing-m05` | `/marketing/m05` | the three consent rows below |
| `discovery-prototype` | `/discovery` | `discovery-prototype.price-stale` |
| `discovery-live-read` | `/discovery` | the four synthetic projection read rows below |
| `buyer-workspace` | `/buyer` | `buyer-workspace.unknown` |
| `organizer-workspace` | `/organizer/workspace` | no fixture pass. Sends are the organizer-console cases |
| `receipt-explorer` | `/receipts` | `receipt-explorer.unknown`, `receipt-explorer.stale` |
| `accessibility-baseline` | `(none)` | no fixture pass. Amounts are not generated. No added route |

## Outcome cases

| Id | Class | Identity | Code or result keys |
| --- | --- | --- | --- |
| `booking-journey.create_event.success` | `SUCCESS` | `op-fix-create` / `operator` / `create_event` | `eventId`, `policyHash`, `inventoryIds`, `reservationSeconds` |
| `booking-journey.prepare_trade.success` | `SUCCESS` | `op-fix-prepare` / `buyer-a` / `prepare_trade` | `tradeId`, `ticketId`, `externalOrderId`, `status`, `termsHash` |
| `booking-journey.accept_trade.success` | `SUCCESS` | `op-fix-accept` / `buyer-a` / `accept_trade` | `accepted` |
| `booking-journey.create_event.reject` | `REJECT` | `op-fix-create-reject` / `operator` / `create_event` | `EVENT_EXISTS` |
| `booking-journey.create_event.unknown` | `UNKNOWN` | `op-fix-create-unknown` / `operator` / `create_event` | `INTERNAL_ERROR` |
| `booking-journey.create_event.stale` | `STALE` | `op-fix-create-stale` / `operator` / `create_event` | `STALE_RESPONSE` |
| `gift-transfer.offer_gift.success` | `SUCCESS` | `op-fix-offer` / `desk-donor` / `offer_gift` | `giftId`, `termsHash` |
| `gift-transfer.offer_gift.reject` | `REJECT` | `op-fix-offer-reject` / `desk-donor` / `offer_gift` | `TICKET_NOT_FOUND` |
| `gift-transfer.offer_gift.unknown` | `UNKNOWN` | `op-fix-offer-unknown` / `desk-donor` / `offer_gift` | `GATE_UNAVAILABLE` |
| `organizer-console.create_event.success` | `SUCCESS` | `op-fix-org-create` / `operator` / `create_event` | same key names as the booking create case, different case id |
| `organizer-console.create_event.reject` | `REJECT` | `op-fix-org-reject` / `operator` / `create_event` | `EVENT_EXISTS` |
| `marketing-m05.set_consent.success` | `SUCCESS` | `op-fix-consent` / `subject-a` / `set_consent` | `allowed`, `consentVersion` |
| `marketing-m05.authorize_marketing.reject` | `REJECT` | `op-fix-authorize-reject` / `marketing-adapter` / `authorize_marketing` | `STALE_CONSENT_VERSION` |
| `marketing-m05.set_consent.unknown` | `UNKNOWN` | `op-fix-consent-unknown` / `subject-a` / `set_consent` | `REQUEST_TIMEOUT` |
| `box-office-journey-view.unknown` | `UNKNOWN` | none. This route does not send | none |
| `buyer-workspace.unknown` | `UNKNOWN` | none. This page does not post | none |
| `receipt-explorer.unknown` | `UNKNOWN` | `op-fix-receipt-unknown` / `operator` / `create_event` | none. The read does not confirm it |
| `receipt-explorer.stale` | `STALE` | `op-fix-receipt-stale` / `operator` / `create_event` | `STALE_RESPONSE` |
| `discovery-prototype.price-stale` | `STALE` | none. Synthetic label | none |
| `discovery-live-read.stream-stale` | `STALE` | none. Synthetic watermark | none |
| `discovery-live-read.stream-gap` | `REJECT` | none. Adapter-detected stream gap, not a gate rejection | `PROJECTION_GAP` |
| `discovery-live-read.tenant-mix` | `REJECT` | none. Adapter-detected foreign tenant row | `PROJECTION_TENANT` |
| `discovery-live-read.cursor-invalid` | `REJECT` | none. Adapter-refused stale or foreign cursor | `PROJECTION_CURSOR` |
| `admission-credential.label-stale` | `STALE` | none. Adapter label, not `admit` | `CREDENTIAL_STALE` |
| `resale-desk.version-stale` | `STALE` | none. Mock case, not economic finality | `STALE_VERSION` |
| `operator-transport.unavailable` | `UNKNOWN` | none | `GATE_UNAVAILABLE` |
| `operator-transport.stale` | `STALE` | none | `STALE_RESPONSE` |

## What the classifier refuses

| Observation | Result |
| --- | --- |
| Class token outside the five names, or an action that is not pinned | `NEW_ENUM` |
| Missing `operationId`, actor, action, method, code, or a recorded result key | `MISSING_FIELD` |
| Different `operationId`, actor, action, method, or code. `placeHold` observed as `prepare_trade` or as `reserve_listing` | `DIFFERENT_IDENTITY` |
| Tuple key other than the live key, including a previous catalogue pass | `DIFFERENT_TUPLE` |
| A pass whose case id is not the case under test | `DIFFERENT_CASE` |
| `substituteStub`, or a success class after `callSucceeded: false` | `STUB_SUBSTITUTE` |
| `compute: "finance"` or `compute: "rights"` | `GENERATOR_BOUNDARY` |

`generateFixture` with `compute: "copy"` returns the recorded key names and null amounts, rights, shares, and `financialEntries`. It does not fill those values. `classifyFailedLive` never returns `SUCCESS`. Asking it to promote a failure throws `STUB_SUBSTITUTE`.

The receipt explorer still rejects a candidate with a missing key or a status outside the track vocabulary (`MALFORMED`), a different actor (`DIFFERENT_ACTOR`), a different domain or context (`DIFFERENT_CONTEXT`), and a different session (`DIFFERENT_SESSION`). An unknown row stays unconfirmed.

## Hold

No route was added. Screen components do not import this catalogue and do not call `fetch`. Price and fee display stay `UNDETERMINED`. The generator does not supply them.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them.

## Tests

`packages/protocol-adapter/test/contract-fixture-library.test.ts` covers the tuple bind, the five classes, pass reuse, the refusals, the generator, the not-bound desk methods, and the stub receipt key names.

`apps/web/test/contract-fixture-library.test.tsx` imports that same file, checks it against the workspace registry and this mapping table, and runs the receipt explorer over the receipt-shaped rows. The file is not re-exported from the adapter barrel, and screen source does not import it, so the desk bundle does not ship the catalogue.

No product screen changed, so this bind has no new browser run. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
