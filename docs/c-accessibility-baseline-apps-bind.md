# Accessibility baseline apps bind

This bind is the shared presentation on the screens that already exist. It adds no route and no command. Amounts and quantities on screen are copied whole-unit strings, or the page says price and fee display is `UNDETERMINED`. A display clock can change with locale. Reservation expiry stays the adapter instant and the adapter `expired` flag. After an error, the typed value and the selection stay, and focus returns to that control. Loading, blocked, selected, and review each have a word and a border style, not only a color.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`), and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. The branch base is `2a0f35549f3c290cb7753880cca37bfd31d6a926`. This delivery is the uncommitted diff on `agent/kixc-c-accessibility-baseline`. The supervisor commits.

## What the pages show

`apps/web/src/a11y/present.ts` copies a safe integer into a unit string. `20000` with the label `mock units` stays `20000 mock units`. A float and a decimal string are refused and are not calculated. Booking quantity accepts only the digit strings `1` through `6`. Discovery counts and tiers stay `synthetic count N` and `synthetic tier T3`. The price notice is `Price and fee display is UNDETERMINED. No amount is calculated on this page.` There is no currency symbol.

`presentInstant` formats a valid ISO instant in `en-GB` or `ko-KR` and appends `UTC`. `formatWhen` uses `en-GB`. An invalid instant is returned unchanged. `expiryAuthority` copies `expiresAt` and `expired`. It does not read the clock. A hold record has no `expired` flag, so the booking page prints `expired not decided on this page` and puts the raw ISO on `data-expires-at` and on `time[dateTime]`.

Status words are `Loading`, `Blocked`, `Selected`, and `In review`, each with a sentence. CSS uppercases the short word (`SELECTED`, `BLOCKED`, `IN REVIEW`) and sets the border to dashed, double, solid, or dotted. The meaning sentence is not transformed. The transport banner still says `Integration HTTP is not selected` and prepends `Local.`, `Loading.`, `Blocked.`, or `Ready.`

The shell has a skip link to `#desk-main`. Nav links and buttons use a 44px minimum. `:focus-visible` draws an outline. There is no `@keyframes` and no `animation`.

## Focus after an error

| Screen | What stays | Where focus goes |
| --- | --- | --- |
| Booking | The typed quantity and the show | `#booking-quantity` when the quantity is refused or the hold call throws, and there is no hold |
| Discovery | The conflicting section, kind, or dates, and the URL query | `#discovery-section`, `#discovery-purchasable`, or `#discovery-from` for that conflict |
| Organizer workspace | The editor, including seats | `#organizer-ws-event-id` when the preview is not ready, or when a send result is not `RECEIPT` |
| Gift | Gift id, ticket id, and the expires-at text | `#gift-ticket-id` when a row is `rejected`, `not-sent`, or `unconfirmed` |

A faulting gift offer used to disable the ticket field, so focus could not land. On that fault the ticket field is `readOnly` instead of `disabled`. The other gift fields stay disabled. The send button stays disabled. The desk does not retry.

## Browser run

Observed in headless Chrome 154.0.8037.97 on 2026-10-13. The desk was `vite preview` at `http://127.0.0.1:4179` from the production build. The stub adapter was selected. No page exception. Chrome's accessibility tree was read once on `/buyer`. That is not a screen-reader session.

| Step | Observed |
| --- | --- |
| Booking load | A mutation observer installed before navigation recorded `Loading the performance.` A later 20ms poll sampled the ready page, so the sentence was not still on screen. |
| Booking show | `/booking/evt_lanterns`. Title North Station Lanterns. `No amount is calculated on this page.` `40 still open. Count copied. Not an amount.` |
| Refused quantity | Typed `1.5` and pressed Enter. The field stayed `1.5`, `aria-invalid` was `true`, focus was `#booking-quantity`, and the show title stayed. |
| Hold | Typed `2` and pressed Enter. Quantity stayed `2`. `data-expires-at` and `time[dateTime]` were `2026-10-13T00:16:23.270Z`. `data-expired` was `unspecified`. The clock was `13 Oct 2026, 00:16 UTC`. The authority sentence named that ISO and said display locale does not decide expiry. |
| Mobile discovery | Viewport 390×844, device scale 2. `scrollWidth` 390 and `clientWidth` 390. 37 `nav a`, `button`, and `.button` targets, none under 44px. |
| Empty search | Typed `zzzz-not-a-row`. The field kept that string, focus stayed in `#discovery-q`, and the page said `No matching synthetic rows.` |
| Filter conflict | Section `A` and the GA checkbox. The page said `A GA kind cannot take a section.` and `Filter conflict. The query was not run.` Section stayed `A`, GA stayed checked, `#discovery-section` was `aria-invalid` and held focus. |
| Buyer selection | Focused the first show button and pressed Enter. `aria-pressed` was `true`. The accessibility tree exposed `SELECTED` and `This row is selected. Selection is not a reservation and not a payment.` The page text included `evt_lanterns`. |
| Organizer preview | Typed seats `A-1`, left the event id empty, added the row, and prepared. Focus returned to `#organizer-ws-event-id`. Seats stayed `A-1`. Rendered text included `BLOCKED` and `IN REVIEW`, and the page said `Empty event id.` Typing then produced `evt_after` and seats stayed `A-1`. |
| Gift fault | Typed gift id `gift-kept`, ticket `ticket-kept`, expires `nope`, and pressed Enter on `Send offer_gift`. The panel text included `Not sent` or `Rejected`. All three values stayed. Focus returned to `#gift-ticket-id`. |
| Narrow booking | Viewport 640×900. `scrollWidth` 625 and `clientWidth` 625. `#booking-quantity` still took focus. This is a narrow viewport, not a browser zoom setting. |
| Skip link | On `/`, the first Tab landed on `Skip to content`. Enter moved focus to `#desk-main`. |
| Credit | `/credit` had the undetermined amount notice. The page text had no `$`, `₩`, `KRW`, or `USD`. |

The browser does not reach a live gate. HTTP mode (`VITE_KIX_PROTOCOL_MODE=http`) was not opened in this run. The pages did not post `capture` or `settle_capture`.

## Hold

`UNDETERMINED` until a product owner sets them: price and fee display, and refund and cancel policy values. This baseline prints the undetermined price notice and does not invent a currency. A hold page does not decide `expired`. The adapter flag does.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them. No assistive-technology product was run.

## Tests

`apps/web/test/a11y-baseline.test.tsx` covers whole-unit copy, locale versus expiry authority, restored quantity and selection, status and deadline markup, and the skip link. `apps/web/test/workspace-registry.test.ts` expects the accessibility row to be implemented with route `(none)`, binding `no-published-command`, and the line `No added route.`

Browser exercise is the `Browser run` section above. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
