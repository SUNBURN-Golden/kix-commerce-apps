# Workspace design apps bind

This bind is the information architecture for the buyer, organizer, and operator desks. It maps the current routes onto 발견 → 선택 → 예약 → 결제 상태 → 권리 → 입장 → 환불, and it records which protocol commands those screens send. It adds no route, no screen, no adapter method, and no binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The machine-readable table is `apps/web/src/workspace/registry.ts`. `apps/web/test/workspace-registry.test.ts` checks it against `COMMERCE_METHODS`, `COMMERCE_COMMAND_BINDINGS`, `PINNED_ACTIONS`, and the composed sets on `BookingJourney`, `OrganizerConsole`, `GiftTransfer`, and `ConsentBind`. The registry does not import the adapter and does not call `fetch`.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. Base HEAD for this design is `cd8d1885e43e19048599ab0ea523c90fa67e1909`.

## Ruling

M2 is selected. The booking journey composes nothing past `accept_trade`: `create_event`, then `prepare_trade`, then `accept_trade`, through the existing local-call invoker with the published bodies. `capture` and `settle_capture` are never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed on that journey. `JOURNEY_NOT_COMPOSED` is unchanged.

`open_admission` stays uncomposed on the journey and is posted only by `OrganizerConsole`. That split is already recorded in [docs/organizer-admin-console-apps-bind.md](docs/organizer-admin-console-apps-bind.md). This design does not merge those two posts into one admission badge.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only a `BookingJourney` body. `placeHold({ eventId, quantity })` is not mapped onto it. The registry quotes that locked reason and sets `mappedOntoPrepareTrade` to false.

`NEVER_SENT_ACTIONS` in the registry is `capture`, `commit_trade`, `admit`, and `refund_ticket`. `UNSENT_MONETARY_POSTING_METHOD` is `settlementPreview`. The locked `consideredAction` on that method is `settle_capture`, and the workspace test treats that action as never sent. The registry file does not spell `settle_capture`: `packages/protocol-adapter/test/no-bypass.test.ts` rejects that token anywhere under `apps/web/src`. `open_admission` is not in the never-sent list because the organizer console sends it. `refund_ticket` is pinned and no surface sends it. `JOURNEY_NOT_COMPOSED` has no row for it. [docs/wave-6a-journey-map-apps-bind.md](docs/wave-6a-journey-map-apps-bind.md) already says the journey does not map `refund_ticket`.

## Information architecture

Three roles over the routes that already exist. Planned routes are `NOT_IMPLEMENTED` and carry the successor task id. They are not navigation items.

| Role | What the person does here | Current routes | Planned, not built |
| --- | --- | --- | --- |
| Buyer | Find a show, reserve, read payment status, hold a right, enter, ask about a refund | `/`, `/booking/:eventId`, `/admission`, `/resale`, `/gift`, `/marketing`, `/marketing/m01`–`m05` | `/discovery` (`c-discovery-prototype`), `/buyer` (`c-buyer-workspace`) |
| Organizer | Open a show, close sales, open admission, invite, read the mock settlement case | `/organizer`, settlement case on `/` | `/organizer/workspace` (`c-organizer-workspace`) |
| Operator | Read the transport banner, see refusals, leave unshown desk methods unlabeled as working | Shell on every route | `/receipts` (`c-receipt-explorer`). Keyboard and amount presentation across all three roles waits on `c-accessibility-baseline` and adds no route |

`/credit` stays on the operator desk as a mock F04 case. It is not a buyer right and not a disbursement.

The box office route `/` holds three surfaces that do not share a badge: the stub catalog, the read-only journey view, and the mock settlement case. The journey view does not send `create_event`.

## Buyer stage map

Each stage has at most one outcome track. The four tracks are `reservation`, `payment`, `issuance`, and `admission`. Discovery and selection have none. A stage does not collect the four tracks into one completion badge.

| Stage | Id | Track | Current support |
| --- | --- | --- | --- |
| 발견 | `discovery` | none | Stub `listPerformances` on `/`. The catalogue has no list command. Search is `NOT_IMPLEMENTED` |
| 선택 | `selection` | none | Choosing a row opens `/booking/:eventId`. Selection is not a reservation |
| 예약 | `reservation` | `reservation` | `BookingJourney` posts `prepare_trade` inside the three-step chain. `placeHold` stays not-bound. The B01–B05 case is stub-only |
| 결제 상태 | `payment` | `payment` | `confirmBooking` does not send `capture`. The F01–F03 case is stub-only. Price and fee copy is `UNDETERMINED` |
| 권리 | `issuance` | `issuance` | `issueReservation` is stub-only. `issue_invitation` is the organizer post. Gift moves a caller-supplied `ticketId` and does not mint a right |
| 입장 | `admission` | `admission` | Credential labels from the adapter. `checkAdmission` is not a page control. `open_admission` is the organizer post, on its own receipt |
| 환불 | `refund` | `payment` | `refund_ticket` is pinned and no surface sends it. The status stays not-bound. `COMPENSATION_UNDEFINED` stays visible. Refund and cancel policy values are `UNDETERMINED` |

Refund uses the payment track so a refund does not become a fifth badge and does not mark payment confirmed. The refund stage and the payment stage still render as two rows.

## Organizer and operator

Organizer lifecycle, inventory, sales, and mock settlement stay four different facts.

| Concern | Where it lives | What is posted | What stays unsent |
| --- | --- | --- | --- |
| Show | `/organizer` `create_event` | Published body. Seats are caller input | `registerReservationShow` is not `create_event` |
| Inventory | `/organizer` `issue_invitation` | Caller `inventoryId` and version | This design does not compute capacity |
| Sales | `/organizer` `close_sales`, then `open_admission`, `complete_event`, `cancel_event` | Those four bodies, each its own receipt | The six commands are not one atomic trade |
| Settlement | `/` mock F01–F03 | Stub phase names only | `settlementPreview` does not send `settle_capture`. `commitSettlement` is not `commit_trade` |

Operator exception handling is the set of refusals and fences that already exist. It is not a new command.

| Exception | Surface | Display |
| --- | --- | --- |
| `rejectExternalSettlement`, `rejectExternalReservation`, `rejectExternalAdmission` | No page control. Registry id `operator-unshown-desk` | not-bound. An in-memory refusal is not a catalogue command |
| `rejectExternalResale` | `/resale` | In-memory refusal on the mock case. Not a marketplace post |
| Credential labels | `/admission` | `valid`, `invalid`, `stale`, `already-consumed`, `transferred`, `cancelled`, `unavailable-server`. The page prints the adapter label |
| Transport banner | Every route | Unavailable, degraded, and local states. A probe does not confirm payment, issuance, or admission |
| UNKNOWN / NOT_SENT / FENCED | Journey, gift, organizer, consent | The next write on that sender stays fenced. There is no retry and no `Idempotency-Key` |

## Per-state screen contract

`TRACK_STATES` is `loading`, `empty`, `error`, `in-flight`, `confirmed`, `rejected`, `unknown`, `not-sent`, `fenced`, `not-bound`, `stale`, `unavailable`. There is no `completed` state. `confirmed` means that track has a receipt for its own action.

Apply the contract once per track. A surface that lists no track still uses these words for its local status and still does not mint an outcome badge.

| State | Required copy | Writes | Provenance label |
| --- | --- | --- | --- |
| `loading` | This track is loading. | Disabled | No receipt on this track. |
| `empty` | This track has no receipt yet. | A supported action on this track only | No receipt on this track. |
| `error` | This track hit a local error. | Disabled until the person edits the input | No new receipt. |
| `in-flight` | This track has one request in flight. | Disabled | One attempt. No retry. |
| `confirmed` | This track has a confirmed receipt for its own action. | That action stays disabled | Receipt for this action only. Stub-shape receipts are not from the gate. |
| `rejected` | This track was rejected. | Disabled | A rejection stays on this track. |
| `unknown` | This track is unknown. | Disabled | Unknown stays on this track. It is a separate state from rejected. |
| `not-sent` | This track was not sent. | Disabled | Nothing was posted. |
| `fenced` | This track is fenced. | Disabled | A later write waits for a new page load. |
| `not-bound` | This track is not-bound. | Disabled | The desk method stays not-bound. |
| `stale` | This track is stale. | Disabled | A stale response does not update this track. |
| `unavailable` | This track is unavailable. | Disabled | The desk stays on the selected adapter. There is no stub fallback. |

Enabled means the control for a supported action on that track may be used. It does not enable the next track. Empty reservation does not enable a payment post. Confirmed payment does not enable admission and does not mark issuance confirmed.

Copy that already ships uses the sentence "Stub-shape receipts are not from the gate." Later screens keep that sentence. This node does not change those screens.

## Display rules

| Binding | Label | What the person must not be told |
| --- | --- | --- |
| `published-bound` | The sender and the action names | That a stub-shape receipt came from the gate. That the journey continued past `accept_trade` |
| `stub-only` | stub-only, plus the mock provenance (`MOCK_GATE_ONLY`, `MOCK_SETTLEMENT_ONLY`, `MOCK_CREDIT_F04_ONLY`) | That the mock phase is a catalogue command or a live fund movement |
| `not-bound` | not-bound, and the locked `COMMERCE_COMMAND_BINDINGS` reason | That the `consideredAction` was sent |
| `no-published-command` | no published command. M01–M04 stay 설계중. M05’s ORIGINAL_32 label stays 미착수 even though consent posts two commands | That a session marker is a published command |
| `planned` | `NOT_IMPLEMENTED` and the task id | That the route exists or that search, the buyer workspace, or the receipt explorer works |

Unknown, rejected, and confirmed stay three labels. A stale response does not replace the current track. A transport probe does not change a track. One badge per track. There is no combined completion badge.

`surfaceBindingLine` and `stageLine` print the binding and the track. They do not say a surface works.

## Feature, command, and task map

Desk methods are names only. Every one of them is `status: "not-bound"` in `COMMERCE_COMMAND_BINDINGS`. The test fails if a listed method is missing, duplicated, or bound. Reasons stay in that locked file. The rows below quote the ruling-critical reasons. The other reasons are not copied here.

| Feature | Desk method or sender | Action | Binding | Task | Proving test |
| --- | --- | --- | --- | --- | --- |
| Catalog list | `listPerformances` | none | stub-only | `readme-box-office` | `apps/web/test/marketing-routes.test.tsx` |
| Journey chain | `BookingJourney` | `create_event`, `prepare_trade`, `accept_trade` | published-bound | `w6a-journey-adapter` | `apps/web/test/journey-panel.test.tsx` › `shows an unconfirmed request apart from the last confirmed receipt` |
| Hold | `placeHold` | considered `reserve_listing`, not sent | not-bound | `w6a-journey-adapter` | `PLACE_HOLD_RECORD` in `apps/web/test/workspace-registry.test.ts` |
| Release hold | `releaseHold` | considered `release_inventory`, not sent | not-bound | `reservation-depth` | locked binding, same test file |
| Confirm booking | `confirmBooking` | considered `capture`, not sent | not-bound | `w6a-journey-adapter` | `apps/web/test/journey-desk.test.ts` |
| Mock reservation | B01–B05 methods on `reservation-case` | none | stub-only | `reservation-depth` | `apps/web/test/reservation-panel.test.tsx` |
| Mock settlement | F01–F03 methods on `box-office-settlement` | none | stub-only | `settlement-depth` | `apps/web/test/settlement-panel.test.tsx` |
| Settlement pointer | `settlementPreview` | considered `settle_capture`, not sent | not-bound | `settlement-depth` | `NEVER_SENT_ACTIONS` in the workspace registry test |
| Credential | admission desk methods | none. `admit` not sent | stub-only | `admission-harden` | `apps/web/test/admission-panel.test.tsx` |
| Admission check | `checkAdmission` | considered `admit`, not sent. No page control | not-bound | `admission-harden` | `apps/web/test/admission-panel.test.tsx` keeps `checkAdmission` off the page |
| Mock resale | resale desk methods | `accept_trade` not sent by this desk | stub-only | `resale-depth` | `apps/web/test/resale-panel.test.tsx` |
| Gift | `GiftTransfer` | `offer_gift`, `accept_gift`, `cancel_gift` | published-bound | `gift-surface` | `apps/web/test/gift-panel.test.tsx` |
| Mock credit | credit desk methods | none | stub-only | `credit-depth` | `apps/web/test/credit-panel.test.tsx` |
| Organizer lifecycle | `OrganizerConsole` | the six lifecycle actions | published-bound | `organizer-admin-console` | `apps/web/test/organizer-panel.test.tsx` |
| Consent | `ConsentBind` | `set_consent`, `authorize_marketing` | published-bound | `w7-m05-consent-bind` | `apps/web/test/consent-desk.test.ts` |
| M01–M04 | none | none | no-published-command | `w7-marketing-align` | `apps/web/test/marketing-contracts.test.ts` |
| Transport | none | none | stub-only observation | `http-integration-gate` | `apps/web/test/transport-status.test.tsx` |
| Refund | none | `refund_ticket` pinned, not sent | not-bound | none. Policy is `UNDETERMINED` | workspace registry test |
| Discovery, buyer workspace, organizer workspace, receipt explorer, accessibility | none | none | planned, `NOT_IMPLEMENTED` | the five `c-*` task ids | workspace registry test |

Quoted reasons, unchanged from the locked bindings:

| Method | consideredAction | Reason |
| --- | --- | --- |
| `placeHold` | `reserve_listing` | `placeHold({ eventId, quantity })` does not match `reserve_listing`, which requires `domain`, `expiresAt`, `listingHash`, `listingId`, and `tradeId`. |
| `confirmBooking` | `capture` | `confirmBooking(holdId)` does not match `capture`. `capture` carries `amount`, `currency`, and `paymentId`. The desk keeps simulated-no-funds bookings on the stub and does not send `capture`. |
| `settlementPreview` | `settle_capture` | `settlementPreview` stays a mock F01–F03 pointer. `settle_capture` is a monetary posting, so the desk does not send it. |
| `checkAdmission` | `admit` | `checkAdmission({ rightsRef, gateId })` does not match `admit`, which requires `admissionEpoch`, `domain`, `expectedVersion`, `holder`, and `ticketId`. |
| `commitSettlement` | none | `commitSettlement` marks a mock FSM phase on the stub. It is not `commit_trade`. `settle_capture` remains a monetary posting, so the desk must not send it. |

## UX decisions made here

These are ordinary presentation choices inside the approved specs. They are recorded so successor nodes do not ask again.

| Decision | Choice | Source |
| --- | --- | --- |
| Role grouping | Buyer, organizer, and operator, matching the node title | Node `c-workspace-design`. `docs/aiops/COMMERCE_PRODUCT_EVOLUTION_KO.md` §6 separates 예매·발행, box office·운영자, 리셀·선물, 입장, 취소·환불, and mock credit |
| Stage names | The seven words in the node scope, with the ids in the registry | Node scope line 발견→선택→예약→결제 상태→권리→입장→환불 |
| Track vocabulary | `reservation`, `payment`, `issuance`, `admission` | Acceptance item 1. Evolution §6 keeps paid-like and issue-unknown apart. Evolution §7 refuses to fold capture phases into one paid label. `docs/aiops/INTEGRATED_JOURNEY_COMPLETION_DESIGN_KO.md` §4 says unknown is not 완료 |
| One badge per track | A stage carries zero or one track. `confirmed` is that track’s own receipt | Acceptance item 1. The screen contract has no aggregate completion state |
| Not-bound vs stub vs planned | Five binding words, printed by `surfaceBindingLine` | README fail-closed rules. Evolution §6 says unsupported steps stay `NOT_BOUND`. Planned rows cite successor task ids and say `NOT_IMPLEMENTED` |
| Stub receipt label | "Stub-shape receipts are not from the gate." | Copy already on the journey, organizer, and gift panels |
| M05 label | Consent may post two commands. The ORIGINAL_32 label stays 미착수 | README marketing table. `docs/m05-consent-bind-apps-bind.md` |
| Refund row | Payment track, not-bound, `COMPENSATION_UNDEFINED`, no amount policy | Evolution §6 취소·환불. Journey map does not map `refund_ticket` |
| Journey end | Stop at `accept_trade`. Do not draw `capture` or `settle_capture` on the buyer map | M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce |
| Hold vs prepare | `placeHold` stays `reserve_listing` and is not drawn as `prepare_trade` | H1, same ruling. Locked `commerce-bindings.ts` |

## Reused coverage

This node adds `apps/web/test/workspace-registry.test.ts` only. The behavioral checks below already exist and are not copied.

| File | Test | What it already proves |
| --- | --- | --- |
| `apps/web/test/journey-panel.test.tsx` | `shows an unconfirmed request apart from the last confirmed receipt` | Last confirmed receipt and the unconfirmed request stay apart |
| `apps/web/test/journey-panel.test.tsx` | `shows confirmed receipts without a price and lists the steps that stay uncomposed` | Uncomposed actions stay listed |
| `apps/web/test/journey-desk.test.ts` | `does not send a step out of order` | The journey order stays the three commands |
| `apps/web/test/organizer-panel.test.tsx` | `shows a confirmed create and the not-composed list` | Organizer not-composed list includes `capture`, `settle_capture`, `commit_trade`, and `admit` |
| `apps/web/test/admission-panel.test.tsx` | `prints each adapter label without deciding entry` | A credential label is not entry |
| `apps/web/test/settlement-panel.test.tsx` | `keeps settlement UI copy free of production-payment wording and on the adapter` | Mock settlement copy |
| `apps/web/test/marketing-contracts.test.ts` | `M01–M04 name no pinned action` | M01–M04 stay unpublished |

No screen changed, so this node records no browser run. Keyboard behavior is unchanged. Live-gate suites stay on the CI `live-gate` job. A local run with `KIX_REQUIRE_GATE=0` skips them. That skip is not a pass.

## Hold

`UNDETERMINED` until a product owner sets them: refund and cancel policy values, hold-expiry copy, and price or fee display. `ReadObservationV1` is not a published read. This design does not invent a read command, a refund body, or a browser path around the gate.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them.
