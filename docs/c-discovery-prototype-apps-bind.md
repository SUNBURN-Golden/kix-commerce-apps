# Discovery prototype apps bind

This bind is the synthetic discovery page at `/discovery` and `/discovery/:rowId`. It gives search, filters, sort, paging, and a scale window a screen before a list command exists. The rows are a fixture. They are not stub-adapter data and not gate data.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical.

## What the page shows

The fixture is about 360 materialized rows plus a count-only scale of 1000000. `scaleRowAt` returns one row for an index. The scale list mounts `windowRange` only. Search and filters apply to the materialized sample, and the page says so. `FIXTURE_NOW` is a fixed instant. A tier older than that instant by more than `STALE_AFTER_MS` shows `STALE` and the as-of time. The page does not refresh it.

Event rows show no inventory facts. Seat rows show a section. GA rows say `no seat assigned`. Resale rows say `listing (synthetic)` and the locked `listResale` reason. A cancelled row says `cancelled (synthetic)` and has no purchase link. Counts render as `synthetic count N`. Tiers render as `synthetic tier T2`. The page prints `SYNTHETIC` and `data-source="synthetic-fixture"`.

The query lives in the URL. Back from a detail page keeps it. Empty results offer Clear filters. A filter conflict is a different state: GA plus a section, cancelled plus purchasable only, or a from date after the to date. On a conflict the query is not run. Each conflict has a one-click clear.

Purchasable only keeps `on-sale` rows. That is not a booking. The detail link `Open booking` renders only for an event row with a stub event id, status `on-sale`, and that id present on one `listPerformances` read. Seat and GA say that selection is `c-inventory-venue`. Resale stays not-bound. A not-bound catalogue read shows the locked `listPerformances` reason with source `none` and no link. There is no stub switch.

The result list and the scale list are `role="listbox"`. Arrow keys move inside the mounted window. Home and End jump. PageUp and PageDown move by a window. Enter opens the detail. The list container is the tab stop.

## Catalogue read

The page calls `loadBuyerCatalog` once per load and once more when the person presses Read again. That is the existing stub read. A message that starts `listPerformances is not-bound.` becomes the locked reason. The fixture does not wait on that read, and the read does not filter the fixture.

`placeHold` stays not-bound. This page does not call it and does not map it onto `prepare_trade`. The page posts nothing.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was `vite preview` at `http://127.0.0.1:5291` from the default production build. The HTTP desk was a second preview at `http://127.0.0.1:5292`. Vite inlines `VITE_KIX_PROTOCOL_MODE` and `VITE_KIX_PROTOCOL_API_BASE` at build time, so that preview was a separate build with mode `http` and base `http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception.

| State | Observed |
| --- | --- |
| Synthetic source | Banner: "SYNTHETIC fixture. Rows come from a synthetic-fixture. They are not a catalogue receipt." The banner had `data-source="synthetic-fixture"` and `data-provenance="synthetic"`. Result options had `data-source="synthetic-fixture"`. |
| Search, filter, sort, paging | Sort `title` and page size 10 put `sort=title&pageSize=10` in the URL and showed "page 1 of 36. matching 360." The first result title was Cancelled lantern reprint. Next page showed "page 2 of 36. matching 360." with `page=2` in the URL. |
| Empty results | Search `zzzz-not-a-row` showed "No matching synthetic rows." and a Clear filters button. Clearing filters from that button dropped `q` and returned "page 1 of 36. matching 360." |
| Filter conflict | GA plus section `A` showed "Filter conflict. The query was not run." and "A GA kind cannot take a section." with Clear conflict. |
| STALE | Search "Stale paper reprint" showed the badge `STALE`, "7 Oct 2026, 23:59 UTC", "on-sale (synthetic)", and "synthetic tier T1". |
| Cancelled row | The Cancelled lantern reprint detail said "cancelled (synthetic)" and had no Open booking link. |
| Open booking | The Lanterns synthetic show detail showed Open booking with href `/booking/evt_lanterns`. Sold out synthetic show had no Open booking link. Its purchase line was "No supported purchase path on this row." |
| Listbox keys | On Discovery results, the active option started at `discovery-result-syn-event-lanterns`. ArrowDown moved to `discovery-result-syn-event-paper`. End moved to `discovery-result-syn-bulk-9`. Home returned to `discovery-result-syn-event-lanterns`. Enter opened `/discovery/syn-event-lanterns`. |
| Back keeps the query | The cancelled detail URL kept `q=Cancelled+lantern+reprint&sort=title&pageSize=10`. Back to results kept that same query. |
| Scale window | The page said "synthetic scale 1000000". The scale list mounted 8 options (`scale-0` through `scale-7`). PageDown mounted `scale-2` through `scale-9`, still 8. The million rows were not in the document. |
| HTTP mode | Catalogue read was `data-catalog="not-bound"` and `data-source="none"`, with "The contract-only catalogue has no list or read command. listPerformances stays on the stub." The banner said the loopback gate was unavailable (`GATE_UNAVAILABLE`), the client does not retry, and it does not fall back to the stub. The Lanterns synthetic show detail had no Open booking link. Its purchase line was that same not-bound reason. |

The browser does not reach a live gate. The page posted nothing. `placeHold` was not called and was not mapped onto `prepare_trade`.

## Hold

`UNDETERMINED` until a product owner sets them: price, fee, and currency display. Tiers stay opaque labels. Real seat or GA selection belongs to `c-inventory-venue`. A live list read belongs to `c-discovery-live`. This page invents neither.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

## Tests

`apps/web/test/discovery-model.test.ts` covers the fixture, the query, the conflicts, and the scale window. `apps/web/test/discovery-page.test.tsx` covers the screen, the purchase link, and the source scan. The workspace registry test checks the `discovery-prototype` row.

Browser exercise is the `Browser run` section above. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
