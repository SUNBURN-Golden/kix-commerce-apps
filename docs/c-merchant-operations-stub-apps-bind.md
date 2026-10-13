# Merchant operations stub apps bind

This bind is the stub-scoped seller and organizer workroom at `/merchant`. It is the synthetic reduction of pending node `c-merchant-operations`: the real connection stays pending on `kix-protocol:fin-catalogue-read-model`, `kix-protocol:ps-05-query-projections`, and the unpromoted `c-finance-projection`. This node wires the merchant read seam — events, listings, trades, and settlement-obligation lines on named source cuts, with unpaid, held, and refund-burden burdens kept separate and a judged producer export — onto a deterministic synthetic source. It is not a producer connection and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `5cb117efd5d34af6ca1fd9c6380723f87643b687`. This delivery is the uncommitted diff on `agent/kixc-c-merchant-operations-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its one read and its one export call land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`MERCHANT_NOT_COMPOSED`), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`MERCHANT_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the export are `not-bound`: "The contract-only catalogue has no read command for an event, listing, trade, or settlement-obligation projection and no export command, and the finance read model and query projections are not merged in kix-protocol." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Event, listing, trade, and settlement-obligation read models are connected | `StubMerchantOperations` fixtures, the four lenses on a `MerchantSnapshot` | `packages/protocol-adapter/test/merchant-operations.test.ts`, `merchant-controller.test.ts` |
| Unpaid, held, and refund burdens and their source cuts are shown | `MerchantLineKind`, `MerchantLine.cutRef`, `MerchantAssessment.usedCuts`, the money-lines section | `apps/web/test/merchant-operations.test.tsx` |
| The export is tied to one coherent producer export | `judgeMerchantExport` against the last read | both adapter suites and the web suite |
| A sale is never shown as settled funds or as lending capacity | `MERCHANT_CLAIM_FIELDS` must all be `false` before a payload is accepted; the page prints the all-false line on every row | `merchant-operations.test.ts` (claims-settled), `merchant-operations.test.tsx` |
| The page computes no amount, so no client-side sum is the financial truth | amounts stay opaque whole-unit strings; the adapter refuses a malformed or wrong-unit amount and the page copies it verbatim | `merchant-operations.test.ts` (amount, unit), the web source scan |
| Figures on different source cuts are never merged into one confirmed balance | `MerchantAssessment.cutState`, a mixed read keeps each row on its own cut and withholds every single export | `merchant-operations.test.ts` (mixed-cut), `merchant-operations.test.tsx` |
| Stale aggregate, inconsistency, and permission denial are tested | `stale-aggregate`, `aggregate-mismatch`, `cut-mismatch`, `scope-denied`, `export-denied` scenarios and fixture rows | all three suites |

The spec asks for a producer read model and a producer export. No finance read model or projection catalogue exists in this repository (`c-merchant-operations` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/merchant-operations.ts`. State lives in the object, so a new port is a new session. It serves one merchant scope, `mrc-0001`, to one actor, `merchant-desk`; `mrc-0002` is a foreign merchant the desk actor holds no grant for. The actor string is a context label, not an authentication result, and the source decides scope.

A read returns a snapshot: events, listings, trades, money lines, the source's own per-kind-per-cut figures, the cuts used, the pin tuple, and a watermark. Every money line names its kind (`sales-observed`, `unpaid`, `held`, `refund-burden`), its state (`observed`, `pending`, `exception`, `unknown`), its trade, its source cut, and three claims that are always `false`: `settled`, `fundsAvailable`, `lendable`. Validation happens before a row is returned: a malformed reference, a non-whole-unit or wrong-unit amount, an unknown kind or state, a row from another merchant, a line on an unknown cut, or any affirmative claim refuses the whole payload. Amounts are opaque strings in `mock-unit`; nothing parses, sums, scales, or compares them.

The assessment reports which cuts the read used (`cut-merchant-1` on the merchant ledger, `cut-hold-1` on the hold register), whether they form one cut or several, whether the source's figures match the generation and the line count of the cut they name (`current`, `stale`, or `mismatch`), and which rows name a link the read does not list. A cut is a source position, not a balance; rows on different cuts are shown side by side and never added together.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read and export. |
| `empty` | Has no rows for this merchant. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `stale-aggregate` | The source figures were built at an older generation than the cut they name. The assessment is `stale`. |
| `aggregate-mismatch` | One source figure counts lines the read does not list. The assessment is `mismatch`. |
| `mixed-cut` | The lines span `cut-merchant-1` and `cut-hold-1`, so no single export is current. |
| `dangling-link` | One line names a trade the read does not list. The assessment names it and the page attaches it nowhere. |
| `exceptions` | Lines carry `exception` and `unknown` states as the source names them. |
| `claims-settled` | Sends a line that claims `settled: true`. The whole payload is refused as `MERCHANT_CLAIM`. |
| `scope-leak` | Sends a row that belongs to `mrc-0002`. The whole payload is refused as `SCOPE_LEAK`. |
| `denied` | The grant is withdrawn at the source. The read is `denied` (`GRANT_REVOKED`). |
| `read-lost` | The answer to a read never arrives. The read is `unavailable`. |
| `export-partial` | The export is cut off before it lists every row. |
| `export-stale` | The export was taken at an older generation than the cut the read saw. |
| `export-lines-differ` | The export rows differ from the lines the read lists. |
| `export-denied` | The source grants the read and no export (`EXPORT_DENIED`). |

`advanceCut` moves the source to its next cut generation, so an export taken before it becomes stale against a new read. `revokeGrant` withdraws the synthetic grant. Both are synthetic controls a real producer does not offer.

## The export

`judgeMerchantExport` compares the export against the last read and nothing else. It withholds the export with every reason that applies: no read to judge against (`NO_SNAPSHOT`), a read that spans cuts (`SNAPSHOT_MIXED`), another scope (`SCOPE`), a cut the read does not list (`UNKNOWN_CUT`), export rows on more than one cut (`MIXED_CUT`), an export taken before the cut the read saw (`STALE_CUT`), an export newer than the read (`AHEAD_CUT`), a producer-declared partial (`PARTIAL`), a row count that differs from the declared count (`COUNT`), and rows that differ from the read's lines for that cut (`LINES_DIFFER`). Only a `current` verdict is shown as the current export. The verdict is recomputed on every state read, so an export that was current turns withheld the moment the read moves on. The controller sends no export before a ready read (`NOT_SENT`) and sends it once per request.

## The controller

`packages/protocol-adapter/src/merchant-controller.ts`. The context key is the mode, the domain, the actor string, the tenant, the merchant scope, and a session incarnation.

| Event | What the controller does |
| --- | --- |
| A read or an export that arrives for an older context | Dropped. It never touches the current view. |
| A read or an export older than a newer applied one | Dropped. |
| A read that stops being ready (stale, denied, refused, tuple-changed, unavailable) | Rows, the assessment, and the export are cleared. Nothing stale stays on screen. |
| `switchScope` | A new context at the next incarnation. Rows and the export of the earlier merchant are cleared, and an answer in flight for it is dropped when it lands. |
| `loadExport` with no ready read | `NOT_SENT` (`no-snapshot`). The port is never called. |
| `loadExport` on a not-bound port | `NOT_SENT` (`not-bound`) with the reason. The port is never called. |
| A thrown or cut-off answer | `unavailable`. It is not sent again. |

The controller sends a `watermarkFloor` equal to the last watermark it saw, so a second read asks for newer than what it has. There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload: reads and exports live in this page load only, and a reload resolves nothing at a producer.

## Screen

`apps/web/src/merchant-operations.ts` holds the hook and the pure view builders. `apps/web/src/pages/MerchantPanels.tsx` renders them, and `apps/web/src/pages/Merchant.tsx` composes the page. Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A denial, a refusal, or a stale verdict moves focus to the status region. Every state has a word, not only a style, and wide tables scroll inside their own labelled region. Every row prints `data-source="synthetic-merchant"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens and reads again only when the person asks. Nothing polls and nothing sets a timer. The export control stays off until a read is ready and stays off with the not-bound reason on `integration-http`. The synthetic controls (scenario, switch merchant scope, revoke grant, advance source cut, start a new synthetic session) stand in for events a real producer would cause, and a real producer offers none of them. Revoking the grant turns the next read into a scope denial; advancing the cut turns a loaded export withheld on the next read.

## Contract fixture rows

The screen is registered as `merchant-operations` in `contract-fixtures.ts` with eight synthetic rows: `stale-read` and `stale-aggregate` as `STALE`, `cut-mismatch`, `scope-denied`, `export-denied`, `claim-refused`, and `export-withheld` as `REJECT` with their codes, and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-merchant-operations`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Price, fee, compensation, and lending policy stay `UNDETERMINED`.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-16, driven by a Playwright script kept outside the repo. The stub desk was the default production build and the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`; both were served from `127.0.0.1` and nothing was listening on port 8765. There was no page exception on either desk. The stub desk logged no console error beyond Chrome's automatic `/favicon.ico` probe, and the HTTP desk logged only the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-merchant-state="ready"`. Two events, three listings, three trades, and seven money lines — `sales-observed`, `unpaid`, `held`, and `refund-burden` — each on `cut-merchant-1` with `settled false · fundsAvailable false · lendable false` on every row. "Every row is on one source cut." and `data-aggregate-state="current"` |
| Export | "Load the export" was `data-enabled="true"` only after the ready read; before it, it showed its reason. Enter loaded the export: `data-verdict="current"`, seven export rows, "Current export for the last read." |
| Empty | `empty` scenario: "No rows for this merchant in this read." with no obligation rows |
| Stale | `stale` scenario: "Stale merchant read." with no obligation rows |
| Scope denied | Switch merchant scope to `mrc-0002`, Read again: `denied` with `(SCOPE_DENIED)` and no rows |
| Revoked grant | Revoke grant, Read again: `denied` with `(GRANT_REVOKED)` |
| Claim refused | `claims-settled` scenario: `refused` with `(CLAIM)` and no rows |
| Mixed cut | `mixed-cut` scenario: `data-cut-state="mixed"`, "Rows are on more than one source cut," no merged figure, and the loaded export was withheld with `SNAPSHOT_MIXED` |
| Stale aggregate | `stale-aggregate` scenario: `data-aggregate-state="stale"` with `STALE_GENERATION` flagged on the figure |
| Read lost | `read-lost` scenario: `unavailable`, "The source did not answer. This is not an empty ledger." |
| In progress | Not separately observable: the stub port answers within a microtask, so the loading frame was not caught. The server-rendered test covers the loading markup |
| Keyboard | Tab reached "Load the export" on the 34th press (shell links and the controls come first). The `aria-disabled` export control stayed in the tab order and named its reason. Enter on the enabled control loaded the export |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360); the tables scroll inside their own labelled regions |
| HTTP desk | `data-merchant-state="not-bound"` with the not-bound reason, `data-enabled="false"` on the export control, zero rows, `data-adapter-environment="integration-http"`. The only request outside the page assets was the shell's `GET /health` probe to port 8765 |
| Requests | On the stub desk every request was a page `GET`. No `POST`, and no request to port 8765 |

Not observed in the browser: a screen reader pass, and a real producer, which stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/merchant-operations.test.ts` covers every read and export outcome, the claim, reference, amount, unit, kind, state, scope, and cut validation, the aggregate and link assessment, the export judge's ten reasons, the not-bound port, and a source scan. `packages/protocol-adapter/test/merchant-controller.test.ts` covers the context key, dropped reads and exports, scope switching, the not-sent and not-bound export refusals, a re-judged export after the source moves, and the staged refusal phases. `apps/web/test/merchant-operations.test.tsx` covers the screen for each state, the four money-line kinds on their cuts, the flagged figures, the current and withheld export, the registry surface, the handoff pending row, the eight fixture rows, the mounted route, and a source scan of the three new web modules.
