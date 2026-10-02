# Wave 7 marketing desk (M01–M05)

Wave 7 adds marketing UI for five ORIGINAL_32 labels. The screens are stub demos for one browser page load. Charter status is copied from kix-protocol `docs/status/ORIGINAL_32_STATUS.md` and is never promoted. M01–M04 stay **설계중**. M05 stays **미착수** (the name exists). A stub screen does not raise M05 to 설계중.

| Label | Status | Route | Korean title | English title | Demo |
| --- | --- | --- | --- | --- | --- |
| M01 | 설계중 | `/marketing` and `/marketing/m01` | 팬 자격 / 멤버십 | Fan qualification / membership | Session card `mbr_stub_*` |
| M02 | 설계중 | `/marketing/m02` | 선예매 | Presale | Interest note while a demo window is open |
| M03 | 설계중 | `/marketing/m03` | 쿠폰 / 프로모션 | Coupon / promotion | Display marker from a fixture code |
| M04 | 설계중 | `/marketing/m04` | 추천 / 리워드 | Referral / rewards | Count of demo markers |
| M05 | 미착수 | `/marketing/m05` | CRM / 데이터 활용 | CRM / data use | Consent flags with send left at `none` |

The hub is `/marketing`. Wave 6 routes (`/`, `/booking/:eventId`, `/admission`, `/resale`) stay on the same shell.

## What the stub is

Fixtures and session writes live in `apps/web/src/marketing`. A reload clears them. They are app-local view state.

- M01 cards are not Wave 2 rights.
- M02 may call `listPerformances` so the presale demo can show catalog titles. Recording interest does not call `placeHold`, `confirmBooking`, or any resale method.
- M03 markers have no price and no tender.
- M04 markers are a count. The desk has no disburse action. F04 stays outside this UI.
- M05 stores boolean flags on the stub. `channelSend` is `none`. The form has no address field and no sender.

Marketing code does not read the protocol-adapter OpenAPI pin and does not add methods to `CommerceProtocol`. `openApiBound` stays false. View-model fields already used by the box office (`eventId`, title, venue, start time, remaining capacity) stay local names. The pin is adapter-level. It is not marketing protocol truth, and M01–M05 do not call `authorize_marketing` or `set_consent`.

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
