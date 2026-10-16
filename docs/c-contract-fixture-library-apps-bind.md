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
| `inventory-venue-select` | `/inventory` | the five synthetic seat and GA selection rows below. No fixture pass |
| `platform-journey-trade` | `/platform` | the eight synthetic multi-channel trade rows below. No fixture pass |
| `merchant-operations` | `/merchant` | the eight synthetic merchant read and export rows below. No fixture pass |
| `credit-origination` | `/credit/origination` | the nine synthetic credit origination rows below. No fixture pass |
| `credit-servicing` | `/credit/servicing` | the eight synthetic credit servicing rows below. No fixture pass |
| `finance-operations` | `/finance` | the eleven synthetic finance reconciliation and export rows below. No fixture pass |
| `marketing-journey` | `/marketing/journey` | the twelve synthetic marketing benefit rows below. No fixture pass |
| `delegated-assistant` | `/assistant` | the thirteen synthetic delegated assistant rows below. No fixture pass |
| `tenant-permissions` | `/permissions` | the ten synthetic tenant permission rows below. No fixture pass |
| `notification-inbox` | `/notifications` | the twelve synthetic notification inbox rows below. No fixture pass |
| `provider-connected-journey` | `/provider` | the ten synthetic provider checkout rows below. No fixture pass |
| `journey-identity` | `/identity` | the six synthetic journey context rows below. No fixture pass |
| `session-recovery` | `/session` | the six synthetic session recovery rows below. No fixture pass |
| `cross-surface-journeys` | `/journeys` | the five synthetic cross-surface journey rows below. No fixture pass |
| `refund-return-desk` | `/booking/:eventId` | the six synthetic refund-and-return rows below. No fixture pass |
| `marketplace-performance-bench` | `/marketplace-performance` | the eleven synthetic marketplace scale bench rows below. No fixture pass |
| `installable-mobile-shell` | `/mobile` | the sixteen synthetic installable mobile shell rows below. No fixture pass |
| `platform-operational-qualification` | `/qualification` | the eight synthetic operational qualification rows below. No fixture pass |
| `platform-release` | `/release` | the six synthetic platform release rows below. No fixture pass |
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
| `inventory-venue-select.hold-stale` | `STALE` | none. Synthetic observed hold that expired or belongs to an earlier generation | none |
| `inventory-venue-select.generation-changed` | `REJECT` | none. Adapter-refused read under an earlier inventory generation, not a gate rejection | `INVENTORY_GENERATION` |
| `inventory-venue-select.mode-mismatch` | `REJECT` | none. Adapter-refused seat/GA mismatch, converts nothing | `INVENTORY_MODE` |
| `inventory-venue-select.queue-blocked` | `REJECT` | none. Synthetic queue waiting or lapsed, selection pages closed | `INVENTORY_QUEUE` |
| `inventory-venue-select.unsupported-mode` | `REJECT` | none. Accessible seating, policy undetermined | `INVENTORY_UNSUPPORTED` |
| `platform-journey-trade.version-stale` | `REJECT` | none. Synthetic source refused a transfer on a right version that moved, not a gate rejection | `PLATFORM_VERSION_STALE` |
| `platform-journey-trade.terms-changed` | `REJECT` | none. Synthetic source refused a transfer on terms a price change superseded, not a gate rejection | `PLATFORM_TERMS_CHANGED` |
| `platform-journey-trade.payment-unobserved` | `REJECT` | none. Synthetic source refused a transfer with no payment observation, not a gate rejection | `PLATFORM_PAYMENT_UNOBSERVED` |
| `platform-journey-trade.write-fenced` | `REJECT` | none. Client fence refused the write before the port, nothing sent | `PLATFORM_FENCED` |
| `platform-journey-trade.response-lost` | `UNKNOWN` | none. Synthetic write whose answer was lost, may have applied | none |
| `platform-journey-trade.late-result` | `UNKNOWN` | none. A late result is evidence only, the write stays unknown | none |
| `platform-journey-trade.stale-read` | `STALE` | none. The last read is behind, read again before the next write | none |
| `platform-journey-trade.stale-session` | `STALE` | none. Result quarantined after a session context change | none |
| `merchant-operations.stale-read` | `STALE` | none. Synthetic watermark older than the page floor | none |
| `merchant-operations.stale-aggregate` | `STALE` | none. Source figure built at an older generation, shown flagged and not recomputed | none |
| `merchant-operations.cut-mismatch` | `REJECT` | none. Source figure count differs, unknown cut, or rows on more than one cut, never merged | none. The assessment flags it |
| `merchant-operations.scope-denied` | `REJECT` | none. No synthetic grant for that merchant, or a withdrawn grant, not a gate rejection | `SCOPE_DENIED` |
| `merchant-operations.export-denied` | `REJECT` | none. Read granted, export refused, not rebuilt on the page | `EXPORT_DENIED` |
| `merchant-operations.claim-refused` | `REJECT` | none. A line that claims settled, funds, or lendable; the whole payload is refused | `CLAIM` |
| `merchant-operations.export-withheld` | `REJECT` | none. An export that is partial, stale, off-scope, or off-read is withheld with every reason | none. The verdict names every reason |
| `merchant-operations.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty ledger | none |
| `credit-origination.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an application with no claim basis | none |
| `credit-origination.stale-policy` | `STALE` | none. A lane built under an older policy revision stays flagged with both revisions and withholds permission | none |
| `credit-origination.consent-withdrawn` | `REJECT` | none. The credit-assessment consent is withdrawn at the synthetic source; the only path is renewing it, not a gate rejection | `CONSENT_WITHDRAWN` |
| `credit-origination.document-expired` | `REJECT` | none. A claim evidence document is expired by the source's own flag; the only path is providing a current one | `DOCUMENT_EXPIRED` |
| `credit-origination.limit-race` | `REJECT` | none. A rival request takes the shared limit before the drawdown request lands; the source keeps its own order | `LIMIT_TAKEN` |
| `credit-origination.scope-denied` | `REJECT` | none. No synthetic grant for that applicant, or a withdrawn grant, not a gate rejection | `SCOPE_DENIED` |
| `credit-origination.claim-refused` | `REJECT` | none. A payload that calls a submission an approval or a request a disbursement; the whole payload is refused | `CLAIM` |
| `credit-origination.write-lost` | `UNKNOWN` | none. The request answer never arrived or arrived untrusted; it may have applied and fences every later request | none |
| `credit-origination.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an application with no claim basis | none |
| `credit-servicing.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an obligation with no servicing rows | none |
| `credit-servicing.stale-schedule` | `STALE` | none. Schedule rows built under an older schedule revision stay flagged with both revisions, never shown as current | none |
| `credit-servicing.partial-repayment` | `UNKNOWN` | none. A partly allocated payment keeps its unallocated remainder as the source's own label and restores no commitment limit | none |
| `credit-servicing.post-charge-off-payment` | `UNKNOWN` | none. A payment observed after a charged-off closure stays a fact of its own; the closure extinguishes no debt | none |
| `credit-servicing.scope-denied` | `REJECT` | none. No synthetic grant for that obligation, or a withdrawn grant, not a gate rejection | `SCOPE_DENIED` |
| `credit-servicing.claim-refused` | `REJECT` | none. A payload that omits or asserts the eight lane non-claims; the whole payload is refused | `CLAIM` |
| `credit-servicing.write-lost` | `UNKNOWN` | none. The request answer never arrived or arrived untrusted; it may have applied and fences every later request | none |
| `credit-servicing.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an obligation with no servicing rows | none |
| `finance-operations.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an empty queue and not a queue with nothing to reconcile | none |
| `finance-operations.stale-totals` | `STALE` | none. A source total built at an older generation than its cut stays flagged and is not recomputed | none |
| `finance-operations.balance-mismatch` | `UNKNOWN` | none. A balance stated matched while the source's own difference text is not zero, or stated mismatched while it is zero; neither is trusted and a confirmation does not make it match | none |
| `finance-operations.source-cut-skew` | `UNKNOWN` | none. The two sides of a case sit on cuts of different sources at different positions; the case is flagged timing-uncertain, only a request to look again is offered, and no single export is consistent | none |
| `finance-operations.scope-denied` | `REJECT` | none. No synthetic grant for that book, not a gate rejection | `SCOPE_DENIED` |
| `finance-operations.export-denied` | `REJECT` | none. The actor reads the queue and holds no export capability, or the source grants the read and no export | `EXPORT_DENIED` |
| `finance-operations.self-approval` | `REJECT` | none. The actor that proposed a correction asks to approve it; a different actor approves, and an approval changes no economic state | `SELF_APPROVAL` |
| `finance-operations.claim-refused` | `REJECT` | none. A payload that omits or asserts the six non-claims, an export that does not declare itself synthetic with no real money, or an answer that says a recorded request changed economic state; refused before a row is shown | `CLAIM` |
| `finance-operations.export-withheld` | `REJECT` | none. An export that is partial, on an older or newer cut set, on an unknown cut, whose rows differ from the read, or taken while the sources were skewed; withheld with every reason | none |
| `finance-operations.write-lost` | `UNKNOWN` | none. The request answer never arrived or arrived untrusted; it may have been recorded and fences every later request | none |
| `finance-operations.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty queue | none |
| `marketing-journey.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an empty benefit list and not a list with nothing to apply | none |
| `marketing-journey.eligibility-stale` | `STALE` | none. The membership basis moved after the read the apply was built from; the source rejects the apply, the read is marked behind, and one read again is offered | `ELIGIBILITY_STALE` |
| `marketing-journey.consent-withdrawn` | `REJECT` | none. Consent was withdrawn at the source after the read; the earlier authorization is not reused and the only path offered is the consent page, where consent is set. A withdrawal here is a source event, not a command the journey posts | `CONSENT_WITHDRAWN` |
| `marketing-journey.authorization-stale` | `REJECT` | none. Consent was granted again but the authorization was issued at an older consent version; a new authorization is needed and the older one is never reused | `AUTHORIZATION_STALE` |
| `marketing-journey.duplicate-use` | `REJECT` | none. The same benefit is already applied to the same order by another channel or an earlier application; the usage count is the source's own | `DUPLICATE_USE` |
| `marketing-journey.usage-limit` | `REJECT` | none. The source reports the benefit at the usage it allows; the recorded and allowed figures are copied and never added or subtracted | `USAGE_LIMIT_REACHED` |
| `marketing-journey.budget-exhausted` | `REJECT` | none. The coupon budget, counted in redemptions with no amount, is exhausted; a reclaim does not restore it because that policy is not published and the source states UNDETERMINED | `BUDGET_EXHAUSTED` |
| `marketing-journey.scope-denied` | `REJECT` | none. No synthetic grant for that subject, not a gate rejection | `SCOPE_DENIED` |
| `marketing-journey.claim-refused` | `REJECT` | none. A payload that omits or asserts a non-claim: a notice or an application confirming a purchase, a reward paid, a discount applied, a message sent, a CRM product complete, or a withdrawn authorization reused; refused whole before a row is shown | `CLAIM` |
| `marketing-journey.apply-lost` | `UNKNOWN` | none. The apply answer never arrived or arrived untrusted; it may have been recorded and fences every later write on that benefit | none |
| `marketing-journey.reclaim-lost` | `UNKNOWN` | none. The reclaim answer never arrived; it may have been reclaimed and no usage count or budget is assumed restored | none |
| `marketing-journey.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty benefit list | none |
| `delegated-assistant.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an empty grant list and not a list with nothing to propose | none |
| `delegated-assistant.grant-revoked` | `REJECT` | none. The grant was revoked at the source after the read; the approve is denied, not rejected and not recorded. A revocation here is a source event, not a command the page posts | `GRANT_REVOKED` |
| `delegated-assistant.grant-stale` | `STALE` | none. The grant version moved after the read the command was built from; the write is rejected, the read is marked behind, and one read again is offered | `GRANT_STALE` |
| `delegated-assistant.grant-expired` | `REJECT` | none. The grant passed its deadline at the source; no path is offered, a reported deadline is not extended | `GRANT_EXPIRED` |
| `delegated-assistant.mode-capped` | `REJECT` | none. The grant was requested at command mode and adopted at propose; an unadopted execution delegation stays in query/propose mode and nothing raises it | `MODE_CAPPED` |
| `delegated-assistant.action-not-granted` | `REJECT` | none. The proposal names a command the grant does not list; the page offers a revised request, not a second guess | `ACTION_NOT_GRANTED` |
| `delegated-assistant.target-outside-scope` | `REJECT` | none. The proposal names a listing under an event the grant does not cover; the assistant does not search for a broader grant or infer one | `TARGET_OUTSIDE_SCOPE` |
| `delegated-assistant.budget-exhausted` | `REJECT` | none. The command budget, a count of commands with no amount, is used at the source; a cancel restores no budget because that policy is not published | `BUDGET_EXHAUSTED` |
| `delegated-assistant.duplicate-draft` | `REJECT` | none. The listing already has a staged draft, staged by this page or another channel; no second draft is added | `DUPLICATE_DRAFT` |
| `delegated-assistant.claim-refused` | `REJECT` | none. A payload that omits or asserts a non-claim: assistant text as authority, a proposal as approval, an approval as a result, funds moved, a right transferred, an execution delegation bound, or a grant inferred from text; refused whole before a row is shown | `CLAIM` |
| `delegated-assistant.draft-lost` | `UNKNOWN` | none. The draft order answer never arrived or arrived untrusted; it may have been recorded and fences every later write under that grant | none |
| `delegated-assistant.cancel-lost` | `UNKNOWN` | none. The cancel answer never arrived; it may have been applied and no budget restoration is assumed | none |
| `delegated-assistant.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty grant list | none |
| `tenant-permissions.stale-read` | `STALE` | none. Synthetic watermark older than the page floor; not an empty workspace and not a denied one | none |
| `tenant-permissions.tenant-mix` | `REJECT` | none. A read payload carries a row of another tenant; the whole payload is refused before a row is shown | `SCOPE_LEAK` |
| `tenant-permissions.role-stale` | `STALE` | none. The role assignment moved a generation at the source after the read; a write under the older generation is rejected and the two sessions are not mixed | `ROLE_STALE` |
| `tenant-permissions.direct-open-denied` | `REJECT` | none. A direct open outside the role's kinds, another tenant's resource, or another subject's order is denied with no substitute row; a hidden control was not what denied it | `RESOURCE_DENIED` |
| `tenant-permissions.self-approval` | `REJECT` | none. The actor that proposed a change asks to approve it, even under the same person's second role; a different actor approves, and an approval changes no resource | `SELF_APPROVAL` |
| `tenant-permissions.privilege-escalation` | `REJECT` | none. A role asks for a request its capability does not cover; the source rejects it on its own check, not because a control was hidden | `NO_CAPABILITY` |
| `tenant-permissions.export-denied` | `REJECT` | none. The role reads its workspace and holds no sensitive-export capability; the export stays absent | `EXPORT_DENIED` |
| `tenant-permissions.export-withheld` | `REJECT` | none. An export on another scope, taken before the read, partial, or whose rows differ — including a foreign row; withheld with every reason and shows no row | none |
| `tenant-permissions.write-lost` | `UNKNOWN` | none. The request answer never arrived or arrived untrusted; it may have been recorded and fences every later request | none |
| `tenant-permissions.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty workspace | none |
| `notification-inbox.stale-read` | `STALE` | none. A synthetic watermark older than the page floor; no row is returned, and the inbox is not treated as empty or denied | none |
| `notification-inbox.tenant-mix` | `REJECT` | none. A read payload carries a notification of another tenant; the whole payload is refused before a row is shown | `SCOPE_LEAK` |
| `notification-inbox.subject-mix` | `REJECT` | none. A read payload carries a notification addressed to another subject; the whole payload is refused before a row is shown | `SUBJECT_LEAK` |
| `notification-inbox.duplicate-dropped` | `REJECT` | none. A second delivery of the same dedupe key is dropped and counted; the inbox lists one row and the duplicate confirms nothing more | none |
| `notification-inbox.late-stale-issue` | `STALE` | none. A notification issued under an older grant generation keeps its row marked stale-issue; its offered action resolves nothing and the source rejects the resolve | `STALE_ISSUE` |
| `notification-inbox.generation-stale` | `STALE` | none. The notification grant moved a generation after the read; a request under the older generation is rejected and a read under the older floor comes back generation-stale | `GENERATION_STALE` |
| `notification-inbox.permission-revoked` | `REJECT` | none. A revoked notification grant denies the read, the inquiry, the mark-read, and the resolve; no hidden control was what denied it | `GRANT_REVOKED` |
| `notification-inbox.uncontracted-kind` | `REJECT` | none. A feed delivers an event kind the producer contract does not name; the whole payload is refused | `UNCONTRACTED` |
| `notification-inbox.sensitive-leak` | `REJECT` | none. A payload delivers a sensitive notification's detail to a role without read-sensitive, or support material carrying a sensitive token; refused whole | `SENSITIVE_LEAK` |
| `notification-inbox.arrival-claim` | `REJECT` | none. A payload claims an arrival confirms an economic effect or that an external send is wired; refused whole | `CLAIM` |
| `notification-inbox.write-lost` | `UNKNOWN` | none. The request answer never arrived or arrived untrusted; it may have been recorded and fences every later request | none |
| `notification-inbox.read-lost` | `UNKNOWN` | none. The read answer never arrived; not an empty inbox | none |
| `provider-connected-journey.provider-error` | `REJECT` | none. The synthetic provider refused the begin; nothing was opened and the page does not send it again, not a gate rejection | `PROVIDER_ERROR` |
| `provider-connected-journey.account-unqualified` | `REJECT` | none. The actor is not sandbox-qualified; without a test account and provider qualification every write is synthetic and fenced | `ACCOUNT_UNQUALIFIED` |
| `provider-connected-journey.return-not-observed` | `REJECT` | none. The buyer landed on the return URL and no provider report is recorded; a return landing alone is not a payment observation | `PAYMENT_PENDING` |
| `provider-connected-journey.abandoned` | `REJECT` | none. The buyer never returned and the provider closed the checkout; an abandoned checkout pays, issues, and refunds nothing | `CHECKOUT_ABANDONED` |
| `provider-connected-journey.environment-refused` | `REJECT` | none. A declared production environment refuses the read, and a write that does not declare sandbox is refused; the desk serves the sandbox only | `ENVIRONMENT` |
| `provider-connected-journey.claim-refused` | `REJECT` | none. A payload that omits or asserts a non-claim — a real payment, funds moved, an admission grant, an executed refund, a completed provider integration, or a production environment; refused whole, and a confirmed answer that breaks them leaves the write unknown | `CLAIM` |
| `provider-connected-journey.write-lost` | `UNKNOWN` | none. A synthetic begin, observe, issue, or refund whose answer never arrived; it may have applied and fences every later write on that order | none |
| `provider-connected-journey.late-callback` | `UNKNOWN` | none. A late result or a late provider callback recorded against an unknown write; evidence only, the write stays unknown | none |
| `provider-connected-journey.stale-read` | `STALE` | none. The last read is behind; read again before the next write | none |
| `provider-connected-journey.stale-session` | `STALE` | none. Result quarantined after a session context change | none |
| `marketplace-performance-bench.stale-read` | `STALE` | none. A synthetic watermark older than the page floor; no row is returned, and the window is not empty or denied | none |
| `marketplace-performance-bench.terms-moved` | `STALE` | none. The listing terms moved under the held window; the read is refused and every row clears — a fast page never confirms stale terms or rights | none |
| `marketplace-performance-bench.late-answer` | `STALE` | none. An answer older than the newest read, or one landing after an actor, device, or incarnation change, is dropped and counted, never applied | none |
| `marketplace-performance-bench.queue-blocked` | `REJECT` | none. The contended page is behind the queue; admission is browse access only, never a hold, a payment, a right, or entry | none |
| `marketplace-performance-bench.queue-expired` | `REJECT` | none. The queue admission expired at the source; it grants nothing and the page does not revive it | none |
| `marketplace-performance-bench.over-bound` | `REJECT` | none. A page size or filter text over the declared bound is refused, never clamped | `PAGE_SIZE` |
| `marketplace-performance-bench.permission-revoked` | `REJECT` | none. The browse permission was revoked at the source; the read and the queue are denied | `PERMISSION_REVOKED` |
| `marketplace-performance-bench.claim-refused` | `REJECT` | none. A payload claims a row confirms a price or a right; refused whole before a row is shown | `PRICE_CLAIM` |
| `marketplace-performance-bench.device-claim` | `REJECT` | none. A payload claims real-device evidence; refused — an emulated device is never real mobile evidence | `DEVICE_CLAIM` |
| `marketplace-performance-bench.gap` | `REJECT` | none. The stream broke its own sequence; no row from a gapped window is shown | `SEQUENCE` |
| `marketplace-performance-bench.read-lost` | `UNKNOWN` | none. The read or queue answer never arrived; it stays in flight and unknown, not an empty market | none |
| `installable-mobile-shell.offline-cached` | `STALE` | none. A read while the link is down answers offline; stored items stay cached copies, never current authority | none |
| `installable-mobile-shell.offline-write-unknown` | `UNKNOWN` | none. A write while the link is down answers unknown and applies nothing; not retried, scope stays fenced | none |
| `installable-mobile-shell.offline-presentation` | `REJECT` | none. A stored pass shown offline is a copy; it mints no admission and the present write stays fenced link-offline | `LINK_OFFLINE` |
| `installable-mobile-shell.expired-pass` | `REJECT` | none. The source verdict on a stored pass is expired; a stored copy cannot revive an old right | `PASS_NOT_PRESENTABLE` |
| `installable-mobile-shell.session-expired` | `REJECT` | none. The session verdict at the source is expired; writes stay fenced until reconnect opens a new session | `SESSION_EXPIRED` |
| `installable-mobile-shell.relogin-mismatch` | `REJECT` | none. A session or stored copy belongs to another actor or device; re-login does not reuse it | `IDENTITY_MISMATCH` |
| `installable-mobile-shell.resume-replay` | `STALE` | none. An app resume re-executes nothing; writes stay fenced until an explicit read lands | none |
| `installable-mobile-shell.write-lost` | `UNKNOWN` | none. A confirm or withdraw whose answer never arrived; it may have applied and the order stays fenced | none |
| `installable-mobile-shell.late-answer` | `UNKNOWN` | none. A late result recorded against an unknown write; evidence only, the write stays unknown | none |
| `installable-mobile-shell.stale-session` | `STALE` | none. A result arrived after the session context changed; quarantined, it touches nothing | none |
| `installable-mobile-shell.stale-read` | `STALE` | none. A synthetic watermark older than the page floor; stored items stay cached copies | none |
| `installable-mobile-shell.clock-skew` | `UNKNOWN` | none. A skewed or unreported device clock marks stored verdicts clock-uncertain; it decides nothing | none |
| `installable-mobile-shell.already-installed` | `REJECT` | none. An install write against a device that already carries a shell; installing again is not an update | `ALREADY_INSTALLED` |
| `installable-mobile-shell.order-settled` | `REJECT` | none. A confirm or withdraw against an order no longer pending; a settled order takes no second write | `ORDER_NOT_PENDING` |
| `installable-mobile-shell.claim-refused` | `REJECT` | none. A payload that omits or asserts a non-claim — a real payment, funds moved, an admission grant, a right, a verified install, a production environment, or a completed mobile integration; refused whole, and a tainted answer leaves the write unknown | `CLAIM` |
| `installable-mobile-shell.read-lost` | `UNKNOWN` | none. The read answer never arrived; the shell is unavailable, not empty | none |
| `admission-credential.label-stale` | `STALE` | none. Adapter label, not `admit` | `CREDENTIAL_STALE` |
| `resale-desk.version-stale` | `STALE` | none. Mock case, not economic finality | `STALE_VERSION` |
| `operator-transport.unavailable` | `UNKNOWN` | none | `GATE_UNAVAILABLE` |
| `operator-transport.stale` | `STALE` | none | `STALE_RESPONSE` |
| `platform-operational-qualification.per-call-not-e2e` | `REJECT` | none. A synthetic booking confirmed and the transfer was rejected after a rival moved the right; the confirmed receipt does not close the journey | `VERSION_STALE` |
| `platform-operational-qualification.untrusted-packet` | `REJECT` | none. A packet that claims a public deployment, a real-money approval, a real payment, a completed real-user review, a service qualification, a production environment, a completed real integration, or a qualification promotion; refused whole | `CLAIM` |
| `platform-operational-qualification.run-lost` | `UNKNOWN` | none. The run answer never arrived; it may have recorded a packet, is never retried, and fences later runs | none |
| `platform-operational-qualification.context-switch` | `UNKNOWN` | none. A result arrived after the actor or session context changed; quarantined, it leaks nothing | `CONTEXT_SWITCHED` |
| `platform-operational-qualification.stale-read` | `STALE` | none. An exercised leg read a synthetic watermark older than the floor; not an empty board, no write goes out on it | none |
| `platform-operational-qualification.tuple-changed` | `STALE` | none. A pin tuple field moved under the run; nothing is applied and the packet stays unbuilt | `TUPLE_CHANGED` |
| `platform-operational-qualification.permission-revoked` | `REJECT` | none. An exercised leg lost its synthetic browse permission between reads; a denial, not an empty market, and a restore is a fresh read | `PERMISSION_REVOKED` |
| `platform-operational-qualification.denominator-unresolved` | `UNKNOWN` | none. The source, device, provider, rights, and finance areas keep their own denominators of unresolved items; a synthetic run resolves none | none |
| `platform-release.decision-pending` | `UNKNOWN` | none. Install, publish, and operate are presented to the user and none is taken; the user RELEASE decision stays pending | none |
| `platform-release.untrusted-packet` | `REJECT` | none. A packet that claims a release, a public deployment, a real-money approval, a real user acceptance, real operations, a production environment, a completed real integration, or a release promotion; refused whole | `CLAIM` |
| `platform-release.approval-reused` | `REJECT` | none. A packet recorded under a different source or contract tuple is refused whole; an approval under another tuple is never reused | `TUPLE` |
| `platform-release.run-lost` | `UNKNOWN` | none. The run answer never arrived; it may have recorded a packet, is never retried, and fences later runs | none |
| `platform-release.context-switch` | `UNKNOWN` | none. A result arrived after the actor or session context changed; quarantined, it leaks nothing | `CONTEXT_SWITCHED` |
| `platform-release.tuple-changed` | `STALE` | none. A pin tuple field moved under the run; nothing is applied and the candidate stays unbuilt | `TUPLE_CHANGED` |

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

This library adds no route; the `merchant-operations` screen it now lists is delivered by `docs/c-merchant-operations-stub-apps-bind.md`, and the `credit-origination` screen is delivered by `docs/c-credit-origination-stub-apps-bind.md`. Screen components do not import this catalogue and do not call `fetch`. Price and fee display stay `UNDETERMINED`. The generator does not supply them.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them.

## Tests

`packages/protocol-adapter/test/contract-fixture-library.test.ts` covers the tuple bind, the five classes, pass reuse, the refusals, the generator, the not-bound desk methods, and the stub receipt key names.

`apps/web/test/contract-fixture-library.test.tsx` imports that same file, checks it against the workspace registry and this mapping table, and runs the receipt explorer over the receipt-shaped rows. The file is not re-exported from the adapter barrel, and screen source does not import it, so the desk bundle does not ship the catalogue.

No product screen changed, so this bind has no new browser run. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
| `refund-return-desk.cancel-after-payment` | `REJECT` | none. A paid order takes no cancel record; a cancel is not the refund path | `CANCEL_AFTER_PAYMENT` |
| `refund-return-desk.refund-unavailable` | `REJECT` | none. An order with no payment observation records no refund; `refund_ticket` is never sent | `REFUND_UNAVAILABLE` |
| `refund-return-desk.return-not-required` | `REJECT` | none. A return observation on an order with no required return is refused | `RETURN_NOT_REQUIRED` |
| `refund-return-desk.claim-refused` | `REJECT` | none. A payload that omits or asserts a non-claim is refused whole | `CLAIM` |
| `refund-return-desk.write-lost` | `UNKNOWN` | none. A synthetic write whose answer never arrived; the order stays fenced | none |
| `refund-return-desk.stale-read` | `STALE` | none. The last read is behind; read again before the next write | none |
| `journey-identity.foreign-context` | `REJECT` | none. A row minted under another mode, domain, tuple, actor, role, or session is refused as evidence | `EVIDENCE_FOREIGN` |
| `journey-identity.generation-stale` | `REJECT` | none. An attach built under an older source cut | `GENERATION_STALE` |
| `journey-identity.claim-refused` | `REJECT` | none. A payload that claims a proof of payment, issuance, or admission; refused whole | `CLAIM` |
| `journey-identity.attach-lost` | `UNKNOWN` | none. A synthetic attach whose answer never arrived; the subject stays fenced and a stub reset keeps it | none |
| `journey-identity.stale-read` | `STALE` | none. A stale watermark or a rotated source cut | none |
| `journey-identity.stale-observation` | `STALE` | none. An item minted under an older cut or behind the floor | none |
| `session-recovery.recovered-unknown` | `UNKNOWN` | none. A write in flight or with a lost answer when the page went away; not sent again after a reload | none |
| `session-recovery.evidence-lost` | `UNKNOWN` | none. A corrupt, unsupported, or cleared journal is quarantined as SESSION_EVIDENCE_LOST; every write is held | none |
| `session-recovery.settle-write-failed` | `UNKNOWN` | none. The write was sent and the answer could not be recorded; the scope stays locked | none |
| `session-recovery.journal-full` | `REJECT` | none. The record or byte budget is reached; refused before send, nothing evicted | `JOURNAL_FULL` |
| `session-recovery.write-refused` | `REJECT` | none. The write-ahead record was refused or cut short; refused before send | `WRITE_REFUSED` |
| `session-recovery.history-not-current` | `STALE` | none. A confirmed record from an earlier page load is history and lifts no fence | none |
| `cross-surface-journeys.explicit-reject` | `REJECT` | none. A source answered a write with an explicit rejection; no opposite command is sent | `SOURCE_REJECTED` |
| `cross-surface-journeys.response-lost` | `UNKNOWN` | none. A write whose answer never arrived; shown as unconfirmed, later writes stay fenced | none |
| `cross-surface-journeys.partial-landed` | `UNKNOWN` | none. A leg landed and a later one did not; COMPENSATION_UNDEFINED stays visible | none |
| `cross-surface-journeys.claim-refused` | `REJECT` | none. A table that claims a completed journey, an executed compensation, or a resolved UNKNOWN; refused whole | `CLAIM` |
| `cross-surface-journeys.table-unavailable` | `UNKNOWN` | none. A table read whose answer never arrived; unavailable, never an empty table | none |
