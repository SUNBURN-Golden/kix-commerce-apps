# Discovery live stub apps bind

This bind is the stub-scoped projection read on `/discovery`. It is the synthetic reduction of pending node `c-discovery-live`: the real producer read stays pending on `kix-protocol:ps-05-query-projections`, `bind-list-read`, and `c-journey-identity`. This node wires the read seam — bounded request validation, cursor discipline, freshness, and per-failure user return actions — onto a deterministic synthetic stream. It is not a producer connection and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. The branch base is `0785310478d6f1c0384ff153f87368098cb71971`.

## The read port

`packages/protocol-adapter/src/discovery-read.ts` defines `DiscoveryReadPort`. `discoveryReadPortFor(environment)` returns the stub port on `stub` and the not-bound port on `integration-http`. The not-bound reason is "The contract-only catalogue has no read command. The discovery projection read stays not-bound on integration-http." There is no stub fallback and no third adapter.

Before the first row the port checks the pin tuple. `DISCOVERY_READ_TUPLE_LITERALS` copies the two OpenAPI sha256s, `protocolMergeSha`, `protocolFeatureSha`, the contract info version and main sha, the source contract sha, the domain, and `PINNED_ACTIONS`. SDK, manifest, and vector digests stay null. `assertDiscoveryReadTuple` compares the literals to the live pins and throws `DIFFERENT_TUPLE` on a mismatch. The port returns `tuple-changed` naming the field before any row is materialized, so a changed projection tuple is detected before the call serves rows.

## Request bounds

A read request carries a scope, a filter, a page size, a cursor, and a watermark floor. `validateRequest` refuses, as `invalid-request`, a `pageSize` outside `1..25` (`DISCOVERY_READ_PAGE_BOUND`), filter text over 64 characters, a kind or status outside the enums, an unparseable date bound, a `from` after `to`, a tenant other than `tenant-desk`, an empty or untrimmed subject, and a malformed `watermarkFloor`. The request is refused before the stream is touched. A `rowAt` lazy stream over 1,000,000 rows materializes only the bounded window — the test counts materialization calls.

The cursor is a port-issued record: version, projection name, projection revision, tenant, filter key, `afterSequence`, and watermark. A cursor from another revision is `cursor-invalid (REBUILT)`, from another tenant `TENANT`, from another filter `FILTER`, from another version `VERSION`, and any other malformed shape `SHAPE`. The user action for a cursor-invalid page is back to the first page.

## Post-delivery integrity

The port refuses a page, after delivery, when a row repeats (`gap` `DUPLICATE`), a sequence decreases (`gap` `ORDER`), a sequence jumps (`gap` `SEQUENCE`), a delivered page exceeds the bound (`gap` `OVER_BOUND`), or a row carries another tenant (`tenant-mismatch`). Refused rows are not booked into the seen ledger, so a resync restarts cleanly. A page watermark older than the stale floor — the stale bound or the caller's watermark floor, whichever is later — is `stale` with the watermark and the floor. `readRow` applies the same scope, tuple, and stale checks to one id.

## Fault streams

`DISCOVERY_STREAMS` is `clean`, `duplicate`, `reorder`, `gap`, `tenant-mix`, and `stale`. The stream selector on the page replays a fixed synthetic stream under each fault so the mapping is exercised without a producer. Rebuild projection swaps the served revision so the next page with the held cursor returns `cursor-invalid (REBUILT)`.

## Screen

`apps/web/src/discovery-live.ts` holds the hook and the pure view builders. `LiveReadSection` renders the banner, the controls, the status line, and one bounded `role="listbox"` page. `LiveReadDetail` renders a projection detail on `/discovery/:rowId` when the fixture has no row for the id. Every row prints `data-source="synthetic-projection"` and `SYNTHETIC`. Every failure maps to exactly one user action: `gap`, `tenant-mismatch`, and `tuple-changed` to Start over; `stale` and `unknown` to Read again; `cursor-invalid` and `invalid-request` to Back to first page. The boundary sentence is on screen: "A projection row confirms no sale, no ownership, and no payment. Trade commands re-check on their own path." The detail card adds "No purchase path runs from a projection row." The page posts nothing and calls no `fetch`.

## Hold

The real read is still `c-discovery-live`. This node's port consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them. Price and fee display stays `UNDETERMINED`.

## Tests

`packages/protocol-adapter/test/discovery-read.test.ts` covers the tuple check before rows, the request bounds, the bounded lazy stream over 1,000,000 rows, the cursor checks, each fault stream, the session ledger reset, the detail read, and the not-bound port. `apps/web/test/discovery-live.test.tsx` covers the ready page, each fault-to-action mapping, the million-row bound on screen, the detail states, and the copy boundary. `apps/web/test/discovery-page.test.tsx` scans the new module for the banned tokens. The workspace registry test checks the `discovery-live-read` surface.

No live environment exists for this stub scope, so a real browser pass against a producer stays unverified by design.
