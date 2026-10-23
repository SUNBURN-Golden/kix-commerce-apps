# Finance operations stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped finance desk at `/finance`. It is the synthetic reduction of pending node `c-finance-operations`: the real connection stays pending on `kix-protocol:fin-catalogue-read-model`, `kix-protocol:cr-08-producer-sdk`, and the unpromoted `refund-surface`. This node wires the finance review seam — a reconciliation and exception queue whose cases are linked to their original trade, with unmatched lines, duplicate observations, late facts, several payees, residual allocations, and balance mismatches kept as their own kinds, plus the source's own totals and balances and a judged accounting export — onto a deterministic synthetic source. It is not a producer connection and does not claim one. A reviewed case is not a corrected ledger, a proposal is not an applied correction, and an approval is not a change of economic state.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `5cfa17f7bf997b04d30fd80048170200b8096e80`. This delivery is the uncommitted diff on `agent/kixc-c-finance-operations-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its read, its one export call, and its two request kinds — propose-correction and approve-proposal — land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`FINANCE_NOT_COMPOSED` reuses the platform record), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`FINANCE_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read, the export, and the requests are `not-bound`: "No current producer tuple exists for finance operations: kix-protocol:fin-catalogue-read-model and kix-protocol:cr-08-producer-sdk are not merged, and the refund surface is not promoted. The contract-only catalogue has no read command for a reconciliation case, a source cut, a payee allocation, an unapplied remainder, or an accounting export, and no command that corrects a ledger. The finance desk stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Unmatched, duplicate observation, late fact, several payees, and residual allocation are explained | `FinanceCategory`, `explainCase`, the facts, allocations, and remainder rows of a `FinanceSnapshot` | `packages/protocol-adapter/test/finance-operations.test.ts`, `apps/web/test/finance-operations.test.tsx` |
| A mismatch is linked to its original trade | `FinanceCase.tradeRef`, `FinanceSnapshot.originals`, `FinanceUnlinked`, the sibling-source link test | both adapter suites and the web suite |
| A current query and a consistent export are connected | the read's watermark floor and cut set, `judgeFinanceExport` against the last read | `finance-operations.test.ts`, `finance-controller.test.ts`, `finance-operations.test.tsx` |
| A correction proposal and the authority to change economic state are separate | `financeAuthorityTable`, `FINANCE_CAPABILITIES`, the `NO_CAPABILITY` and `SELF_APPROVAL` rejections, the authority section | all three suites |
| A user confirmation never forces the ledger to match | `FINANCE_ACTION_KINDS` is `propose-correction` and `approve-proposal` only; `FINANCE_NON_CLAIM_FIELDS` must all be `false`; a source scan; a button-label check | `finance-operations.test.ts`, `finance-operations.test.tsx` |
| The export says it is synthetic and what it is not | `FinanceExportScope`, `refuseFinanceExport`, the export section's scope line | `finance-operations.test.ts` (export-claims-real), `finance-operations.test.tsx` |
| Totals, remainders, and allocations are the producer's own text | amounts stay opaque whole-unit strings or `null` (printed `UNDETERMINED`); the adapter refuses a malformed or wrong-unit amount; the web test feeds figures the page would never compute and checks they are copied | `finance-operations.test.ts` (amount, unit), `finance-operations.test.tsx` (verbatim), the web source scan |
| Figures on different source cuts are never merged | `FinanceAssessment.cutAlignment`, `skew`, the timing-uncertain flag, `SOURCES_SKEWED` | `finance-operations.test.ts` (source-cut-skew), `finance-operations.test.tsx` |
| Balance mismatch, stale total, and permission denial are tested | `balance-mismatch`, `stale-totals`, `totals-mismatch`, `denied`, `export-denied`, `self-approval` scenarios and fixture rows | all three suites |
| No current producer tuple means `NOT_BOUND` | `createNotBoundFinanceOperations`, the integration-http screen state | `finance-operations.test.ts`, `finance-operations.test.tsx` |

The spec asks for a producer read model and a producer export. No finance read model or projection catalogue exists in this repository (`c-finance-operations` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/finance-operations.ts`. State lives in the object, so a new port is a new session. It serves one book, `bok-0001`, to three actors: `finance-reviewer` (read, export, propose), `finance-approver` (read, export, approve), and `finance-viewer` (read only). `bok-0002` is a foreign book the finance actors hold no grant for. An actor string is a context label, not an authentication result, and the source decides scope and capability.

A read returns a snapshot: the source cuts, the original trades the cases link to, the reconciliation cases, the facts, the payee allocations, the source's own totals and balances, the correction proposals, six non-claim fields, and a watermark. Four sources keep four cuts: `cut-0001` on the order ledger, `cut-0002` on the payment observations, `cut-0003` on the settlement ledger, and `cut-0004` on the servicing ledger. A case sits on the cut of its expected side and names the cut its observed side was looked up on. Validation happens before a row is returned: a malformed reference, a non-whole-unit or wrong-unit amount, an unknown category, state, verdict, kind, or role, a row from another book, a row on a cut the snapshot does not list, or any non-claim field that is not the literal `false` refuses the whole payload. Amounts are opaque strings in `mock-unit`; nothing parses, sums, scales, or orders them. The only comparison is text equality: an export row against the read's row, and a verdict against the source's own difference text.

The six non-claims are `confirmationForcesMatch`, `proposalChangesEconomicState`, `approvalChangesEconomicState`, `payoutExecuted`, `postedToAccountingSystem`, and `exportIsBookOfRecord`.

The clean queue holds seven cases, one per category and a second unmatched case for a refund burden:

| Case | Category | Original trade and line | What the source says |
| --- | --- | --- | --- |
| `rcs-0001` | `UNMATCHED` | `trd-0002`, `obl-0006` held | expected 1100, no observation, difference 1100 |
| `rcs-0002` | `DUPLICATE_OBSERVATION` | `trd-0001`, `obl-0001` sales | the same payment observed twice, observed 2400, difference 1200 |
| `rcs-0003` | `LATE_FACT` | `trd-0003`, `obl-0005` unpaid | a fact reached the source after the cut; state `unknown`, no difference |
| `rcs-0004` | `MULTI_PAYEE` | `trd-0001`, `obl-0004` unpaid | seller 700, venue 300, platform 100; no difference stated |
| `rcs-0005` | `RESIDUAL` | `trd-0003`, `obl-0003` sales, servicing payment `pmt-0001` | seller 400, lender 400, unapplied remainder 100 |
| `rcs-0006` | `BALANCE_MISMATCH` | `trd-0002`, `obl-0002` sales | the order ledger says 1200, the settlement ledger says 1150, difference 50 |
| `rcs-0007` | `UNMATCHED` | `trd-0003`, `obl-0007` refund burden | a refund is not a payment observation; no refund command is composed |

The trades, money lines, and payment are the merchant workroom's and the credit servicing desk's own synthetic rows. A test reads both sibling sources and checks every link against them, including that the lender share equals the servicing payment's amount as text.

The assessment reports whether the cuts the rows name share one watermark (`aligned`) or not (`skewed`), whether each total matches the generation and the case count of its cut (`current`, `stale`, or `mismatch`), which rows name a trade or a case the read does not list, which cases and balances have their two sides on cuts at different positions, which verdicts the source's own difference text contradicts, and which facts reached the source after their cut. A flag is shown, never resolved.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read, export, and request. Seven cases, aligned cuts, current totals. |
| `empty` | Has no cases for this book. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `stale-totals` | The totals were built at an older generation than the cut they name. The assessment is `stale`. |
| `totals-mismatch` | One total counts cases the read does not list. The assessment is `mismatch`. |
| `balance-mismatch` | One balance is stated matched while the source's own difference text is not zero. The balance is flagged and not shown as reconciled. |
| `source-cut-skew` | The payment-observation cut is at an earlier position. Cases and balances across it are flagged timing-uncertain, only a request to look again is offered on them, and no single export is consistent. |
| `dangling-link` | One case names a trade the read does not list. The assessment names it and the page attaches it nowhere. |
| `proposal-pending` | A proposal from the reviewer waits for the approver. |
| `self-approval` | A proposal from the approver waits. The source rejects the approver approving it (`SELF_APPROVAL`). |
| `claims-forced` | The payload claims a confirmation forced a match. The whole payload is refused (`CLAIM`). |
| `scope-leak` | Sends a row that belongs to `bok-0002`. The whole payload is refused (`SCOPE_LEAK`). |
| `denied` | The grant is withdrawn at the source. The read is `denied` (`GRANT_REVOKED`). |
| `read-lost` | The answer to a read never arrives. The read is `unavailable`. |
| `export-partial` | The export is cut off before it lists every row. |
| `export-stale` | The export was taken at an older cut set than the read saw. |
| `export-rows-differ` | The export rows differ from the rows the read yields. |
| `export-denied` | The source grants the read and no export (`EXPORT_DENIED`). |
| `export-claims-real` | The export declares real money. The payload is refused (`CLAIM`). |
| `act-lost` | A request reaches the source and is recorded. Its answer never arrives. |
| `approve-claims-applied` | The source records an approval, then answers that economic state changed. The answer is not trusted. |

`advance-cut` moves the source to its next cut generation, so an export taken before it becomes stale against a new read. `revoke-grant` withdraws the synthetic grant. `post-source-correction` is the source posting a later cut in which it resolves its next case: the case becomes `resolved-by-source`, the cut generation moves, a category total the stub cannot restate is stated as none and printed `UNDETERMINED`, and a proposal still pending on that case is closed by the source as `rejected` (an approval already recorded stays what it was, and nothing is left to approve). All three are synthetic controls a real producer does not offer, none of them is an approval, and the page labels each one "Simulate:" so none reads as a person posting to the ledger.

## A correction proposal is not a change of economic state

The reviewer and the approver can record, and no actor on this desk holds the authority to change economic state. `financeAuthorityTable` lists five authorities: read, export, propose a correction, approve a proposal, and change economic state. Four are held by the reviewer, the approver, or both, and none of the four changes economic state. The fifth is held by nobody, and the page says so in a table row. The ledger moves only when the source posts a later cut.

There is no confirm, force-match, mark-reconciled, or apply request. `FINANCE_ACTION_KINDS` is `propose-correction` and `approve-proposal`, the port answers any other kind of request (nine force, confirm, apply, post, and pay names are tested) as an invalid action and leaves the ledger alone, and the web tests check that no button on the page, for any actor and scenario, is named for a confirmation, a forced match, an application, a payment, or a settlement.

A proposal names a case and one correction the source offers on it: link an observation, mark a duplicate observation, accept a late fact, reassign a payee, allocate a remainder, or ask the source to look again. The source records it as `pending` with the note and the proposing actor. An approval by a different actor is recorded as `approval-recorded`. Neither record changes a case, a figure, a total, a balance, or a cut, and a test compares the ledger part of the snapshot before and after both. Both receipts state `economicStateChanged` and `confirmationForcesMatch` as `false`; an answer that says otherwise is refused as untrusted, and the request is then unknown and fences the session. A case whose two sides are on cuts at different positions, whose verdict the source's own text contradicts, or whose trade the read does not list offers only "ask the source to look again", because it is not a mismatch to correct until the sources agree on a position.

## The export

`judgeFinanceExport` compares the export against the last read and nothing else. The export carries the cut set it was taken at and a scope declaration: provenance `synthetic`, `realMoney` false, `postedToAccountingSystem` false, `bookOfRecord` false, and target `none`. A payload that declares anything else is refused before a row is returned, and the page prints the declaration beside every loaded export together with "This file is not an accounting record."

The export is withheld with every reason that applies: no read to judge against (`NO_SNAPSHOT`), a read whose sources sit at different positions (`SOURCES_SKEWED`), another scope (`SCOPE`), a cut the read does not list, one named for another source, or one with no readable generation and watermark (`UNKNOWN_CUT`), a cut the read lists that the export omits (`CUT_MISSING`), a cut set older than the read's (`STALE_CUT`) or newer (`AHEAD_CUT`; a cut that is older in one position and newer in the other is both), a row on a cut the export does not name (`ROW_OFF_CUT`), a producer-declared partial (`PARTIAL`), a row count that differs from the declared count (`COUNT`), and rows that differ from the rows the read yields (`ROWS_DIFFER`). Only a `current` verdict is shown as the current export. The verdict is recomputed on every state read, so an export that was current turns withheld the moment the read moves on. The controller sends no export before a ready read, and none for an actor without the export capability (`NOT_SENT`), and sends it once per request.

## The controller

`packages/protocol-adapter/src/finance-controller.ts`. The context key is the mode, the domain, the actor string, the tenant, the book scope, and a session incarnation.

| Event | What the controller does |
| --- | --- |
| A read or an export that arrives for an older context | Dropped. It never touches the current view. |
| A read or an export older than a newer applied one | Dropped. |
| A read that stops being ready (stale, denied, refused, tuple-changed, unavailable) | Rows, the assessment, and the export are cleared. Nothing stale stays on screen. |
| `switchScope`, `switchActor` | A new context at the next incarnation. Rows and the export of the earlier context are cleared, and an answer in flight for it is dropped. Refused while a request is in flight. |
| A request the read cannot support | `NOT_SENT` with the reason (`no-snapshot`, `stale-read`, `blocked`, `no-capability`, `unknown-ref`, `bad-note`). The port is never called. |
| A recorded or rejected request | The view is marked behind. The cases on screen stay the last read's until the next read. |
| A request whose answer never arrived or arrived untrusted | `UNKNOWN`. It may have been recorded, every later request in that context is fenced, and a read does not lift the fence. Switching the scope or the actor begins a new context, and the earlier unknown is counted, not forgotten. |
| An export that lands after the read stopped being ready | Dropped (`read-not-ready`). It has nothing to be judged against, and the view holds no row. |
| A read that began before a request came back | Applied, but the view stays behind, because that read may not show the request. Only a read that began after it clears the mark. |
| A thrown or cut-off read or export | `unavailable`. It is not sent again. |

There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload: reads, exports, and requests live in this page load only, and a reload resolves nothing at a producer.

## Screen

`apps/web/src/finance-operations.ts` holds the hook and the pure view builders. `apps/web/src/pages/FinancePanels.tsx` renders them, and `apps/web/src/pages/Finance.tsx` composes the page. The sections are controls, status, who may do what, source cuts, the exception queue, source figures, the accounting export, requests, and the session record. A case card holds the category word, the state word, the source's verdict word, a plain-language explanation built from the source's own fields, the link to the original trade (with a link to the merchant workroom, and to the credit servicing desk when a servicing payment is named), the expected, observed, and difference text, the cuts of both sides, the facts, the payee allocations with the unapplied remainder, the proposals, and its proposal controls.

Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. When many controls share one reason, the page prints it once and each control points at it. A note that needs attention, a read the source refused, denied, found stale, or did not answer, and an export it refused or denied move focus to the status region (the model's `focusToken` changes, and a second refusal changes it again); a read that is not bound takes no focus, because it is the state of the page on load. Every state has a word, not only a style, and wide tables scroll inside their own labelled regions. The scenario and the desk actor are choices that apply only on their own button, so moving through the list with the arrow keys resets nothing. The banner and every case card print `data-source="synthetic-finance"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens, one read after the person switches the book scope or the desk actor, and again only when the person asks. Nothing polls and nothing sets a timer. The propose and approve controls name only what the last read lists, and the source decides again at send time: a second pending proposal of the same correction on a case (`DUPLICATE_PENDING`) and an approval of one's own proposal (`SELF_APPROVAL`) are rejected there, shown as a rejection, and do not fence the session. The scenario, desk actor, book scope, and new synthetic session controls and the three "Simulate:" controls stand in for events a real producer would cause, and a real producer offers none of them.

## Contract fixture rows

The screen is registered as `finance-operations` in `contract-fixtures.ts` with eleven synthetic rows: `stale-read` and `stale-totals` as `STALE`; `balance-mismatch` and `source-cut-skew` as `UNKNOWN`, because neither side can be called matched or mismatched; `scope-denied`, `export-denied`, `self-approval`, and `claim-refused` as `REJECT` with their codes; `export-withheld` as `REJECT`; and `write-lost` and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-finance-operations`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, and no refund. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Every figure stays the source's own text or `UNDETERMINED`. Which payee is owed what, how a remainder is allocated, and which accounting target an export may reach are product and accounting policy, and they stay `UNDETERMINED`.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-14 (KST), driven by a Playwright script kept outside the repo. The stub desk was the default production build and the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`; the script served both from `127.0.0.1` with its own static server. Nothing was listening on port 8765. This table is from the last full run, after fixes that the earlier runs and an independent read of the diff led to; it describes the tree in this diff. There was no page exception and no console message on the stub desk. The HTTP desk added only the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-finance-state="ready"`, "Finance read." Seven cases (`UNMATCHED`, `DUPLICATE_OBSERVATION`, `LATE_FACT`, `MULTI_PAYEE`, `RESIDUAL`, `BALANCE_MISMATCH`, `UNMATCHED`), "Queue as the source states it: 6 open, 1 unknown, 0 resolved by the source.", `data-cut-alignment="aligned"`, `data-totals-state="current"`, and the banner and seven case cards each carrying `data-source="synthetic-finance"`. Each case shows its original trade with a link to `/merchant`, and the residual case also links to `/credit/servicing` |
| Who may do what | Five rows. Only `change-economic-state` has `data-changes-economic-state="true"`, "Held by no actor on this desk.", and "Yes, and nobody here holds it." The other four read "No." The actor on screen is marked on the rows it holds |
| Late fact and remainder | `fct-0005` marked "After the cut" and "It is its own fact and is not folded into the cut it missed." `fal-0006` listed as an "Unapplied remainder" with no payee and `100 mock-unit`. Unstated figures printed `UNDETERMINED` |
| No force control | 22 buttons for the reviewer: scenario and actor apply buttons, Read again, Load the export, Switch book scope, three "Simulate:" controls, Start a new synthetic session, and 13 "Propose:" controls. None is named for a confirmation, a forced match, an application, or a payment |
| Keyboard | Tab reached "Load the export" on the 34th press from the start of the page. Enter loaded the export: `data-verdict="current"`, 13 rows, and "SYNTHETIC export. provenance synthetic · realMoney false · postedToAccountingSystem false · bookOfRecord false · target none. This file is not an accounting record." with four cut lines. After "Simulate: the source moves to its next cut" and Read again, the loaded export turned withheld with `STALE_CUT` |
| Proposal | Focus on "Propose: Link an observation", Enter: "Correction proposal recorded at the synthetic source. Nothing was applied: no economic state changed and no ledger was made to match." The record named `prp-0001` with `economicStateChanged false · confirmationForcesMatch false`, the page showed a "Behind." line, and no proposal was on screen until Read again. After it, `prp-0001` was pending on `rcs-0001`, which was still Open with Difference 1100 mock-unit |
| Approval | Approver on a pending proposal, Enter on "Record an approval of prp-0001": recorded. After Read again the proposal read "Approval recorded, nothing changed", and `rcs-0001` still had `data-state="open"` and Difference 1100 mock-unit |
| Blocked | Viewer: Tab from the actor field reached "Load the export" on the 3rd press, with `aria-disabled="true"`, `data-enabled="false"`, and `aria-describedby="finance-export-reason"`. Enter left the export phase at none. The propose and approve reasons were each printed once, and every control pointed at them |
| Focus | "Simulate: withdraw the grant" moved focus to `finance-status`. So did the read states `stale`, `denied`, `refused` (both kinds), and `unavailable`. A ready or empty read moved no focus |
| Scenario picker | Four ArrowDown presses changed only the picker. The banner scenario, the session line, and the seven cases were unchanged. Tab reached "Start a session with this scenario", and Enter started the session with the chosen scenario |
| Empty, stale, lost | `empty`: "No reconciliation cases for this book in this read." `stale`: "Stale finance read. Watermark 2026-10-10T00:00:00.000Z is older than the floor 2026-10-12T00:00:00.000Z." `read-lost`: "The source did not answer. This is not an empty queue." None showed a case |
| Denied and refused | `denied`: `GRANT_REVOKED`. `claims-forced`: `refused` with `(CLAIM)` and `confirmationForcesMatch`. `scope-leak`: `refused` with `(SCOPE_LEAK)` and `rcs-0008`. None showed a case. `integration-http` below |
| Totals | `totals-mismatch`: `data-totals-state="mismatch"` with `COUNT_DIFFERS`. `stale-totals`: `stale` with `STALE_GENERATION` and the source's figure unchanged |
| Balance | `balance-mismatch`: one `data-contradiction="true"` flag on `bal-0003` (`MATCHED_WITH_DIFFERENCE`), "not shown as reconciled" |
| Source cuts | `source-cut-skew`: `data-cut-alignment="skewed"`, five `data-timing-uncertain="true"` flags (four cases and `bal-0001`), no contradiction flag. The verdict read "The source says mismatch, and its two sides sit on cuts at different positions", 9 propose controls were on and 4 were off, and the export loaded withheld with `SOURCES_SKEWED` |
| Dangling link | `dangling-link`: `data-original-trade="unlinked"` with "Original trade trd-0099 is not listed in this read. It is not attached elsewhere.", 12 propose controls on and 1 off |
| Export states | `export-partial`: 10 rows, `PARTIAL`, `COUNT`, `ROWS_DIFFER`. `export-stale`: `STALE_CUT`. `export-rows-differ`: `ROWS_DIFFER`. `export-denied`: "The source refused the export (EXPORT_DENIED)." with no rows. `export-claims-real`: "The export payload was refused (CLAIM)." with no rows |
| Request states | `act-lost`: "Outcome unknown. The request may have been recorded.", a "Fenced." line that a read did not lift, and no propose control on. `self-approval`: "Rejected by the source (SELF_APPROVAL)." `approve-claims-applied`: "The answer was not trusted, and the request may have been recorded (CLAIM).", then fenced |
| Source correction | "Simulate: the source posts a later cut" then Read again: "5 open, 1 unknown, 1 resolved by the source.", `rcs-0001` `data-state="resolved-by-source"` with "This page did not resolve it, and no approval did.", and the `UNMATCHED` total printed `UNDETERMINED` |
| In progress | Not separately observable: the stub port answers within a microtask, so the loading frame was not caught. The server-rendered test covers the loading markup |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360, the same as the `/inventory` baseline); seven labelled, focusable regions hold the wide tables |
| HTTP desk | `data-finance-state="not-bound"` with the not-bound reason, `data-adapter-environment="integration-http"`, zero cases, "Load the export" with `aria-disabled="true"` and the same reason, and Enter on it left the export phase at none |
| Requests | On the stub desk every request was a `GET` to the page host (six in all). No `POST`, and no request to port 8765. On the HTTP desk the only request outside the page host was the shell's `GET /health` probe to port 8765, which failed with `ERR_CONNECTION_REFUSED` |

Not observed in the browser: a screen reader pass, the loading frame, and a real producer, which stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/finance-operations.test.ts` covers the reference and amount shapes, the locked records, the authority table, the clean queue and its links to the merchant and servicing sources, every denial and invalid request, the empty, stale, and lost reads, the total, balance, link, and skew assessments, the refusal of every malformed or claiming payload, the export judge's eleven reasons, the scope declaration, proposals and approvals and the proof that the ledger does not move, the rejection of self-approval, the source-side resolution, the not-bound port, a changed tuple, every scenario, and a source scan. `packages/protocol-adapter/test/finance-controller.test.ts` covers the context key, dropped reads and exports (including an export that lands after the read stopped being ready), a read that began before a request,  scope and actor switching, the not-sent and not-bound refusals, a re-judged export after the source moves, the capability split, the unknown fence that a read does not lift, and the serialisation of requests. `apps/web/test/finance-operations.test.tsx` covers the screen for each state, the seven case kinds, the totals, balances, and skew flags, figures copied verbatim, the authority table, the absence of a confirm, force, or apply control, the recorded proposal and approval, the guarded controls and their shared reasons, the fence, the current and withheld export, the registry surface, the handoff pending row, the eleven fixture rows, the mounted route, and a source scan of the three new web modules.
