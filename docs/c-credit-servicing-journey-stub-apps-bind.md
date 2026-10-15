# Credit servicing journey stub apps bind

This bind is the stub-scoped servicing and operations desk at `/credit/servicing`. It is the synthetic reduction of pending node `c-credit-servicing-journey`: the real connection stays pending on `kix-protocol:cr-08-producer-sdk` and the unpromoted `c-async-session-fence`, `c-finance-projection`, and `c-journey-identity`. This node wires the servicing seam — a draw instruction, a disbursement observation, a reservation, an exposure, a commitment limit, a repayment schedule, payments, allocations, unapplied remainders, reversals, adjustments, a servicing case with its history, an incident timeline, and proposals that a different actor approves — onto a deterministic synthetic source. It is not a producer connection and does not claim one. An instruction is not an observation, an observation is not confirmed funds, a reservation is not an exposure, a partial repayment is not a restored limit, and a case closure is not an extinguished debt.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `9ed485444f866e31c22d04699bd46a6db93a7ae9`. This delivery is the uncommitted diff on `agent/kixc-c-credit-servicing-journey-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its reads and its four request kinds — propose-allocation, propose-adjustment, propose-case-transition, and approve-proposal — land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`SERVICING_NOT_COMPOSED` quotes the locked record), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`SERVICING_HOLD_NOT_BOUND` quotes the locked binding). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the requests are `not-bound`: "No current producer tuple exists for credit servicing: kix-protocol:cr-08-producer-sdk is not merged, and c-async-session-fence, c-finance-projection, and c-journey-identity are not promoted. The contract-only catalogue has no credit command and no read command for a draw instruction, a payment observation, a reservation, an exposure, a repayment schedule, an allocation, a reversal, an adjustment, or a servicing case." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Draw instruction, disbursement observation, reservation, and exposure are shown separately | `ServicingSnapshot` lenses (`draw`, `reservation`, `exposure`), the draw and funds sections | `packages/protocol-adapter/test/credit-servicing.test.ts`, `apps/web/test/credit-servicing.test.tsx` |
| Repayment schedule, payment allocation, unapplied remainder, reversal, adjustment, and case history are connected | `ServicingSnapshot` lenses (`installments`, `payments`, `allocations`, `reversals`, `adjustments`, `servicingCase`), the incident timeline, linked refs on every row | both adapter suites and the web suite |
| View, proposal, and approval stay separated per actor | `servicingCapabilities`, `ACTOR_CAPABILITIES`, the `NO_CAPABILITY` and `SELF_APPROVAL` rejections, the actor selector | `credit-servicing.test.ts`, `credit-servicing-controller.test.ts`, `credit-servicing.test.tsx` |
| A partial repayment is never shown as restoring the commitment limit | `SERVICING_NON_CLAIM_FIELDS` must all be `false` before a payload is accepted; `partialRepaymentRestoresLimit` stays the literal false and `claims-restored` is refused whole | `credit-servicing.test.ts` (claims-restored), `credit-servicing.test.tsx` |
| A charge-off or recovery-case closure is never shown as the debt ending | `ServicingCase.debtLabel` is the source's `not-extinguished`; `caseClosureIsDebtExtinguished` stays false and `claims-extinguished` and `approve-claims-closure` are refused | `credit-servicing.test.ts` (claims-extinguished, approve-claims-closure), `credit-servicing.test.tsx` |
| A payment after the case closed is a fact of its own and reopens nothing | `ServicingPayment.timing` `post-charge-off`, the `late-unallocated` state, the `POST_CLOSURE_PAYMENT` reason | `credit-servicing.test.ts` (post-charge-off-payment), `credit-servicing.test.tsx` |
| UNKNOWN, partial repayment, and post-write-off payment run end to end | `act-lost` unknown fence, `partial-repayment`, `post-charge-off-payment` scenarios and fixture rows | all three suites |
| The page performs no contact, collection, disbursement, or payment | `contactMade`, `collectionExecuted`, and `disbursed` stay the literal false; `claims-contact` is refused whole | `credit-servicing.test.ts` (claims-contact), the web source scan |
| The page computes no amount, remainder, or exposure figure | amounts stay opaque whole-unit strings; the adapter refuses a malformed or wrong-unit figure and the page copies it verbatim or shows `UNDETERMINED` | `credit-servicing.test.ts` (amount, unit), the web source scan |
| Stale read and stale schedule fixtures exist | `stale` and `stale-schedule` scenarios, the stale-read and stale-schedule fixture rows | all three suites |
| No current producer tuple means `NOT_BOUND` | `createNotBoundCreditServicing`, the integration-http screen state | `credit-servicing.test.ts`, `credit-servicing.test.tsx` |

The spec asks for a producer connection. None exists in this repository (`c-credit-servicing-journey` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/credit-servicing.ts`. State lives in the object, so a new port is a new session. It serves one obligation scope, `obl-0001`, to three actors: `credit-servicing-desk` (read and propose), `credit-servicing-approver` (read and approve), and `credit-servicing-viewer` (read only). `obl-0002` is a foreign obligation the desk actors hold no grant for. An actor string is a context label, not an authentication result, and the source decides scope and capability.

A read returns a snapshot: the draw with its instruction and observation lanes, the reservation, the exposure, the commitment limit, the repayment schedule revision and its installments, the payments with the source's own unallocated-remainder labels, the allocations, the reversals, the adjustments, the proposals, the servicing case with its history and closure kind, the incident timeline, the reasons the source names now with the one proposal path each offers, the pin tuple, and a watermark. Obligation rows sit on `cut-0001` (`obligation-ledger`) and payment rows on `cut-0002` (`payment-ledger`). Validation happens before a row is returned: a malformed reference, a non-whole-unit or wrong-unit amount, an unknown kind or state, a row from another obligation, a row on a ledger's cut it does not belong to, or any affirmative non-claim field refuses the whole payload. Amounts are opaque strings in `mock-unit`; nothing parses, sums, scales, or compares them. Every payload states `instructionIsDisbursement`, `observationIsConfirmedFunds`, `partialRepaymentRestoresLimit`, `reversalErasesHistory`, `caseClosureIsDebtExtinguished`, `contactMade`, `collectionExecuted`, and `disbursed` as `false`, or it is refused whole.

The assessment reports which cuts the rows were read on and whether a row sits on the wrong ledger's cut (`WRONG_LEDGER_CUT`; the ledgers are never merged), which installments were built under an older schedule revision than the one the source holds as current, which lanes contradict each other (an open exposure with no observed disbursement, an observation with no recorded instruction), which rows name a ref the read does not list, and which case transitions the source offers from the current status. A contradiction is flagged, never shown as the lane it contradicts.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read and request. Observation recorded, reservation held, exposure open, limit held, case monitoring, one allocated payment. |
| `empty` | Has no rows for this obligation. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `draw-unknown` | The instruction is recorded but the disbursement observation and the exposure are `unknown`. No instruction is shown as an observation. |
| `partial-repayment` | A late payment covered part of an open installment. The remainder stays unallocated and the limit stays held — the payment restored nothing. |
| `unallocated` | A late payment is fully unallocated. It applies itself to nothing. |
| `reversal` | An allocation was reversed: the allocation and the payment keep their `reversed` states, and both events stay on the timeline. |
| `delinquent` | An installment is overdue and the case is delinquent. The source offers recovery and charge-off transitions. |
| `charged-off` | The case closed as charged-off, the reservation and the limit are released, open installments are charged-off, and the debt label stays `not-extinguished`. |
| `post-charge-off-payment` | A payment was observed after the charged-off closure. It is `late-unallocated` with `post-charge-off` timing, it reopens nothing, and the `POST_CLOSURE_PAYMENT` reason says so. |
| `proposal-pending` | An allocation proposal from the desk actor waits for an approver. It applies nothing alone. |
| `stale-schedule` | The schedule revision advanced past the revision the listed installments were built under. The rows are flagged with both revisions. |
| `adjustment-applied` | A due-label adjustment was applied to an installment. The earlier rows stay on the timeline. |
| `mixed-cut` | A payment row sits on the obligation ledger's cut. The read is flagged `WRONG_LEDGER_CUT` and no allocation is proposed on it. |
| `dangling-link` | One allocation names a payment the read does not list. The assessment names it and the page attaches it nowhere. |
| `claims-restored` | The payload claims a partial repayment restored the limit. It is refused before a row is shown. |
| `claims-extinguished` | The payload claims a case closure extinguished the debt. It is refused before a row is shown. |
| `claims-contact` | The payload claims a contact was made. It is refused before a row is shown. |
| `scope-leak` | The source sends a payment that belongs to another obligation. The payload is refused. |
| `denied` | The grant is withdrawn at the source. The read is `denied` (`GRANT_REVOKED`). |
| `read-lost` | The answer to a read never arrives. The read is `unavailable`. |
| `act-lost` | A request reaches the source and takes effect. Its answer never arrives. |
| `approve-claims-closure` | The source applies an approval, then answers with a receipt claiming the closure extinguished the debt. The answer is not trusted. |

`observe-draw` records a disbursement observation and opens the exposure, `receive-payment` observes a new unallocated payment (marked `post-charge-off` when the case is closed), `reverse-allocation` reverses one applied allocation, `mark-overdue` moves an open installment overdue and the case delinquent, `advance-schedule` moves the schedule to a newer revision so rows built under an older one stay flagged, and `revoke-grant` withdraws the synthetic grant. All six are synthetic controls a real producer does not offer.

## The requests and the fence

`packages/protocol-adapter/src/credit-servicing-controller.ts`. One request is in flight at a time. A request is built from the last read and sent once: an allocation proposal names a payment and a schedule row the read lists as open to it, an adjustment proposal names an open schedule row and one adjustment kind, a case proposal names one transition the read offers from the current case status, and an approval names a pending proposal the read lists. A request the read cannot support is not sent (`NOT_SENT`) with the reason; `canSend` is the same answer the screen shows, so a control that is off is a request that never leaves. Propose and approve need different capabilities — the desk actor proposes, the approver approves, the viewer sends nothing — and the source rejects an approval of the proposer's own proposal (`SELF_APPROVAL`).

A recorded proposal is not applied: the receipt says `proposal-recorded`, and the lanes change only after an approval and a fresh read. An answer that never arrived, or that arrived claiming something the request cannot mean (`approve-claims-closure`), leaves the outcome unknown — it may have applied — and every later request is fenced for the rest of the session. A read does not lift the fence; only a new synthetic session clears it, and the earlier unknown is counted, not forgotten. A rejected or applied answer marks the view behind until the next ready read.

The context key is the mode, the domain, the actor string, the tenant, the obligation scope, and a session incarnation. A read that lands for an older context, or an older read that lands after a newer one applied, is dropped. `switchScope` starts a new context for the other obligation scope and `switchActor` for another desk actor; rows of the earlier context are cleared and a read in flight for it is dropped when it lands.

## Screen

`apps/web/src/credit-servicing.ts` holds the hook and the pure view builders. `apps/web/src/pages/CreditServicingPanels.tsx` renders them, and `apps/web/src/pages/CreditServicing.tsx` composes the page. The sections mirror the lanes: status, draw and funds, schedule, payments and allocations, servicing case, reasons and paths, requests, and the incident timeline. Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A block, a refusal, or an unknown outcome moves focus to the status region. Every state has a word, not only a style, and the schedule and timeline tables scroll inside their own labelled regions. Every row prints `data-source="synthetic-servicing"` and `SYNTHETIC`. The page posts nothing to a protocol and calls no `fetch`.

The hook starts a read when the page opens and reads again only when the person asks. Nothing polls and nothing sets a timer. The propose and approve controls name only the refs the last read lists, and the source decides again at send time.

## Contract fixture rows

The screen is registered as `credit-servicing` in `contract-fixtures.ts` with eight synthetic rows: `stale-read` and `stale-schedule` as `STALE`, `scope-denied` and `claim-refused` as `REJECT` with their codes, `partial-repayment` and `post-charge-off-payment` as `UNKNOWN` non-completion observations, and `write-lost` and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-credit-servicing-journey`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, no contact, and no collection action. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Every figure stays the source's own text or `UNDETERMINED`. The `/credit` page is a separate mock FSM case (`MOCK_CREDIT_F04_ONLY`) and is untouched.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-15, driven by a Playwright script kept outside the repo. The stub desk was the production build (`apps/web/dist`) served from `http://127.0.0.1:4190`; the HTTP desk was a second build (`apps/web/dist-http`, `VITE_KIX_PROTOCOL_MODE=http`, `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`) served from `http://127.0.0.1:4191`, and nothing was listening on port 8765. There was no page exception on either desk. The only console error on the stub desk was Chrome's automatic `/favicon.ico` probe, and the HTTP desk added only the shell's failed probe to port 8765. On the stub desk every request was a page `GET` — no `POST` and no request to port 8765. The HTTP desk made no request outside the page assets beyond the shell's `GET /health` probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-servicing-state="ready"` on the default `clean` scenario: tenant `tenant-desk`, obligation `obl-0001`, actor `credit-servicing-desk` holding `read, propose`, watermark `2026-10-13T00:00:00.000Z`; draw observation `observed`, reservation and limit `held`, exposure `open`, cut `clean`, three schedule rows (`satisfied`/`due`/`scheduled`), payment `pmt-0001` `allocated`, allocation `applied`. |
| Propose then approve (maker/checker) | As `credit-servicing-desk`, "Propose a schedule correction" applied at the source — "Adjustment proposal applied at the synthetic source. This is not a decision and not a protocol receipt. Read again to see the lanes."; the next read listed the pending proposal. Switching the desk actor cleared the rows and started a `credit-servicing-approver` read (`read, approve`); its approve control applied `prp-0001` ("Proposal approval applied at the synthetic source … not a protocol receipt"). |
| Self-approval | `self-approval` scenario (the pending proposal was recorded by the approver itself): the approver's send was rejected `SELF_APPROVAL` — "Actor credit-servicing-approver proposed prp-0001. Proposal and approval stay separate, so its own actor cannot approve it. The source applied nothing for this request." |
| Claiming receipt | `approve-claims-closure` scenario: the approval's answer was refused (`CLAIM`); the request stayed `UNKNOWN` — "Proposal approval outcome unknown (CLAIM). It may have applied. Every later request is fenced, and a read does not resolve it." |
| Write answer lost | `act-lost` scenario: the proposal send stayed `UNKNOWN` — "FENCED. Request 1 (propose-adjustment) has an unknown outcome and may have applied. Nothing is sent again from here." |
| Read states | `empty` ("No rows for this obligation in this read"), `stale` (watermark 2026-10-10 behind the 2026-10-12 floor), `denied` (`GRANT_REVOKED`), `unavailable` (`read-lost` — "This is not a settled servicing record"), `refused` (`CLAIM` on `claims-restored`, `claims-extinguished`, and `claims-contact`; `SCOPE_LEAK` on `scope-leak` — "Row pmt-0009 belongs to obl-0002", no row shown). |
| Scenario lanes | `draw-unknown`: observation `unknown`, exposure `unknown`, reservation/limit `held`. `partial-repayment`: a `partial` payment row. `unallocated`: an `unallocated` payment row. `reversal`: payment and allocation both `reversed`. `delinquent`: a schedule row `overdue`. `charged-off`: reservation and limit `released`, installment `charged-off`. `post-charge-off-payment`: a `late-unallocated` payment row. `proposal-pending`: a `pending` proposal row. `stale-schedule` and `mixed-cut` (`data-cut-state="mixed"`), `adjustment-applied` (a schedule row `adjusted`), `dangling-link` read `ready`. |
| Scope switch | The switch-scope control moved to `obl-0002`; after "Read again" the read ended `denied` (`SCOPE_DENIED`) — "This actor holds no grant for that obligation at the source", no rows. |
| Actor without propose | Switching to `credit-servicing-viewer` left the desk `read`-only (`Capabilities read.`); the propose control stayed off with "BLOCKED. Actor credit-servicing-viewer holds no propose capability at the source. View, proposal, and approval stay separate." |
| In progress | The stub port answers within a microtask on a normal read; a `LOADING` frame was observable only after an actor/scope switch, before "Read again" — "This request is still loading. Nothing is confirmed." |
| Keyboard | Tab reached `servicing-refresh` on the 45th press. Blocked controls stay in the tab order with `aria-disabled` and name their reason through `aria-describedby`. |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360); the schedule and timeline tables scroll inside their own labelled regions. |
| HTTP desk | `data-servicing-state="not-bound"` with the not-bound reason (`kix-protocol:cr-08-producer-sdk` not merged; `c-async-session-fence`, `c-finance-projection`, and `c-credit-servicing-journey` pending), `data-adapter-environment="integration-http"`, zero rows, every request control off. The only request outside the page assets was the shell's `GET /health` probe to port 8765. |

Not observed in the browser: a screen reader pass, the dropped-read and quarantine paths (they need a read in flight when the context changes — the microtask port resolves too fast), and a real producer, which stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/credit-servicing.test.ts` covers every read and request outcome, the claim, reference, amount, unit, kind, state, scope, and ledger validation, the four-lane separation, the stale-schedule flag, the contradictions, the unlinked rows, the eligibility rules, the capability split and self-approval refusal, the proposal and approval path, the not-bound port, and a source scan. `packages/protocol-adapter/test/credit-servicing-controller.test.ts` covers the context key, dropped reads, scope and actor switching, the not-sent and not-bound refusals, the unknown fence that a read does not lift, and the apply-after-approval path. `apps/web/test/credit-servicing.test.tsx` covers the screen for each state, the lane separation, the flagged rows and withheld controls, the per-row propose and approve controls, the applied, rejected, refused, and unknown request records, the registry surface, the handoff pending row, the eight fixture rows, the mounted route, and a source scan of the three new web modules.
