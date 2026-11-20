Program node `kix-resale-journey-binding` — Resale journey end to end: bind resale market (#121) to pinned kix-protocol 8ba7f6c resale interfaces

No task issue exists for this node (the loop does not create issues).

Task: KIXC-KIX-RESALE-JOURNEY-BINDING

The resale fixture now requires a detached right to confirm transfer. Registration, hold, order, primary payment, issuance, adoption and listing return the pinned gate errors for the reviewed invalid transitions. Settlement remains a separate display fact. [Round-three evidence](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/agent/kixc-kix-resale-journey-binding/docs/kix-resale-journey-binding-apps-bind.md#review-round-three)

## NOT_BOUND list

| Screen need | Pinned query, if present | Missing interface or decision | User-visible reason | Decision owner |
| --- | --- | --- | --- | --- |
| Open listings | `list_open_listings` | Loopback list route, actor visibility, ordering, cursor and watermark | No read endpoint at the pinned gate. | KIX Protocol |
| Product search | — | Product identity, filter and paginated result shape | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Listing detail | `get_listing` | Authorized point lookup with listing identity and freshness | No read endpoint at the pinned gate. | KIX Protocol |
| Product detail | — | Product-to-listing association and detail schema | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Variant selector | — | Variant IDs and their relation to rights | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Bid and ask quotes | — | Versioned quote sides, amounts, availability and expiry | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Offers | — | Actor-scoped offer list, matching rules and pagination | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Trade history | — | Visible trade rows, units, timestamps and pagination | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Price series | — | Series definition, units and observation window | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Current holder and right version | `get_right` | Gate route and authority at a specified read watermark | No read endpoint at the pinned gate. | KIX Protocol |
| Presentation after transfer | `get_presentation` | Scoped presentation lookup | No read endpoint at the pinned gate. | KIX Protocol |
| Active settlement | `get_settlement` | Gate route and subject binding. The fixture transfer has a null settlement ID. | No read endpoint at the pinned gate. | KIX Protocol |
| Uncertain operation recovery | — | Authoritative lookup by operation/trace, subject and source cut | No read endpoint at the pinned gate. | KIX Protocol |

## Gate records
- Wave 6: https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343
- Wave 7: kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7
- Roadmap: kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md`

`packages/protocol-adapter/src/commerce-bindings.ts` is unchanged (placeHold not bound to reserve_listing; confirmBooking sends no capture;
settlement sends no settle_capture).


Built by the unattended KIX Commerce autoloop (box-local CLIs, no ASTRA): design lane codex:gpt-6.2-astra/xhigh (design lane); build codex:gpt-6.2-astra/xhigh (build lane).
Review: GLM-5.3 z.ai (effort xhigh) -> backup Claude CLI Sonnet 5.5 (effort high) (read-only, separate session). Build/fix: Sonnet 5.5 (effort medium); Fable escalation after 3 failed rounds. Merge: merged by the loop via this PR after review PASS + exact-head CI green (astra_auto_merge node, JunTae order 2026-10-08 13:32).

## Initial builder summary and evidence
Implemented the resale journey at `/resale/market`. The stub and pinned loopback gate both passed listing, purchase, transfer, and cancellation. The transfer receipt reports `TRANSFERRED` with settlement `UNBOUND`, and the UI keeps the settled fact at `NO_EVIDENCE`. Timeout and lost-response tests retained the last confirmed facts and sent no replacement write.

**Files changed**

49 files cover the adapter, market UI and bilingual copy, tests, bundle grouping, documentation, and 14 resale screenshots. The bind document includes the file inventory and verification commands. The NOT_BOUND list above records all 13 protocol change requests. [Binding and file inventory](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/agent/kixc-kix-resale-journey-binding/docs/kix-resale-journey-binding-apps-bind.md) · [NOT_BOUND list](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/agent/kixc-kix-resale-journey-binding/docs/kix-resale-journey-binding-change-requests.md)

| Command | Result |
|---|---|
| Narrow adapter and mounted web tests | 48 adapter tests and 98 web tests passed |
| `npm ci` | Passed. Installed 535 packages |
| `npm run typecheck`, `npm run typecheck:e2e`, `npm run build` | All passed |
| `KIX_REQUIRE_GATE=0 npm test` | 3,112 adapter, 1,726 web, and 6 entry-integrity tests passed. Stub mode skipped 50 gate-only tests |
| `KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` with `KIX_PROTOCOL_ROOT` at the pinned checkout | **3,162 passed, zero skipped** |
| `npm run test:e2e` and the integration-HTTP browser smoke check | 272 browser tests passed. The HTTP browser showed the refusal and disabled the write, with zero application requests |
| `npm run test:a11y -w @kix/e2e -- --fileParallelism --maxWorkers=2`, `npm run test:visual` | 451 accessibility tests and 123 visual tests passed, covering 108 screenshots |
| `npm run budget`, `npm run test:budget` | Both passed. Total gzip was 802,677 / 802,884 bytes. Landing JavaScript was 358,405 / 400,000 bytes |
| Lint, dependency, cycle, coverage, and production audit checks | All passed. Production audit reported zero findings |
| `git diff --check`, protected-path diff, pin and binding hash checks | Passed. Both OpenAPI pins and all 159 ledger entries matched the producer. The locked binding matched its required SHA-256 |

**Deviations and delivery status**

The verified producer merge is #448. PR #433 introduced the catalogue. Browser testing also required a router-state fix for fixture entry, a bundle grouping correction, and a more precise booking test selector.

On reviewed commit `1c5c721bb941c726be3d65d35485d517a6a06fed`, both required hosted checks reported `SUCCESS`. [Stub check](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44468300274/job/135371313688) · [Reviewed gate check](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44468300274/job/135371357922)

## Review round one

The stub checks adoption expiry against the issued reservation and listing amount against the registered show cap. The shared stub and gate tests accept 20,000, reject 20,001 with `RESALE_CAP`, and confirm that the refused listing ID is absent. Both receipt paths require the same new holder on the listing and right. Contradictory receipts leave acceptance `UNKNOWN` after one attempt. Reload quarantines impossible step or fact histories as `SESSION_EVIDENCE_LOST`.

| Working-tree check | Evidence |
| --- | --- |
| Stub suite | 3,117 adapter, 1,735 web and 6 entry-integrity tests passed. |
| Loopback gate at `8ba7f6c` | 3,172 adapter tests passed with zero skips. |
| Build and browser | Typechecks, lint, build and all 9 browser budget checks passed. Total gzip 802,861 / 802,884 bytes. Chrome verified purchase and both valid and inconsistent reload histories on the built stub. |

Both required hosted jobs reported `SUCCESS` on round-one commit `7d4a638491fa8ceeda10ad5b62f7d660e08e38da`. [Stub check](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44471263878/job/135381039252) · [Reviewed gate check](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44471263878/job/135381098078)

## Review round two

The fixture stub retains the confirmed order amount and quote, and checks adoption against the registered show. Invalid listing prices, deadlines and resale payment references are rejected before mutation. Acceptance requires the listing and right to agree on version 2. A contradiction leaves acceptance `UNKNOWN` after one attempt and preserves the listed and paid facts.

The shared suite checks the gate error and the state left after each refusal. On the local round-two tree, all 3,192 adapter tests passed against the reviewed loopback gate at `8ba7f6c`, with zero skips. Local Chrome completed purchase and cancellation with settlement at `NO_EVIDENCE`. [Binding and verification](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/agent/kixc-kix-resale-journey-binding/docs/kix-resale-journey-binding-apps-bind.md)

Both required jobs completed with `SUCCESS` on round-two commit `80a0eceb3c81c2f530ca1c2f56468b9d92c97684`. [Stub job](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44477697041/job/135402130564) · [Reviewed gate job](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44477697041/job/135402182104)

## Review round three

Both receipt paths now require the transferred right to carry a null listing ID; a contradiction leaves acceptance `UNKNOWN` after one attempt with the listed and paid facts intact. The stub returns the pinned gate errors for duplicate gate roles at registration, the reservation offer window, order price mismatch before order creation, primary payment reference format, reservation expiry at observation and issuance, adoption before issuance (`TICKET_NOT_ISSUED` ahead of the payment binding), and `RESALE_POLICY_REJECTED` when registration and adoption both disallow resale. Each refusal is probed with a separate command in stub and live-gate modes.

| Round-three working-tree check | Result |
| --- | --- |
| `KIX_REQUIRE_GATE=0 npm test` | 3,141 adapter, 1,735 web and 6 entry-integrity tests passed; 79 gate-only tests skipped by design. |
| `KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` at the reviewed checkout | 3,220 tests passed across 85 files, zero skips, including 49 live resale tests. |
| Typecheck, e2e typecheck, build, lint, cycle, dependency, audit and coverage checks | All passed. Total gzip 802,870 / 802,884 bytes; all 9 browser budget checks passed. |
| Browser journeys and accessibility | 272 journey tests and 451 accessibility tests passed on local Chrome. The a11y suite needed a longer local test timeout on this loaded box (no repo change); the hosted a11y job passed at `80a0ece` with the default timeout. |
| Visual baselines | Local Chrome 156 shows only the documented 156→157 forced-colors drift; Chrome for Testing 157.0.8103.50 compares 108 MATCH with 0 diff pixels. No baseline, tolerance or harness change. |

All 12 hosted jobs reported `SUCCESS` on round-two commit `80a0ece` ([run 44477697041](https://github.com/SUNBURN-Golden/kix-commerce-apps/actions/runs/44477697041)). The round-three tree is local and uncommitted; hosted verification follows publication. This replacement body carries the inline `NOT_BOUND list`; the body hosted at `80a0ece` still links builder-local paths and omits the inline section. Publishing the replacement is a supervisor/PR-owner action — this builder round is prohibited from posting. [Round-three evidence](https://github.com/SUNBURN-Golden/kix-commerce-apps/blob/agent/kixc-kix-resale-journey-binding/docs/kix-resale-journey-binding-apps-bind.md#review-round-three)
