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

## Hold

`UNDETERMINED` until a product owner sets them: price, fee, and currency display. Tiers stay opaque labels. Real seat or GA selection belongs to `c-inventory-venue`. A live list read belongs to `c-discovery-live`. This page invents neither.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

## Tests

`apps/web/test/discovery-model.test.ts` covers the fixture, the query, the conflicts, and the scale window. `apps/web/test/discovery-page.test.tsx` covers the screen, the purchase link, and the source scan. The workspace registry test checks the `discovery-prototype` row.

Browser exercise of the dev server is recorded with the delivery when a browser is available. A missing browser stays unverified. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.
