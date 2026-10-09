# Wave 7 marketing desk (M01–M05)

Wave 7 adds marketing UI for five ORIGINAL_32 labels. The screens are stub demos for one browser page load. Charter status is copied from kix-protocol `docs/status/ORIGINAL_32_STATUS.md` and is never promoted. M01–M04 stay **설계중**. M05 stays **미착수** (the name exists). A stub screen does not raise M05 to 설계중.

| Label | Status | Route | Korean title | English title | Demo |
| --- | --- | --- | --- | --- | --- |
| M01 | 설계중 | `/marketing` and `/marketing/m01` | 팬 자격 / 멤버십 | Fan qualification / membership | Session card `mbr_stub_*` |
| M02 | 설계중 | `/marketing/m02` | 선예매 | Presale | Interest note while a demo window is open |
| M03 | 설계중 | `/marketing/m03` | 쿠폰 / 프로모션 | Coupon / promotion | Display marker from a fixture code |
| M04 | 설계중 | `/marketing/m04` | 추천 / 리워드 | Referral / rewards | Count of demo markers |
| M05 | 미착수 | `/marketing/m05` | CRM / 데이터 활용 | CRM / data use | Consent flags with send left at `none`, plus `ConsentBind` posts |

The hub is `/marketing`. Wave 6 routes (`/`, `/booking/:eventId`, `/admission`, `/resale`) stay on the same shell.

## What the stub is

Fixtures and session writes live in `apps/web/src/marketing`. A reload clears them. They are app-local view state.

- M01 cards are not Wave 2 rights.
- M02 may call `listPerformances` so the presale demo can show catalog titles. Recording interest does not call `placeHold`, `confirmBooking`, or any resale method.
- M03 markers have no price and no tender.
- M04 markers are a count. The desk has no disburse action. F04 stays outside this UI.
- M05 stores boolean flags on the stub. `channelSend` is `none`. The form has no address field and no sender. M05 also shows the `ConsentBind` panel below the flags.

Marketing runtime code does not read the protocol-adapter OpenAPI pin and does not add methods to `CommerceProtocol`. `apps/web/test/marketing-contracts.test.ts` reads that pin at test time only, to check `MARKETING_CONTRACT_ALIGNMENT`. No file under `apps/web/src/marketing` imports the pin. `openApiBound` stays false. View-model fields already used by the box office (`eventId`, title, venue, start time, remaining capacity) stay local names. The pin is adapter-level. It is not marketing protocol truth. M01–M04 call neither `authorize_marketing` nor `set_consent`. M05 posts them only through `ConsentBind`, which lives in `consent-desk` and the adapter, not under `apps/web/src/marketing` ([m05-consent-bind-apps-bind.md](m05-consent-bind-apps-bind.md)).

## Published contract alignment

The vendored contract-only catalogue publishes two commands whose names refer to marketing consent: `set_consent` and `authorize_marketing`. Nothing in that catalogue is a membership, presale, coupon, or referral command. M01–M04 therefore stay `no-published-command`. The pending contract name recorded on those rows is `wave7-marketing-contracts`. This repository does not merge that contract and does not invent its fields.

M05 is `published-bound` (w7-m05-consent-bind, #34). `ConsentBind` posts `set_consent`, then `authorize_marketing`. The stub stores `performanceNotes` and `membershipNotes`. Those names are not the `set_consent` body. The body field names, with no values, are `allowed`, `business`, `channel`, `domain`, `eventId`, `expectedConsentVersion`, and `purpose`. `authorize_marketing` adds `subject`. The bind is [m05-consent-bind-apps-bind.md](m05-consent-bind-apps-bind.md).

M02 may call `listPerformances` so the presale demo can show catalog titles. That method is an adapter read. It is not a catalogue command. Recording interest does not place a hold.

| Surface | Published command | Recorded state | Note |
| --- | --- | --- | --- |
| M01 | none | `no-published-command` | No catalogue command. Pending `wave7-marketing-contracts`. |
| M02 | none | `no-published-command` | Same. `listPerformances` is a display read, not a catalogue command. |
| M03 | none | `no-published-command` | No catalogue command. Markers have no price. |
| M04 | none | `no-published-command` | No catalogue command. No disburse. |
| M05 | `set_consent`, `authorize_marketing` | `published-bound` | Posted only by `ConsentBind` on `/marketing/m05` ([m05-consent-bind-apps-bind.md](m05-consent-bind-apps-bind.md)). Stub flags are not the body. |

kix-protocol `TASK_005` was not readable from this worktree. This section does not cite `TASK_005` line contents. The gate citation for opening Wave 7 is in [wave7-marketing-align-apps-bind.md](wave7-marketing-align-apps-bind.md).

## Required gate

The protocol adapter pins the published contract-only catalogue and, separately, the non-production integration-gate transport. Neither pin is a production endpoint or a conformance claim. Local HTTP success does not authorize:

- live chain or chain finality
- real payment or funds movement
- production readiness, production CRM, or production integration
- finalized booking, resale, or admission semantics
- contract conformance
- launch

This wave does not make those claims. M01–M04 are not promoted out of 설계중. M05 is not promoted out of 미착수. The session stub boundary stays 설계중 for the M01–M04 demo and is not the M05 charter label.

## Out of scope

- Credit disbursement, card capture, and paid purchase
- Product TPS, p99, or fail-rate SLOs
- ZARI, film-unit, maeum-gyeol, SOULBOUND, ai-ops-control-plane, and beautiful-mind
- Edits to kix-protocol product code
