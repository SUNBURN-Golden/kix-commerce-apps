# Wave 7 marketing desk (M01–M05)

Wave 7 adds marketing UI for five ORIGINAL_32 labels. Each label stays **설계중**. The screens are stub demos for one browser page load.

| Label | Route | Korean title | English title | Demo |
| --- | --- | --- | --- | --- |
| M01 | `/marketing` and `/marketing/m01` | 팬 자격 / 멤버십 | Fan qualification / membership | Session card `mbr_stub_*` |
| M02 | `/marketing/m02` | 선예매 | Presale | Interest note while a demo window is open |
| M03 | `/marketing/m03` | 쿠폰 / 프로모션 | Coupon / promotion | Display marker from a fixture code |
| M04 | `/marketing/m04` | 추천 / 리워드 | Referral / rewards | Count of demo markers |
| M05 | `/marketing/m05` | CRM / 데이터 활용 | CRM / data use | Consent flags with send left at `none` |

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

The protocol adapter pins the published contract-only OpenAPI catalogue. That pin is not a live HTTP server, not a production endpoint, and not a conformance claim. A live HTTP server is still required before any claim of:

- live chain or chain finality
- real payment or funds movement
- production readiness, production CRM, or production integration
- finalized booking, resale, or admission semantics
- contract conformance
- launch

This wave does not make those claims. M01–M05 are not promoted out of 설계중.

## Out of scope

- Credit disbursement, card capture, and paid purchase
- Product TPS, p99, or fail-rate SLOs
- ZARI, film-unit, maeum-gyeol, SOULBOUND, ai-ops-control-plane, and beautiful-mind
- Edits to kix-protocol product code
