# Inventory venue stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped seat and GA selection page at `/inventory`. It is the synthetic reduction of pending node `c-inventory-venue`: the real producer read stays pending on `kix-protocol:ps-05-query-projections` and `kix-protocol:ps-06-admission-load`, and on the unpromoted `bind-reservation-fsm` and `bind-admission-fsm`. This node wires the read seam — summary, one bounded page, one selection detail, explicit refresh, hold expiry, generation, and queue admission — onto a deterministic synthetic inventory. It is not a producer connection and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. The branch base is `46cc69b60c2aed24ea8b5ae49317e80d8f4ad1c8`.

## The read port

`packages/protocol-adapter/src/inventory-read.ts` defines `InventoryReadPort` with `readSummary`, `readPage`, and `readSelection`. `inventoryReadPortFor(environment)` returns the stub port on `stub` and the not-bound port on `integration-http`. The not-bound reason is "The contract-only catalogue has no read command for an inventory, hold, or queue projection. The seat and GA selection read stays not-bound on integration-http." There is no stub fallback and no third adapter. The only inventory fields the pinned catalogue carries are the `seats` and `inventoryIds` of `create_event`; it has no inventory, hold, or queue read.

Every read checks the pin tuple first. The port reuses `checkDiscoveryReadTuple` and `DISCOVERY_READ_TUPLE_LITERALS` from the discovery read, so the two OpenAPI sha256s, `protocolMergeSha`, `protocolFeatureSha`, the contract info version and main sha, the source contract sha, the domain, and `PINNED_ACTIONS` are compared to the live pins. SDK, manifest, and vector digests stay null. A mismatch is `tuple-changed` before any row is built; the test counts row builds and expects zero.

## Summary, page, selection

The summary lists at most `INVENTORY_SECTION_BOUND` (12) sections, each with its own mode, a declared capacity label, a coarse band, a watermark, and the generation. It also carries the queue view. It never scans units, so it stays cheap for a hot event.

A page read carries the section, the mode the caller read in the summary, the generation the caller read, a page size of `1..25` (`INVENTORY_PAGE_BOUND`, refused and never clamped), a cursor, a free-only flag, and a watermark floor. A seat section is a lazy stream: the port builds only the bounded window. The test serves a section of 1,000,000 seats and counts 25 builds per page. The cursor is port-issued: version, projection, generation, tenant, section, filter key, `afterSequence`, and watermark. A cursor from another version is `cursor-invalid (VERSION)`, from another generation `GENERATION`, tenant `TENANT`, section `SECTION`, filter `FILTER`, and any other shape `SHAPE`. Delivered rows are checked for a contiguous sequence, a duplicate, an over-bound page, and a foreign tenant. A page with a hole is `gap`, and a foreign row is `tenant-mismatch`. The duplicate-ledger, reorder, and rebuild fault streams from `c-discovery-live-stub` are not repeated here.

A selection read carries one unit id and, for GA only, a whole quantity from 1 to `INVENTORY_QUANTITY_BOUND` (6). That bound mirrors the booking form input check. It is a request-shape bound, not a per-order sale policy and not an availability figure. The read also carries the label the page showed, so the port can report `changedSincePage`.

Refresh is explicit. The screen has Read summary again, Read page again, Read detail again, Next page, and the return buttons below. Nothing polls, nothing sets a timer, and nothing reads a clock. The port holds a fixed instant, `INVENTORY_AS_OF`, and uses no randomness.

## Modes

`seat`: each seat is its own unit with a stable id `sec-orch-s000003` and a label. `ga`: a section is one pool with one id `sec-pit-pool`, a declared capacity, and a band. A GA row has `seatLabel: null` and `assignment: "none"` and carries no sequence, no hold, and no seat. A GA selection is a quantity with `seatLabel: null`. `accessible`: unsupported. The accessible seating policy is `UNDETERMINED`, so the port neither offers, holds, nor hides those seats. The summary lists the section with its reason and no open link. A page or selection read on it is `unsupported`.

A read whose expected mode differs from the live mode is `mode-mismatch` and converts nothing. The same outcome covers a seat id on a GA section, a pool id or a quantity on a seat section, and a section that changed mode between the summary and the read. A GA selection with no quantity, or a quantity outside `1..6`, is `invalid-request (QUANTITY)`.

## Hold, generation, queue

An observed hold carries `expiresAt`, `expired`, `holdGeneration`, and `currentGeneration`. The port sets `expired` from the fixed instant, and the screen copies it through the shared deadline line. The screen does not compare a clock. An expired hold is not shown as free. A hold recorded under an earlier generation is not trusted and is not shown as free. Both read as `hold-stale` with the reason `expired` or `other-generation`, and the user action is Read again. A current hold is `unit-unavailable (held)`.

A read under another generation is `generation-changed` with the generation the caller held and the one served now. Nothing is carried over: the selection and the cursor are dropped, and the action is Back to summary. The Advance generation control serves the next synthetic generation and reads nothing, so the next read shows the refusal.

Queue admission means access to the selection pages. The queue view is `none`, `waiting`, `admitted`, or `lapsed`. While waiting or lapsed, page and selection reads are `queue-blocked`. When admitted, the pages open. The view carries `grantsReservation`, `grantsPayment`, `grantsRight`, and `grantsDoorEntry` as literal false, and `joinSupported` as literal false: no command to join or rejoin a queue is published, so the desk does not offer one. The screen says that queue admission is not a hold, a payment, an issued right, or entry at the door.

A free seat or a GA band is an observation. A selection is local to the screen: `selectedLocally: true`, `reservationConfirmed`, `ownershipConfirmed`, and `paymentConfirmed` literal false, and `economicWriterApproval: "none"`. The hold desk method stays not-bound with `consideredAction` `reserve_listing` (`INVENTORY_HOLD_NOT_BOUND` quotes the locked binding, and the screen prints its reason). `prepare_trade` is not mapped onto it. This page sends no command and links to no booking.

## Return actions

Every failure maps to exactly one action.

| Outcome | Action |
| --- | --- |
| `gap`, `tenant-mismatch`, `tuple-changed` | Start over |
| `stale`, `unknown`, `hold-stale`, `queue-blocked` | Read again |
| `cursor-invalid`, `invalid-request` | Back to first page |
| `invalid-request (SECTION)`, `generation-changed`, `mode-mismatch` | Back to summary |
| `unit-unavailable` | Back to page |
| `ready`, `empty`, `unsupported`, `not-bound` | none |

At the summary stage every action reads the summary again, except a changed tuple, which starts over. `unknown` stays apart from the rest: it says the outcome is not confirmed, and it never becomes a selection.

## Screen

`apps/web/src/inventory-venue.ts` holds the hook and the pure view builders. `apps/web/src/pages/InventoryPanels.tsx` renders them, and `apps/web/src/pages/Inventory.tsx` keeps the section, unit, and GA quantity in the URL query and sends focus back to the quantity field after a refused quantity. A seat page is a `role="listbox"` with arrow keys, Home, End, PageUp, PageDown, and Enter. Every state has a word, not only a style. Every row prints `data-source="synthetic-inventory"` and `SYNTHETIC`. The discovery detail for a seat or GA row now links to `/inventory` and still has no booking link. The page posts nothing and calls no `fetch`.

## Hold

The real read is still `c-inventory-venue`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Price and fee display stays `UNDETERMINED`; the page shows counts, never amounts.

## Browser run

Observed in headless Chrome 154.0.8037.97 on 2026-10-13, driven by a Playwright script kept outside the repo. The stub desk was `vite preview` at `http://127.0.0.1:5391` from the default production build. The HTTP desk was a second preview at `http://127.0.0.1:5392` from a separate build with mode `http` and base `http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception.

| State | Observed |
| --- | --- |
| Summary | "Summary ready." Six sections with badges SEAT, SEAT, GA, GA, ACCESSIBLE, SEAT. Five "Open section" links. The accessible block showed UNSUPPORTED and its reason, with no link. Queue card: "Queue: none in front of the selection pages." |
| Keyboard to a section | Tab reached the first "Open section" link on the 20th press (the shell links come first). Enter opened `/inventory?section=sec-orch`. |
| Seat page | 25 options. Meta: "scanned 25 of about 20000." Words FREE (observed), HELD (observed), TAKEN (observed). The held detail showed "expired false" from the adapter. |
| Listbox keys | Start `sec-orch-s000001`. ArrowDown twice moved to `s000003`. End moved to `s000025`. Home returned to `s000001`. PageDown moved to `s000011`. ArrowDown moved to `s000012`. Enter set `unit=sec-orch-s000012` and the detail read "Not free in the latest read (held)." |
| Next page, free only | Next page put `s000026` first. Free-observed only showed 18 rows, all FREE (observed), with "scanned 25 of about 20000." |
| GA page and selection | Standing pit showed no listbox and no option. Quantity 99 gave "Blocked read (QUANTITY)." with the typed 99 kept, `aria-invalid="true"`, and focus on the quantity field. Quantity 3 and Enter gave "Quantity 3. A count, not a price." and "No seat assigned." with "Selected on this screen only." |
| Empty and unsupported | Side stage (closed) showed "No seats in this section." The accessible block page showed "Unsupported mode." with the undetermined reason. |
| Mode mismatch | Deep link `sec-orch` with `sec-orch-pool` gave "Mode mismatch in sec-orch. This read expected ga and the section is seat now." Deep link `sec-pit` with `sec-pit-s000001` gave the reverse. Back to summary dropped the query. |
| Unknown section | `?section=sec-gone` gave "Blocked read (SECTION)." with Back to summary. |
| Hot page | In scenario hot, seat 3 read FREE (observed) on the page. Opening its detail gave "Not free in the latest read (taken). It changed since the page was read. Nothing was reserved for you." with `data-selected="false"`. Back to page re-read it as TAKEN (observed). |
| Selection mark | In scenario clean, opening seat 1 (free) marked that one row `aria-selected` with the Selected word. In scenario hot, the seat that sold between reads (seat 3) had no `aria-selected` row, no Selected word, and `data-selected="false"` on the detail. Opening a detail is not a selection; only a ready read selects. |
| Stale hold | Scenario stale-hold: seat 2 read HOLD EXPIRED (observed), "expired true". Its detail read "The observed hold is stale. It has expired." with `data-selected="false"`. Scenario old-generation-hold read "recorded under generation 0, not the current one." |
| Generation | Advance generation showed "served generation 2. last summary read generation 1." and the behind notice. Next page then gave "Inventory generation changed. You read generation 1 and the inventory now serves generation 2. Nothing was carried over." with 0 rows. Back to summary re-read generation 2 and cleared the notice. |
| Queue | Waiting: card "Queue: waiting. Position 1842 (synthetic)." and the page was `queue-blocked` with 0 rows. Admitted: "Admitted until … expired false." and 25 rows. Lapsed: "expired true" and the page was `queue-blocked`. Each card carried the not-a-hold, not-a-payment, not-an-issued-right, not-entry sentence. |
| Stale | Scenario stale: "Stale inventory watermark." with the watermark and floor, and one Read again button. |
| HTTP desk | `data-inventory-state="not-bound"` with the not-bound reason, 0 sections, and `data-adapter-environment="integration-http"`. A deep link with a unit rendered no row and no selection. The only requests outside the page's own assets were the shell's `GET /health` probes to port 8765, which fail with the documented CORS and connection errors. The page sent nothing else. |
| Requests | On the stub desk every request was a page `GET` of the app. No `POST`, no request to port 8765. |

The one console 404 was the browser's first favicon request on `/`. It did not appear on `/discovery` or `/inventory`.

Not observed in the browser: the in-progress state. The stub port answers within one microtask, so the Loading frame is not visible there. The SSR test covers the loading markup for the summary, page, and selection. A real browser pass against a producer stays unverified by design, since no live environment exists for this stub scope.

## Tests

`packages/protocol-adapter/test/inventory-read.test.ts` covers the tuple check before rows, the not-bound port, the summary, the request bounds, the lazy million-seat window, the cursor checks, the generation refusals, each mode mismatch, GA as a quantity, the hot page, the stale and earlier-generation holds, the queue states, the stream integrity checks, and a source scan. `apps/web/test/inventory-venue.test.tsx` covers the screen for each state, the hot page, the stale hold, the generation and mode refusals, the queue, the return-action mapping, the mounted route, and a source scan of the three new web modules. The workspace registry, contract fixture library, and handoff tests check the `inventory-venue-select` surface and its five fixture rows.
