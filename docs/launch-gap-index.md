# Launch-gap index

## Scope and authority

Snapshot of this checkout at `dabd7086de556be0489ab71314a503658b126eda`: all 32 unique README-table routes, all 38 canonical registry routes, the discovery alias and development gallery. A route can contain multiple surfaces with different bindings. The inventory records what exists and what is missing; it authorizes no integration, qualification, acceptance, production deployment or release. Producer statuses below are recorded by this checkout, not freshly verified upstream.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

BookingJourney composes only `create_event` → `prepare_trade` → `accept_trade` through `invokeLocalCall` with published bodies. `capture` and `settle_capture` are never composed or sent; `commit_trade`, `open_admission` and `admit` stay uncomposed in that journey with recorded reasons. OrganizerConsole independently supports six published commands, including `open_admission`. `placeHold` stays not-bound with `consideredAction: reserve_listing`; `prepare_trade` is only a local-call body and never a mapping from placeHold. Confirmation sends no `capture`, settlement sends no `settle_capture`. The [locked bindings](../packages/protocol-adapter/src/commerce-bindings.ts) remain authoritative for exact desk refusal reasons.

[README](../README.md), [route registry](../apps/web/src/shell/route-registry.ts), [workspace surfaces](../apps/web/src/workspace/registry.ts), and [handoff producers/pins](../apps/web/src/handoff/packet.ts) are the local inventory sources. [Catalogue-v2 correction](audit-6-decision-apps-bind.md) records the consumed p-sdk-0 SDK, manifest and vector digests in the live tuple, release and HANDOFF_PINS. BOOTSTRAP proves **catalogue-schema binding only**, never semantic conformance or live integration; historical v1 null-digest descriptions are not current evidence.

Only the executable program is a dispatch source. Pending catalogues and draft plans are context, never authorization to implement the real consumers named here. ORIGINAL_32 labels are unchanged: 설계중 and 미착수 stay as recorded; protocol truth belongs to kix-protocol.

## Boundary vocabulary

| Word | Meaning here |
| --- | --- |
| `stub-only` / mock FSM | In-memory or page-load demo data and test transitions; no real economic state. |
| synthetic | In-process source/fixture observation or request record; not a producer receipt. |
| `published-bound` | Existing invoker accepts published command bodies for a local call; stub is default. No production integration claim. |
| `not-bound` / `NOT_BOUND` | No compatible published body/read/producer tuple; no request is sent and there is no stub fallback. |
| `no-published-command` | Local controls exist but there is no protocol command for that surface. |
| `UNKNOWN` | Write outcome is unresolved; a read, reload, notification or fast response never confirms it or permits retry. |
| `STALE` | Evidence does not meet currentness/context requirements; not interchangeable with UNKNOWN or NOT_BOUND. |
| `COMPENSATION_UNDEFINED` | No adopted compensation command/path; the UI does not invent one or close the journey. |
| `UNDETERMINED` | No authoritative product value, provider selection or assigned owner is recorded; not a default policy. |

All entries inherit fail-closed transport rules: stub default, explicit `http://127.0.0.1:<port>` only, one attempt, no retry, Idempotency-Key, redirect following, stub fallback or proxy around the gate. No UI-component fetch; production/truth flags stay false. Current gate browser CORS is unsupported: local-call capability does not prove browser-to-gate access. No real money/payment, KYC, disbursement, venue scanning, bank rail, chain/mainnet or live marketplace is authorized. No SLOs or copied Move/kernel/settlement math.

## Route index

Each entry separates current surface binding, local HTTP behavior, missing capability and authority. Consumer IDs without a repository prefix are commerce-apps consumers; producer IDs use `kix-protocol:`. Missing contracts stay gaps rather than proposed endpoints.

## `/`

| Field | Recorded boundary |
| --- | --- |
| Surface | `box-office-catalog`, `box-office-journey-view`, `box-office-settlement`, `operator-transport`, `operator-unshown-desk`; shared `refund-return-desk` strip |
| Current boundary | `stub-only` catalogue and F01–F03 settlement FSM; page-load journey observations; synthetic refund/return cells. `operator-unshown-desk` is `not-bound` and has no page control. |
| Integration HTTP | All desk methods remain not-bound. There is no catalogue list/read command; settlementPreview is a mock pointer and sends no `settle_capture`. Shell health/ready probes are process observations, never readiness approval. |
| External dependency | `kix-protocol:read-model-reference`, `kix-protocol:p-sdk-1`, `kix-protocol:contract-compatibility-profile` → `bind-list-read`; `kix-protocol:openapi-catalogue-promotion` and `kix-protocol:contract-compatibility-profile` → `bind-settlement-fsm`; `refund-surface`, `api-state-distinction`, `c-journey-identity` and `c-async-session-fence` consumers remain unpromoted; authoritative refund/return evidence and policy are absent. Browser access also needs `kix-protocol:gate-browser-access` → `browser-gate-path` (current gate lacks browser CORS). |
| Owning decision | M2 + H1 is RECORDED. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Prices, fees and refund policy remain `UNDETERMINED`. |
| Evidence | [settlement-depth-apps-bind.md](settlement-depth-apps-bind.md); [c-refund-return-states-stub-apps-bind.md](c-refund-return-states-stub-apps-bind.md); [http-integration-gate-apps-bind.md](http-integration-gate-apps-bind.md); [c-local-evidence-matrix-stub-apps-bind.md](c-local-evidence-matrix-stub-apps-bind.md) |

## `/buyer`

| Field | Recorded boundary |
| --- | --- |
| Surface | `buyer-workspace`; shared `refund-return-desk` observation strip |
| Current boundary | `stub-only`: page-load selection, reservation, order and issuance receipts; reservation, payment, issuance, admission, return-required and refund-done stay separate. No write; catalogue read stays stub. |
| Integration HTTP | No held-ticket or order read command; no producer receipt query. Reading cannot confirm an UNKNOWN write. |
| External dependency | `kix-protocol:read-model-reference`, `kix-protocol:p-sdk-1`, `kix-protocol:contract-compatibility-profile` → `bind-list-read`; real identity/read evidence and `refund-surface`, `api-state-distinction`, `c-journey-identity` and `c-async-session-fence` consumers remain unpromoted; authoritative refund/return evidence and policy are absent. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Refund, price and fee values remain `UNDETERMINED`. |
| Evidence | [c-buyer-workspace-apps-bind.md](c-buyer-workspace-apps-bind.md); [c-refund-return-states-stub-apps-bind.md](c-refund-return-states-stub-apps-bind.md) |

## `/discovery`

| Field | Recorded boundary |
| --- | --- |
| Surface | `discovery-prototype`, `discovery-live-read` |
| Current boundary | `stub-only`: fixture search/filter/sort/page and synthetic bounded projection stream. A purchase link requires an on-sale event in the one stub `listPerformances` read. |
| Integration HTTP | No list/search/projection read command; the synthetic read port stays not-bound, without fallback. |
| External dependency | `kix-protocol:ps-05-query-projections`; `kix-protocol:read-model-reference`, `kix-protocol:p-sdk-1`, `kix-protocol:contract-compatibility-profile` → `bind-list-read`, plus `c-journey-identity` and `c-discovery-live` consumers. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-discovery-prototype-apps-bind.md](c-discovery-prototype-apps-bind.md); [c-discovery-live-stub-apps-bind.md](c-discovery-live-stub-apps-bind.md) |

## `/inventory`

| Field | Recorded boundary |
| --- | --- |
| Surface | `inventory-venue-select` |
| Current boundary | `stub-only`: synthetic seat/GA summary, bounded page, detail and selection; selection creates no hold, payment, right or entry. |
| Integration HTTP | No inventory summary/page/detail read command; not-bound. |
| External dependency | `kix-protocol:ps-05-query-projections`, `kix-protocol:ps-06-admission-load`; unpromoted `bind-reservation-fsm`, `bind-admission-fsm`, `c-inventory-venue`. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Accessible-seat policy is `UNDETERMINED`; no venue equipment is authorized. |
| Evidence | [c-inventory-venue-stub-apps-bind.md](c-inventory-venue-stub-apps-bind.md) |

## `/booking/:eventId`

| Field | Recorded boundary |
| --- | --- |
| Surface | `booking-journey`, `reservation-case`, `refund-return-desk` |
| Current boundary | `published-bound` BookingJourney over the local-call invoker; separate `stub-only` B01–B05 reservation FSM and in-process refund/return source. No payment or issuance finality. |
| Integration HTTP | `BookingJourney` sends only `create_event` → `prepare_trade` → `accept_trade` with published bodies. `placeHold({ eventId, quantity })` differs from `reserve_listing` (domain, expiresAt, listingHash, listingId, tradeId), remains not-bound, and keeps `consideredAction: reserve_listing`. `confirmBooking(holdId)` differs from `capture` and sends none. Mock reservation commands are not catalogue commands; `refund_ticket`, `void_unissued`, `adjust_pg_cancel` and `observe_return` are recorded, never sent. |
| External dependency | `kix-protocol:openapi-catalogue-promotion` and `kix-protocol:contract-compatibility-profile` → `bind-reservation-fsm`; `bind-wave4-pointers` and `primary-price-fee-ui` (including `kix-protocol:move-primary-price-fee`) remain pending; `refund-surface`, `api-state-distinction`, `c-journey-identity` and `c-async-session-fence` consumers remain unpromoted; authoritative refund/return evidence and policy are absent. Browser local calls additionally need `kix-protocol:gate-browser-access` → `browser-gate-path`; no proxy bypass. |
| Owning decision | M2 + H1 is RECORDED; `commit_trade`, `open_admission` and `admit` stay uncomposed by this journey. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Price, fee and refund policies remain `UNDETERMINED`. |
| Evidence | [wave-6a-journey-adapter-apps-bind.md](wave-6a-journey-adapter-apps-bind.md); [reservation-depth-apps-bind.md](reservation-depth-apps-bind.md); [c-refund-return-states-stub-apps-bind.md](c-refund-return-states-stub-apps-bind.md); [source](../packages/protocol-adapter/src/commerce-bindings.ts) |

## `/admission`

| Field | Recorded boundary |
| --- | --- |
| Surface | `admission-credential`; reservation admission controls |
| Current boundary | `stub-only` mock credential verdicts and P03 reservation FSM; no venue scanning or real admission. |
| Integration HTTP | `checkAdmission({ rightsRef, gateId })` differs from `admit` (admissionEpoch, domain, expectedVersion, holder, ticketId). HTTP reads a loopback probe and sends no `admit`; mock admission commands remain not-bound. |
| External dependency | `kix-protocol:openapi-catalogue-promotion` and `kix-protocol:contract-compatibility-profile` → `bind-admission-fsm` and `bind-reservation-fsm`; real venue/load evidence is outside the mock. Equipment and venue authorization are separate User decisions. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [admission-harden-apps-bind.md](admission-harden-apps-bind.md); [reservation-depth-apps-bind.md](reservation-depth-apps-bind.md) |

## `/resale`

| Field | Recorded boundary |
| --- | --- |
| Surface | `resale-desk` |
| Current boundary | `stub-only` R01–R05 resale FSM; display ask labels and simulated payment, no live marketplace. |
| Integration HTTP | No resale list command. `openResale({ bookingId, askLabel })` differs from `create_listing`; `acceptResale(listingId)` differs from `accept_trade`. Mock FSM commands remain not-bound. |
| External dependency | `kix-protocol:openapi-catalogue-promotion` and `kix-protocol:contract-compatibility-profile` → `bind-resale-fsm`; real resale producer contract and marketplace operation remain outside the stub (see platform dependencies). |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Pricing, fees and refund policy are `UNDETERMINED`. |
| Evidence | [resale-depth-apps-bind.md](resale-depth-apps-bind.md) |

## `/gift`

| Field | Recorded boundary |
| --- | --- |
| Surface | `gift-transfer` |
| Current boundary | `published-bound` GiftTransfer local-call capability with stub-shape default receipts. BookingJourney does not produce a giftable right. |
| Integration HTTP | `offer_gift`, then `accept_gift` or `cancel_gift`, using caller-supplied published bodies. Caller supplies `ticketId` and `expectedVersion`; no right is minted here. |
| External dependency | Authoritative giftable right/version must come from a producer; current booking flow cannot supply it. Browser access needs `kix-protocol:gate-browser-access` → `browser-gate-path`. Chain/network and production credentials are unselected, not implied by a local receipt. |
| Owning decision | M2 + H1 is RECORDED. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [gift-surface-apps-bind.md](gift-surface-apps-bind.md) |

## `/mobile`

| Field | Recorded boundary |
| --- | --- |
| Surface | `installable-mobile-shell` |
| Current boundary | `stub-only`: synthetic install, update, reconnect, pass presentation, confirm and withdraw; cached vault copies grant no authority, resume replays nothing. |
| Integration HTTP | No install/session/vault/presentation/device command; `c-installable-mobile` remains unpromoted, so reads and writes are not-bound. |
| External dependency | Documented real install/device/session and authoritative pass prerequisites remain unavailable. No producer identifier is invented. Device attestation, authentic login and a real install/update environment need separately reviewed evidence and User authorization; no payment dependency is inferred from this shell. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Retention is `UNDETERMINED`. |
| Evidence | [c-installable-mobile-stub-apps-bind.md](c-installable-mobile-stub-apps-bind.md) |

## `/assistant`

| Field | Recorded boundary |
| --- | --- |
| Surface | `delegated-assistant` |
| Current boundary | `stub-only` in-process request, proposal, approval and command records; unadopted execution delegation stays query/propose. |
| Integration HTTP | No delegation grant, assistant proposal or assistant command read/write contract; not-bound. |
| External dependency | `kix-protocol:ai-delegation-execution-decision`, `kix-protocol:k-authority-qualification`; unpromoted `delegation-surface` and `c-delegated-assistant`. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Execution delegation is not adopted; request text never grants authority. |
| Evidence | [c-delegated-assistant-stub-apps-bind.md](c-delegated-assistant-stub-apps-bind.md) |

## `/organizer`

| Field | Recorded boundary |
| --- | --- |
| Surface | `organizer-console` |
| Current boundary | `published-bound`: caller-supplied command bodies; default receipts are stub-shape. |
| Integration HTTP | OrganizerConsole independently supports its six published commands: `create_event`, `close_sales`, `open_admission`, `complete_event`, `cancel_event`, `issue_invitation`. Its `open_admission` does not extend BookingJourney or send `admit`. |
| External dependency | Browser access needs `kix-protocol:gate-browser-access` → `browser-gate-path`; authoritative event/right state, approved chain/network and production deploy/credential decisions are absent. No new endpoint or producer contract is selected. |
| Owning decision | M2 + H1 is RECORDED for the booking composition boundary. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [organizer-admin-console-apps-bind.md](organizer-admin-console-apps-bind.md) |

## `/organizer/workspace`

| Field | Recorded boundary |
| --- | --- |
| Surface | `organizer-workspace` |
| Current boundary | `published-bound`: editable fields, preview and one-at-a-time send through the same OrganizerConsole; default receipts are stub-shape. |
| Integration HTTP | OrganizerConsole independently supports its six published commands: `create_event`, `close_sales`, `open_admission`, `complete_event`, `cancel_event`, `issue_invitation`. Its `open_admission` does not extend BookingJourney or send `admit`. |
| External dependency | Browser access needs `kix-protocol:gate-browser-access` → `browser-gate-path`; authoritative event/right state, approved chain/network and production deploy/credential decisions are absent. No new endpoint or producer contract is selected. |
| Owning decision | M2 + H1 is RECORDED for the booking composition boundary. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-organizer-workspace-apps-bind.md](c-organizer-workspace-apps-bind.md) |

## `/merchant`

| Field | Recorded boundary |
| --- | --- |
| Surface | `merchant-operations` |
| Current boundary | `stub-only`: events, listings, trades and settlement-obligation lines on separate synthetic cuts; judged export is not settled or lendable funds. |
| Integration HTTP | Not-bound: no event/listing/trade/settlement-obligation projection read or export command. |
| External dependency | `kix-protocol:fin-catalogue-read-model`, `kix-protocol:ps-05-query-projections`; unpromoted `c-finance-projection`; `c-merchant-operations` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-merchant-operations-stub-apps-bind.md](c-merchant-operations-stub-apps-bind.md) |

## `/finance`

| Field | Recorded boundary |
| --- | --- |
| Surface | `finance-operations` |
| Current boundary | `stub-only`: synthetic reconciliation cases, exceptions, source totals, payees and accounting export. A proposal or approval changes no economic state. |
| Integration HTTP | Not-bound: no current producer tuple, reconciliation/source-cut/payee/allocation/export read or ledger-correction command. |
| External dependency | `kix-protocol:fin-catalogue-read-model`, `kix-protocol:cr-08-producer-sdk`; unpromoted `refund-surface`; `c-finance-operations` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-finance-operations-stub-apps-bind.md](c-finance-operations-stub-apps-bind.md) |

## `/provider`

| Field | Recorded boundary |
| --- | --- |
| Surface | `provider-connected-journey` |
| Current boundary | `stub-only`: checkout redirect, return landing, provider report, payment observation, issuance and refund are separate in-process records. Sandbox success is not payment; refund record executes nothing. |
| Integration HTTP | Not-bound: no provider order/checkout/payment/issuance/refund projection read; sandbox and authority contracts unavailable. |
| External dependency | `kix-protocol:k-provider-sandbox`, `kix-protocol:k-authority-qualification`; approved payment provider/account, credentials and sandbox environment are separate missing capabilities; `c-provider-connected-journey` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. User decides provider/account, money, keys and production; selection and credential provisioning are `UNDETERMINED`. No real provider or bank rail is wired. |
| Evidence | [c-provider-connected-journey-stub-apps-bind.md](c-provider-connected-journey-stub-apps-bind.md) |

## `/credit`

| Field | Recorded boundary |
| --- | --- |
| Surface | `credit-desk` |
| Current boundary | `stub-only` F04 credit FSM; draw records mock exposure, repay records a mock note, no currency posting or disbursement. |
| Integration HTTP | No credit FSM read/write command. `disburseCredit` is refused; the boundary action stays `none`. |
| External dependency | `kix-protocol:openapi-catalogue-promotion` and `kix-protocol:contract-compatibility-profile` → `bind-credit-fsm`; real credit producer evidence and any funds execution remain outside scope. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Credit eligibility, rates, limits and repayment policy remain `UNDETERMINED`; F04/E06 stay 설계중. |
| Evidence | [credit-depth-apps-bind.md](credit-depth-apps-bind.md) |

## `/credit/origination`

| Field | Recorded boundary |
| --- | --- |
| Surface | `credit-origination` |
| Current boundary | `stub-only`: claim basis, policy revision, consents/documents and application/review/commitment/drawdown lanes. Submission, approval, commitment and disbursement stay separate. |
| Integration HTTP | Not-bound: no current producer tuple or application/review/commitment/drawdown and claim/policy/consent/document contracts. |
| External dependency | `kix-protocol:cr-08-producer-sdk`; unpromoted `bind-credit-fsm`, `c-finance-projection`, `c-journey-identity`; `c-credit-origination` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Credit policy remains `UNDETERMINED`; no real KYC or credit disbursement. |
| Evidence | [c-credit-origination-stub-apps-bind.md](c-credit-origination-stub-apps-bind.md) |

## `/credit/servicing`

| Field | Recorded boundary |
| --- | --- |
| Surface | `credit-servicing` |
| Current boundary | `stub-only`: synthetic instruction, disbursement observation, reservation and exposure kept separate; schedule/payments/allocations/reversals/cases do not execute funds. |
| Integration HTTP | Not-bound: no current producer tuple, credit servicing command or obligation/repayment/allocation/case projection read. |
| External dependency | `kix-protocol:cr-08-producer-sdk`; unpromoted `c-async-session-fence`, `c-finance-projection`, `c-journey-identity`; `c-credit-servicing-journey` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Credit and repayment policies remain `UNDETERMINED`; case closure extinguishes no debt. |
| Evidence | [c-credit-servicing-journey-stub-apps-bind.md](c-credit-servicing-journey-stub-apps-bind.md) |

## `/marketing`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-hub` |
| Current boundary | `no-published-command`: browser-session stub hub; M01–M04 stay 설계중, M05 stays 미착수. |
| Integration HTTP | Hub sends no protocol command; M05 is an independent local-call binding. |
| External dependency | `kix-protocol:wave7-marketing-contracts`, `kix-protocol:contract-compatibility-profile` and unpromoted `w7-m01-membership`, `w7-m02-presale`, `w7-m03-coupon`, `w7-m04-referral`; no CRM send provider is wired. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. ORIGINAL_32 truth belongs to kix-protocol. |
| Evidence | [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md); [c-plan-c-m01-m04-stub-depth-stub-apps-bind.md](c-plan-c-m01-m04-stub-depth-stub-apps-bind.md) |

## `/marketing/journey`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-journey` |
| Current boundary | `stub-only`: benefit discovery, application, rejection and reclaim; consent is read only. No purchase confirmation or reward payout. |
| Integration HTTP | Not-bound: catalogue publishes consent commands only; no membership eligibility/presale priority/usage/coupon budget/referral attribution/benefit reclaim command or read. |
| External dependency | `kix-protocol:wave7-marketing-contracts`; unpromoted `w7-m01-membership`, `w7-m02-presale`, `w7-m03-coupon`, `w7-m04-referral`; `c-marketing-journey` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-marketing-journey-stub-apps-bind.md](c-marketing-journey-stub-apps-bind.md) |

## `/marketing/m01`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-m01` |
| Current boundary | `no-published-command`: browser-session guest/fan/member card, explicit join/update/clear and unknown knowledge recovery. Label stays 설계중. |
| Integration HTTP | No published command for this surface. Session mutations send nothing; M02 display catalogue read is not-bound in HTTP. |
| External dependency | `kix-protocol:wave7-marketing-contracts`, `kix-protocol:contract-compatibility-profile` → unpromoted `w7-m01-membership`; producer qualification/window/benefit semantics cannot be inferred from fixtures. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Fixture windows, markers and counts are not product policy. |
| Evidence | [c-plan-c-m01-m04-stub-depth-stub-apps-bind.md](c-plan-c-m01-m04-stub-depth-stub-apps-bind.md); [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md) |

## `/marketing/m02`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-m02` |
| Current boundary | `no-published-command`: browser-session record, withdraw and explicitly re-enter presale interest; one display-only stub listPerformances read creates no hold. Label stays 설계중. |
| Integration HTTP | No published command for this surface. Session mutations send nothing; M02 display catalogue read is not-bound in HTTP. |
| External dependency | `kix-protocol:wave7-marketing-contracts`, `kix-protocol:contract-compatibility-profile` → unpromoted `w7-m02-presale`; producer qualification/window/benefit semantics cannot be inferred from fixtures. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Fixture windows, markers and counts are not product policy. |
| Evidence | [c-plan-c-m01-m04-stub-depth-stub-apps-bind.md](c-plan-c-m01-m04-stub-depth-stub-apps-bind.md); [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md) |

## `/marketing/m03`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-m03` |
| Current boundary | `no-published-command`: browser-session coupon markers with fixture validity, expiry and conflict refusals; no price or payment instrument. Label stays 설계중. |
| Integration HTTP | No published command for this surface. Session mutations send nothing; M02 display catalogue read is not-bound in HTTP. |
| External dependency | `kix-protocol:wave7-marketing-contracts`, `kix-protocol:contract-compatibility-profile` → unpromoted `w7-m03-coupon`; producer qualification/window/benefit semantics cannot be inferred from fixtures. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Fixture windows, markers and counts are not product policy. |
| Evidence | [c-plan-c-m01-m04-stub-depth-stub-apps-bind.md](c-plan-c-m01-m04-stub-depth-stub-apps-bind.md); [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md) |

## `/marketing/m04`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-m04` |
| Current boundary | `no-published-command`: browser-session referral attribution and reward markers with source/duplicate/self refusals; no credit payout. Label stays 설계중. |
| Integration HTTP | No published command for this surface. Session mutations send nothing; M02 display catalogue read is not-bound in HTTP. |
| External dependency | `kix-protocol:wave7-marketing-contracts`, `kix-protocol:contract-compatibility-profile` → unpromoted `w7-m04-referral`; producer qualification/window/benefit semantics cannot be inferred from fixtures. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Fixture windows, markers and counts are not product policy. |
| Evidence | [c-plan-c-m01-m04-stub-depth-stub-apps-bind.md](c-plan-c-m01-m04-stub-depth-stub-apps-bind.md); [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md) |

## `/marketing/m05`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketing-m05` |
| Current boundary | `published-bound` ConsentBind plus session consent flags; M05 stays 미착수. `channelSend: none`. |
| Integration HTTP | `set_consent` then `authorize_marketing` via the existing local-call invoker; no CRM message is sent. Stub default is stub-shape; rejected/unknown/not-sent fences the next write. |
| External dependency | Browser access needs `kix-protocol:gate-browser-access` → `browser-gate-path`. Published consent bodies do not supply a real messaging provider, authenticated audience or production credentials. Broader marketing work still waits on `kix-protocol:wave7-marketing-contracts`. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Consent purpose, retention and actual channel-send/provider decisions remain `UNDETERMINED`. |
| Evidence | [m05-consent-bind-apps-bind.md](m05-consent-bind-apps-bind.md) |

## `/platform`

| Field | Recorded boundary |
| --- | --- |
| Surface | `platform-journey-trade` |
| Current boundary | `stub-only`: multi-channel listings, price change, booking, payment observation, right transfer and refund explanation on one synthetic source. UNKNOWN blocks the affected right. |
| Integration HTTP | Not-bound: no listing/trade/payment/transfer/refund projection read and no merged resale/partition/projection tuple. |
| External dependency | `kix-protocol:ps-03-resale-contract`, `kix-protocol:ps-04-execution-partitions`, `kix-protocol:ps-05-query-projections`; unpromoted `bind-resale-fsm`, `refund-surface`, `c-async-session-fence`; `c-platform-journey` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Price, fee and refund policies are `UNDETERMINED`. |
| Evidence | [c-platform-journey-stub-apps-bind.md](c-platform-journey-stub-apps-bind.md) |

## `/marketplace-performance`

| Field | Recorded boundary |
| --- | --- |
| Surface | `marketplace-performance-bench` |
| Current boundary | `stub-only`: lazy 150000-row synthetic stream with bounded windows, queue and stale-context refusal. Browser measurements and emulated devices are observations, never SLOs. |
| Integration HTTP | Not-bound: no marketplace read/queue/search command; no real producer load qualification. |
| External dependency | `kix-protocol:ps-07-scale-qualification`; real producer/device/load evidence absent; `c-marketplace-performance` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-marketplace-performance-stub-apps-bind.md](c-marketplace-performance-stub-apps-bind.md) |

## `/permissions`

| Field | Recorded boundary |
| --- | --- |
| Surface | `tenant-permissions` |
| Current boundary | `stub-only`: tenant roles, maker/checker records, grants/generations and sensitive export adjudicated at the synthetic source. Hidden controls grant no permission. |
| Integration HTTP | Not-bound: no organization/role/account/support/audit/export read or permission grant/revoke command. |
| External dependency | `kix-protocol:k-operator-contract`; real authenticated tenant/actor authorization evidence absent; `c-tenant-permissions` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-tenant-permissions-stub-apps-bind.md](c-tenant-permissions-stub-apps-bind.md) |

## `/notifications`

| Field | Recorded boundary |
| --- | --- |
| Surface | `notification-inbox` |
| Current boundary | `stub-only`: synthetic contracted-kind feed, source-key dedupe, read state, grant generations and redacted inquiry. Offered actions navigate; arrivals prove no economic effect. |
| Integration HTTP | Not-bound: no notification read, dedupe/read-state, action resolve or inquiry command. |
| External dependency | `kix-protocol:k-operator-contract`; real notification producer and any external delivery integration absent; `c-notification-inbox` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-notification-inbox-stub-apps-bind.md](c-notification-inbox-stub-apps-bind.md) |

## `/identity`

| Field | Recorded boundary |
| --- | --- |
| Surface | `journey-identity` |
| Current boundary | `stub-only`: app-internal context binds mode, actor, role, domain, cut generation, tuple and incarnation. Attach records an observation; foreign/stale rows are not authority. |
| Integration HTTP | Not-bound: no journey read/evidence command; attach and read stay not-bound. |
| External dependency | `kix-protocol:protocol-runtime-boundary-register`, `kix-protocol:protocol-canonical-identity-conformance`, `kix-protocol:protocol-read-projection-evidence`, `kix-protocol:contract-compatibility-profile`; external identity registry absent; `c-journey-identity` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-journey-identity-stub-apps-bind.md](c-journey-identity-stub-apps-bind.md) |

## `/session`

| Field | Recorded boundary |
| --- | --- |
| Surface | `session-recovery` |
| Current boundary | `stub-only`: tab-session write-ahead journal over synthetic identity attach. Reload preserves unsettled intents as UNKNOWN and confirmed rows as history; corrupt/lost evidence is SESSION_EVIDENCE_LOST. No resend. |
| Integration HTTP | Not-bound: no journey read/evidence command or authoritative recovery; no exactly-once guarantee. |
| External dependency | `kix-protocol:protocol-local-recovery-conformance`, `kix-protocol:protocol-read-projection-evidence`, `kix-protocol:contract-compatibility-profile`; identity prerequisites above and unpromoted `c-journey-identity`; `c-async-session-fence` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Session retention stays `UNDETERMINED`. |
| Evidence | [c-session-recovery-stub-apps-bind.md](c-session-recovery-stub-apps-bind.md) |

## `/receipts`

| Field | Recorded boundary |
| --- | --- |
| Surface | `receipt-explorer` |
| Current boundary | `stub-only`: page-load adjudicated receipt detail, filtered bounded timeline pages and complete redacted support export. Filters/page changes retain evidence and lift no fence. |
| Integration HTTP | No write and no producer receipt/history read command. Stub-shape receipts are never labelled gate receipts. |
| External dependency | Authoritative context-bound receipt/read projection requires identity and read evidence prerequisites listed for identity; paging is local presentation, not a producer cursor. No new producer identifier or payment provider is implied. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. Retention remains `UNDETERMINED`. |
| Evidence | [c-receipt-explorer-apps-bind.md](c-receipt-explorer-apps-bind.md); [c-plan-c-receipt-pagination-stub-apps-bind.md](c-plan-c-receipt-pagination-stub-apps-bind.md) |

## `/handoff`

| Field | Recorded boundary |
| --- | --- |
| Surface | No workspace surface row; read-only handoff packet. |
| Current boundary | `stub-only`: local-command/synthetic/unsupported feature inventory, pins, consumed BOOTSTRAP and pending producers; no write. |
| Integration HTTP | Packet display sends no local call; it records browser CORS and other not-bound reasons, without a proxy. |
| External dependency | Informational route has no separate producer command dependency. Each listed pending consumer retains its own prerequisite; the consumed SDK supplies catalogue-schema binding only. |
| Owning decision | Recorded handoff status is not promotion. Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-local-workspace-closeout-apps-bind.md](c-local-workspace-closeout-apps-bind.md); [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md); [source](../apps/web/src/handoff/packet.ts) |

## `/journeys`

| Field | Recorded boundary |
| --- | --- |
| Surface | `cross-surface-journeys` |
| Current boundary | `stub-only`: read-only synthetic normal/reject/lost/partly-landed branch table; executed, reused and no-source-branch rows remain distinct. COMPENSATION_UNDEFINED names no command. |
| Integration HTTP | Not-bound: no cross-surface journey projection command; port is not-bound and wraps no stub around HTTP. |
| External dependency | `kix-protocol:contract-compatibility-profile`; unpromoted `c-journey-identity`, `c-async-session-fence` and sibling real producer consumers; `c-cross-surface-journeys` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. |
| Evidence | [c-cross-surface-journeys-stub-apps-bind.md](c-cross-surface-journeys-stub-apps-bind.md) |

## `/qualification`

| Field | Recorded boundary |
| --- | --- |
| Surface | `platform-operational-qualification` |
| Current boundary | `stub-only`: whole-matrix sibling stub exercises produce STUB_RUN_RECORDED only. Functional/performance/security/environment scopes keep separate denominators; no real-user acceptance. |
| Integration HTTP | Not-bound: no qualification command and no promoted real producer qualification tuple. |
| External dependency | `kix-protocol:ps-07-scale-qualification`, `kix-protocol:cr-10-credit-qualification`; unpromoted `commerce-integration-closeout`; `c-platform-operational-qualification` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. User acceptance and environment qualification remain pending, independent from passing local tests. |
| Evidence | [c-platform-operational-qualification-stub-apps-bind.md](c-platform-operational-qualification-stub-apps-bind.md) |

## `/release`

| Field | Recorded boundary |
| --- | --- |
| Surface | `platform-release` |
| Current boundary | `stub-only`: in-process candidate/config tuple, technical stub qualification and support/privacy/accessibility/update handoffs. Install/publish/operate decisions are shown, never taken. |
| Integration HTTP | Not-bound: no release command; producer release, RELEASE gate and User RELEASE decision absent. |
| External dependency | `kix-protocol:k-platform-release`, `commerce-integration-closeout`, real qualification evidence and User RELEASE decision; production deploy environment and credentials unselected; `c-platform-release` remains unpromoted. |
| Owning decision | Producer contract authority: kix-protocol; consumer promotion remains pending in the cited evidence. User retains money, keys, equipment, production and release decisions; unresolved policy values and any unassigned policy owner are `UNDETERMINED`. User owns RELEASE, install, publish and operate decisions; real-user acceptance remains PENDING_USER_DECISION. No runtime is enabled. |
| Evidence | [c-platform-release-stub-apps-bind.md](c-platform-release-stub-apps-bind.md) |

## `/help`

| Field | Recorded boundary |
| --- | --- |
| Surface | No workspace surface row; guide glossary page. |
| Current boundary | `stub-only` read-only local guide/status copy; no authority or economic outcome. |
| Integration HTTP | No command or separate HTTP integration. |
| External dependency | No external producer required to display bundled help. Future real-operation instructions need their own approved evidence; no payment, chain or deploy dependency is invented for copy. |
| Owning decision | Guide scope is recorded by the cited bind; User acceptance/release remains separate. Unassigned future operational-copy owner is `UNDETERMINED`. |
| Evidence | [c-user-guides-stub-apps-bind.md](c-user-guides-stub-apps-bind.md); [source](../apps/web/src/guide/status-words.ts) |

## `/diagnostics`

| Field | Recorded boundary |
| --- | --- |
| Surface | No workspace surface row; read-only diagnostics page. |
| Current boundary | `stub-only` app-internal build identity, redacted last-ten page-lifetime outcomes and read-only journal summary/JSON. Export contains no actor, body, storage text or URL. |
| Integration HTTP | Display/export sends nothing and writes no storage; integration HTTP is represented only as loopback. Not a producer manifest or public BUILD_ID. |
| External dependency | No separate producer needed for local diagnostics. Authentic production telemetry, deployment and credential decisions are outside this route; no endpoint is invented. |
| Owning decision | App-internal presentation only per cited bind; producer truth remains external. User retains production/release; retention and unassigned operational owner remain `UNDETERMINED`. |
| Evidence | [c-plan-d-build-identity-diagnostics-stub-apps-bind.md](c-plan-d-build-identity-diagnostics-stub-apps-bind.md); [source](../apps/web/src/diagnostics/model.ts) |

### Alias, development route and not-found state

- `/discovery/:rowId` is an alias of `/discovery` in ROUTE_ALIASES. It draws the same synthetic discovery surfaces with the same prerequisites and decision owners; it is not a separate producer read.
- `/dev/gallery` exists only in the DEV extension of APP_ROUTES. No workspace surface exists; its `stub-only` synthetic component cases send no business command and need no producer integration. It is removed from production route matrices. See [gallery evidence](c-component-gallery-stub-apps-bind.md) and [case source](../apps/web/src/dev/gallery/cases.tsx). Any future publication decision belongs to User and remains ungranted.
- `*` is the not-found state, not a business surface, producer command or release claim. See [shell evidence](c-app-shell-resilience-stub-apps-bind.md). `accessibility-baseline` has route `(none)` in the workspace registry and is cross-cutting observation, not an additional route or user acceptance.

## External dependencies and decisions

| Capability gap | Recorded dependency and owning authority |
| --- | --- |
| Catalogue and FSM data | kix-protocol owns `kix-protocol:read-model-reference`, `kix-protocol:openapi-catalogue-promotion`, `kix-protocol:p-sdk-1` and `kix-protocol:contract-compatibility-profile`. `bind-list-read` and the corresponding `bind-*-fsm` consumers remain pending; the BOOTSTRAP SDK does not supply these real read models or FSM bindings. See [local evidence matrix](c-local-evidence-matrix-stub-apps-bind.md). |
| Browser local calls | `kix-protocol:gate-browser-access` plus unpromoted `browser-gate-path`; current gate has no browser CORS support. No proxy, relaxed origin or fallback is authorized. See [HTTP boundary](http-integration-gate-apps-bind.md). |
| Provider/payment/account/keys | `/provider` requires the sandbox and authority producers above, plus a User-selected approved provider/account/environment and credential provisioning. Provider, keys and real payment decisions are `UNDETERMINED`; no gateway, bank rail or secret is chosen. |
| Chain and production environment | Local catalogue commands do not establish a chain, network, authenticated actor or deployed endpoint. User owns chain/mainnet, production deployment, money and keys decisions. Environment, credential owner and network selection remain `UNDETERMINED`; no production configuration or runtime enablement is added. |
| Product policy | Prices, fees, refund/return values, credit policy, accessible-seat policy and retention remain `UNDETERMINED` wherever no authoritative decision is recorded. Fixture values are demo inputs. User retains reserved decisions; any otherwise unassigned policy owner is `UNDETERMINED`, not appointed by this document. See [workspace policy boundaries](workspace-design-apps-bind.md). |
| Qualification, acceptance and release | Real producer qualification, `commerce-integration-closeout`, `kix-protocol:k-platform-release`, the RELEASE gate and User RELEASE decision remain separate. Passing stub checks, BOOTSTRAP schema checks or a synthetic candidate packet grants none of them. |

Producer contracts remain kix-protocol authority; consuming a merged contract and promoting a consumer requires separately authorized work and verified evidence. Nothing here implements an unmerged dependency. If future consumption moves a catalogue/gate, both OpenAPI pins, PINNED_ACTIONS, CI KIX_PROTOCOL_GATE_SHA and protocolMergeSha must move together. This node moves none.

## Verification and limitations

The [bind/evidence record](c-plan-c-docs-launch-gap-index-stub-apps-bind.md) contains the runnable offline route/link checker, acceptance mapping and actual local command results. The checker validates README route coverage, canonical route completeness/uniqueness, shared workspace surface coverage and relative links/fragments in the three changed documents; it performs no network request. Existing guide, route, local-evidence and adapter checks are complementary and do not automatically validate this index.

All results are local stub evidence. Live-gate tests skipped under KIX_REQUIRE_GATE=0 remain skipped; no fresh upstream, hosted browser, accessibility, visual, coverage, user acceptance or release result is claimed. Unavailable capabilities are documented, not selected or integrated. No blocking decision is required to describe these gaps.
