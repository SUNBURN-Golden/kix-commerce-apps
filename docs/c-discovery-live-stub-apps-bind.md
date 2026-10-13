# Discovery live stub apps bind

This bind is the stub-scoped projection read on `/discovery`. It is the synthetic reduction of pending node `c-discovery-live`: the real producer read stays pending on `kix-protocol:ps-05-query-projections`, `bind-list-read`, and `c-journey-identity`. This node wires the read seam — bounded request validation, cursor discipline, freshness, and per-failure user return actions — onto a deterministic synthetic stream. It is not a producer connection and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. The branch base is `0785310478d6f1c0384ff153f87368098cb71971`.

## The read port

`packages/protocol-adapter/src/discovery-read.ts` defines `DiscoveryReadPort`. `discoveryReadPortFor(environment)` returns the stub port on `stub` and the not-bound port on `integration-http`. The not-bound reason is "The contract-only catalogue has no read command for a query projection. The discovery read stays on the synthetic stub." The port returns that reason and no row, so the words are a label and not a fallback. There is no stub fallback and no third adapter.

Before the first row the port checks the pin tuple. `DISCOVERY_READ_TUPLE_LITERALS` copies the two OpenAPI sha256s, `protocolMergeSha`, `protocolFeatureSha`, the contract info version and main sha, the source contract sha, the domain, and `PINNED_ACTIONS`. SDK, manifest, and vector digests stay null. `assertDiscoveryReadTuple` compares the literals to the live pins and throws `DIFFERENT_TUPLE` on a mismatch. The port returns `tuple-changed` naming the field before any row is materialized, so a changed projection tuple is detected before the call serves rows.

## Request bounds

A read request carries a scope, a filter, a page size, a cursor, and a watermark floor. `validateRequest` refuses, as `invalid-request`, a `pageSize` outside `1..25` (`DISCOVERY_READ_PAGE_BOUND`), filter text over 64 characters, a kind or status outside the enums, an unparseable date bound, a `from` after `to`, a tenant other than `tenant-desk`, an empty or untrimmed subject, and a malformed `watermarkFloor`. The request is refused before the stream is touched. A `rowAt` lazy stream over 1,000,000 rows materializes only the bounded window — the test counts materialization calls.

The cursor is a port-issued record: version, projection name, projection revision, tenant, filter key, `afterSequence`, and watermark. A cursor from another revision is `cursor-invalid (REBUILT)`, from another tenant `TENANT`, from another filter `FILTER`, from another version `VERSION`, and any other malformed shape `SHAPE`. The user action for a cursor-invalid page is back to the first page.

## Post-delivery integrity

The port refuses a page, after delivery, when a row repeats (`gap` `DUPLICATE`), a sequence decreases (`gap` `ORDER`), a sequence jumps (`gap` `SEQUENCE`), a delivered page exceeds the bound (`gap` `OVER_BOUND`), or a row carries another tenant (`tenant-mismatch`). Refused rows are not booked into the seen ledger, so a resync restarts cleanly. A page watermark older than the stale floor — the stale bound or the caller's watermark floor, whichever is later — is `stale` with the watermark and the floor. `readRow` applies the same scope, tuple, and stale checks to one id.

## Fault streams

`DISCOVERY_STREAMS` is `clean`, `duplicate`, `reorder`, `gap`, `tenant-mix`, and `stale`. The stream selector on the page replays a fixed synthetic stream under each fault so the mapping is exercised without a producer. Rebuild projection swaps the served revision so the next page with the held cursor returns `cursor-invalid (REBUILT)`.

## Screen

`apps/web/src/discovery-live.ts` holds the hook and the pure view builders. `LiveReadSection` renders the banner, the controls, the status line, and one bounded `role="listbox"` page. `LiveReadDetail` renders a projection detail on `/discovery/:rowId` when the fixture has no row for the id. Every row prints `data-source="synthetic-projection"` and `SYNTHETIC`. Every failure maps to exactly one user action: `gap`, `tenant-mismatch`, and `tuple-changed` to Start over; `stale` and `unknown` to Read again; `cursor-invalid` and `invalid-request` to Back to first page. The detail route has the one action Read again for every outcome that has an action, so a malformed id there reads the same refusal again. The boundary sentence is on screen: "A projection row confirms no sale, no ownership, and no payment. Trade commands re-check on their own path." The detail card adds "No purchase path runs from a projection row." The page posts nothing and calls no `fetch`.

## Hold

The real read is still `c-discovery-live`. This node's port consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them. Price and fee display stays `UNDETERMINED`.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-14 (KST), driven by a Playwright script kept outside the repo. The stub desk was the default production build and the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`; the script served both from `127.0.0.1` with its own static server. Nothing was listening on port 8765. There was no page exception on either desk. The only console error on the stub desk was Chrome's automatic `/favicon.ico` probe, and the HTTP desk added only the shell's failed probe to port 8765. PR #47 shipped without this pass; it was run afterwards on the merged tree.

| State | Observed |
| --- | --- |
| Normal | `/discovery`, `data-live-state="ready"`, "Projection page ready." 25 rows, sequence 1 to 25, each `data-source="synthetic-projection"` with SYNTHETIC. Meta: "stream clean. revision syn-1. watermark 13 Oct 2026, 00:00 UTC. scanned 25. about 96 rows in the stream." The source line and the boundary sentence were on screen |
| Next page | Next page was enabled. It read sequence 26 to 50, ready |
| Listbox keys | Focus on the list started at `pro-0001`. ArrowDown twice moved to `pro-0003`. End moved to `pro-0025`. Home returned to `pro-0001`. PageDown moved to `pro-0011`. Enter on `pro-0002` opened `/discovery/pro-0002` |
| Filter | Text `Lanterns` read 3 rows. Kind `right` read 7 rows. Text `zzzz-none` read ready with zero rows and no empty word, and Next page stayed on until the 4th page, where it went off (scanned 21). The `empty` state is returned only for a window that delivers no row at all, and this filter did not reach it |
| Duplicate stream | The first page read ready with 25 rows. Next page read `gap` `DUPLICATE` ("Row pro-0003 was delivered twice in this session.") with no rows. The action was Start over, and it read the first page ready again |
| Reorder stream | Next page read `gap` `ORDER` ("Expected sequence 35 and received 22 (pro-0022)."), no rows, action Start over, first page ready again |
| Gap stream | Next page read `gap` `SEQUENCE` ("Expected sequence 33 and received 34 (pro-0034)."), no rows, action Start over, first page ready again |
| Tenant mix | Next page read `tenant-mismatch` ("row pro-0040. tenant tenant-other."), no rows, action Start over, first page ready again |
| Stale stream | The first page read `stale`: "Stale projection watermark. watermark 11 Oct 2026, 00:00 UTC. floor 12 Oct 2026, 00:00 UTC." with no rows. Read again read the same stale answer, since the stream is stale by design. Choosing the clean stream read ready with 25 rows |
| Rebuild | Rebuild projection changed the revision to `syn-1+r1` and the page kept its rows. Next page then read `cursor-invalid` `REBUILT` ("Cursor names syn-1 and the stream serves syn-1+r1."), no rows, action Back to first page, and that read the first page ready on `syn-1+r1` |
| Detail | `/discovery/pro-0002` read `data-live-detail="ready"` with `data-source="synthetic-projection"`, SYNTHETIC PROJECTION, "This id lives in the projection space, not the fixture space.", the boundary sentence, and "No purchase path runs from a projection row." There was no link in the card. A deep link to the same id read the same row |
| Detail, unknown id | `/discovery/pro-9999` read `empty`: "No projection row for this id." with no action button. `/discovery/proj-gone` read `invalid-request`: "Blocked read (ROW_ID). A projection row id has the pro- shape." with the one action Read again, which read the same refusal |
| Keyboard | Tab reached "Rebuild projection" on the 71st press (the shell links and the earlier sections of the page come first) |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360, the same as the `/inventory` baseline) |
| HTTP desk | `data-live-state="not-bound"` with the not-bound reason, zero rows, `data-adapter-environment="integration-http"`. `/discovery/pro-0002` read `data-live-detail="not-bound"` with `data-source="none"` and the same reason. The only request outside the page assets was the shell's `GET /health` probe to port 8765, which failed |
| Requests | On the stub desk every request was a page `GET`. No `POST`, and no request to port 8765 |

Not observed in the browser: `tuple-changed` and the list's `invalid-request`, which the page's controls cannot produce (the server-rendered test and the adapter test cover them); the in-progress frame, since the stub port answers within a microtask; a screen reader pass; and a real producer. No live environment exists for this stub scope, so a pass against a producer stays unverified by design.

## Tests

`packages/protocol-adapter/test/discovery-read.test.ts` covers the tuple check before rows, the request bounds, the bounded lazy stream over 1,000,000 rows, the cursor checks, each fault stream, the session ledger reset, the detail read, and the not-bound port. `apps/web/test/discovery-live.test.tsx` covers the ready page, each fault-to-action mapping, the million-row bound on screen, the detail states, and the copy boundary. `apps/web/test/discovery-page.test.tsx` scans the new module for the banned tokens. The workspace registry test checks the `discovery-live-read` surface.
