# Credit origination stub apps bind

This bind is the stub-scoped seller advance application at `/credit/origination`. It is the synthetic reduction of pending node `c-credit-origination`: the real connection stays pending on `kix-protocol:cr-08-producer-sdk` and the unpromoted `bind-credit-fsm`, `c-finance-projection`, and `c-journey-identity`. This node wires the origination seam — a claim basis with burdens on named source cuts, a policy revision, consents, documents, a review decision with reasons and correction paths, a commitment with terms, a shared limit, and a drawdown permission — onto a deterministic synthetic source. It is not a producer connection and does not claim one. A submission is not a decision, an approval is not a commitment, a commitment is not permission to draw, and a recorded drawdown request is not a disbursement.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `057d8fec955626373eb161456c87b8435a6cd8eb`. This delivery is the uncommitted diff on `agent/kixc-c-credit-origination-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its reads and its five request kinds — submit, correct, re-review, accept-commitment, and request-drawdown — land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`ORIGINATION_NOT_COMPOSED`), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`ORIGINATION_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the requests are `not-bound`: "The contract-only catalogue has no credit command for an application, a review, a commitment, or a drawdown and no read command for a claim basis, a policy revision, a consent, or a document, and no current producer tuple exists." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Claim basis, burdens, policy revision, consents, and document expiry are shown | `OriginationSnapshot` lenses, `OriginationAssessment.staleLanes`, the basis and policy sections | `packages/protocol-adapter/test/credit-origination.test.ts`, `apps/web/test/credit-origination.test.tsx` |
| Conditional, more-information, rejected, approved, commitment, and drawdown permission stay distinct | `OriginationDecisionKind`, `OriginationCommitmentState`, `OriginationDrawdownPermission`, four lanes on one page | both adapter suites and the web suite |
| Review reasons and the correction and re-review paths are provided | `OriginationReason.remedy`, the per-row renew and provide controls, the requests section | `credit-origination.test.ts` (reasons, remedies), `credit-origination.test.tsx` |
| A completed submission or an assistant explanation is never shown as an approval | `ORIGINATION_NON_CLAIM_FIELDS` must all be `false` before a payload is accepted; `explanation-says-approved` keeps the decision pending; a receipt that claims an approval is refused | `credit-origination.test.ts` (claims-approval, claims-disbursed, submit-claims-approval), `credit-origination.test.tsx` |
| The page computes no rate, limit, or schedule | amounts stay opaque whole-unit strings; the adapter refuses a malformed or wrong-unit figure and the page copies it verbatim or shows `UNDETERMINED` | `credit-origination.test.ts` (amount, unit), the web source scan |
| Stale policy, consent withdrawal, and limit contention fixtures exist | `stale-policy`, `consent-withdrawn`, `limit-contended`, `limit-race` scenarios and the nine fixture rows | all three suites |
| No current producer tuple means `NOT_BOUND` | `createNotBoundCreditOrigination`, the integration-http screen state | `credit-origination.test.ts`, `credit-origination.test.tsx` |

The spec asks for a producer read model and a producer connection. Neither exists in this repository (`c-credit-origination` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/credit-origination.ts`. State lives in the object, so a new port is a new session. It serves one applicant scope, `mrc-0001`, to one actor, `credit-origination-desk`; `mrc-0002` is a foreign applicant the desk actor holds no grant for. The actor string is a context label, not an authentication result, and the source decides scope.

A read returns a snapshot: the application, claims and burdens on named source cuts, the current policy revision, consents, documents, the review decision with its conditions, the reasons the source names now, an assistant-generated explanation, the terms, the commitment, the shared limit with the source's own ranks, the drawdown permission with its reason codes and recorded requests, the pin tuple, and a watermark. Validation happens before a row is returned: a malformed reference, a non-whole-unit or wrong-unit amount, an unknown kind or state, a row from another applicant, a row on an unknown cut, or any affirmative non-claim field refuses the whole payload. Amounts are opaque strings in `mock-unit`; nothing parses, sums, scales, or compares them. Every payload states `submissionIsApproval`, `explanationIsApproval`, `approvalIsCommitment`, `commitmentIsDrawdown`, and `disbursed` as `false`, or it is refused whole.

The assessment reports which cuts the claims and burdens were read on and whether they form one cut or several, which lanes were built under an older policy revision than the one the source holds as current (`review`, `commitment`, `terms`), which consents and documents block the requests, whether the source's own limit order puts this application first or behind, which lanes contradict each other (a stated permission that a stale lane, a withdrawn consent, an expired document, or a taken limit contradicts), and which rows name a link the read does not list. A lane built under an older revision is flagged with both revisions and never shown as current, and a permission the source still states is withheld while a lane contradicts it.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read and request. The application is not started. |
| `empty` | Has no rows for this applicant. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `in-review` | The application is submitted and the review is pending. |
| `conditional` | The decision is conditional, with conditions and the reasons and paths the source names. |
| `more-information` | The source asks for additional evidence before it decides. |
| `rejected` | The review rejected the application, with the reasons and paths the source names. |
| `approved` | The decision is approved. An approval is not a commitment. |
| `offered` | A commitment is offered. Accepting it opens no drawdown. |
| `committed` | The commitment is accepted and the source permits a drawdown request. |
| `stale-policy` | The decision and the commitment were built under an older policy revision. The source still states permission; it is withheld on the page. |
| `consent-withdrawn` | The credit-assessment consent is withdrawn at the source. Permission is suspended and the only path is renewing that consent. |
| `docs-expired` | The claim evidence document is expired at the source. Permission is suspended and the only path is providing a current one. |
| `limit-contended` | Another application outranks this one on the shared limit, as the source ordered it. |
| `limit-race` | A rival request takes the shared limit after the first read and before the drawdown request lands. The request is rejected `LIMIT_TAKEN` and the source keeps the order it set. |
| `mixed-cut` | The claims and the burdens are on different source cuts. They are not merged, so there is no single basis to cite. |
| `dangling-link` | One burden names a claim the read does not list. The assessment names it and the page attaches it nowhere. |
| `explanation-says-approved` | The assistant explanation reads like an approval. The decision stays pending. |
| `claims-approval` | The payload claims a submission is an approval. It is refused before a row is shown. |
| `claims-disbursed` | The payload claims a disbursement already happened. It is refused before a row is shown. |
| `scope-leak` | The source sends a row that belongs to another applicant. The payload is refused. |
| `denied` | The grant is withdrawn at the source. The read is `denied` (`GRANT_REVOKED`). |
| `read-lost` | The answer to a read never arrives. The read is `unavailable`. |
| `act-lost` | A request reaches the source and takes effect. Its answer never arrives. |
| `submit-claims-approval` | The source applies a submission, then answers that the decision is approved. The answer is not trusted. |

`advanceReview` moves the source's review on (a pending decision becomes approved, or an approval offers a commitment), `advancePolicy` moves the policy to a newer revision so lanes built under an older one stay flagged, `withdrawConsent` withdraws the credit-assessment consent, `expireDocument` expires the claim evidence, `rivalRequest` lets a rival request take the shared limit, and `revokeGrant` withdraws the synthetic grant. All six are synthetic controls a real producer does not offer.

## The requests and the fence

`packages/protocol-adapter/src/credit-origination-controller.ts`. One request is in flight at a time. A request is built from the last read and sent once: a submission cites the valid claims the read lists, an amendment waits for a decision, a document or consent correction names the row the read lists as needing it, a re-review asks under the current policy revision, a commitment acceptance names the offered commitment, and a drawdown request names the accepted commitment. A request the read cannot support is not sent (`NOT_SENT`) with the reason; `canSend` is the same answer the screen shows, so a control that is off is a request that never leaves. The typed amount is checked for whole-unit shape only and is never parsed or compared.

An answer that never arrived, or that arrived claiming something the request cannot mean (`submit-claims-approval`), leaves the outcome unknown — it may have applied — and every later request is fenced for the rest of the session. A read does not lift the fence; only a new synthetic session clears it, and the earlier unknown is counted, not forgotten. A rejected or applied answer marks the view behind until the next ready read.

The context key is the mode, the domain, the actor string, the tenant, the applicant scope, and a session incarnation. A read that lands for an older context, or an older read that lands after a newer one applied, is dropped. `switchScope` starts a new context for the other applicant scope; rows of the earlier scope are cleared and a read in flight for it is dropped when it lands.

## Screen

`apps/web/src/credit-origination.ts` holds the hook and the pure view builders. `apps/web/src/pages/CreditOriginationPanels.tsx` renders them, and `apps/web/src/pages/CreditOrigination.tsx` composes the page. The sections mirror the lanes: application and review, claim basis, policy and consents, reasons and paths, commitment and drawdown, and requests. Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A block, a refusal, or an unknown outcome moves focus to the status region. Every state has a word, not only a style, and the cut and schedule tables scroll inside their own labelled regions. Every row prints `data-source="synthetic-origination"` and `SYNTHETIC`. The page posts nothing to a protocol and calls no `fetch`.

The hook starts a read when the page opens and reads again only when the person asks. Nothing polls and nothing sets a timer. The renew-consent and provide-document controls are per-row and on offer only where the read lists a row that needs them, and the source decides again at send time.

## Contract fixture rows

The screen is registered as `credit-origination` in `contract-fixtures.ts` with nine synthetic rows: `stale-read` and `stale-policy` as `STALE`, `consent-withdrawn`, `document-expired`, `limit-race`, `scope-denied`, and `claim-refused` as `REJECT` with their codes, and `write-lost` and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-credit-origination`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Rate, limit, and schedule figures stay the source's own text or `UNDETERMINED`. The `/credit` page is a separate mock FSM case (`MOCK_CREDIT_F04_ONLY`) and is untouched.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-15, re-run on the merged tree, driven by a Playwright script kept outside the repo. The stub desk was the production build (`apps/web/dist`) served from `http://127.0.0.1:4190`; the HTTP desk was a second build (`apps/web/dist-http`, `VITE_KIX_PROTOCOL_MODE=http`, `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`) served from `http://127.0.0.1:4191`, and nothing was listening on port 8765. There was no page exception and no console error on either desk. On the stub desk every request was a page `GET` — no `POST` and no request to port 8765. The HTTP desk made no request outside the page assets beyond the shell's `GET /health` probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-origination-state="ready"` on the default `clean` scenario with the application `not-started`; on `in-review` the application showed `submitted`, the decision `pending`, `data-commitment="none"`, `data-permission="not-permitted"`, the all-false claims line on the basis section, and the explanation marked `data-provenance="assistant-generated"` |
| Approved | `approved` scenario: `data-decision-kind="approved"`, no commitment row, the rate label and the three schedule rows copied as the source sent them |
| Empty | `empty` scenario: "No rows for this applicant in this read." with no claim rows |
| Stale policy | `stale-policy` scenario: `data-stale-lane="review"`, `"commitment"`, and `"terms"` flagged with both revisions, `data-permission="permitted"` on the source's word, and `data-withheld-line="drawdown"` with the drawdown control off |
| Consent withdrawn | `consent-withdrawn` scenario: `data-consent-state="withdrawn"`, `data-permission="suspended"`, the `CONSENT_WITHDRAWN` reason, and only the renew-consent path on offer |
| Document expired | `docs-expired` scenario: `data-document-state="expired"`, the `DOCUMENT_EXPIRED` reason, and only the provide-document path on offer |
| Limit race | `limit-race` scenario: the read permitted the drawdown (`data-permission="permitted"`), the request was rejected `LIMIT_TAKEN` — "Another request took the shared limit before this one" — and `limit-contended` reads the contended state with `data-permission="suspended"` |
| Offered to recorded | On `clean`: "Submit the application" applied at the source ("not a decision and not a protocol receipt"); two runs of the synthetic "advance review" control moved the read through `approved` to an `offered` commitment; "Accept the offered commitment" then showed `data-commitment-state="accepted"` and `data-permission="permitted"` on the next read, and "Request a drawdown" recorded the `drw-` row — a recorded request, not a disbursement. The `offered` scenario reads `data-commitment-state="offered"` with drawdown still `not-permitted`; `committed` reads `accepted` and `permitted`. Each request was built from the last read — after every send the controls were off until "Read again". |
| Rejected, conditional, more-information | `rejected` scenario: `data-decision-kind="rejected"` with the source's reasons and remedy paths. `conditional`: `data-decision-kind="conditional"` with a `requested` document row. `more-information`: `data-decision-kind="more-information"` with a `requested` document row. `explanation-says-approved`: the decision stayed `pending` — the explanation's claim is not the decision. `mixed-cut` reads `data-cut-state="mixed"`; `dangling-link` reads `ready` |
| Scope denied | Switch applicant scope to `mrc-0002`, Read again: `denied` with `(SCOPE_DENIED)` and no rows. The scope persists across scenario changes until switched back |
| Claim refused | `claims-approval` and `claims-disbursed` scenarios: `refused` (`CLAIM`) with no rows shown; `scope-leak`: `refused` (`SCOPE_LEAK` — "Row bdn-0003 belongs to mrc-0002") with no rows shown. `submit-claims-approval`: the submit's answer claimed an approval and was refused — the request stayed `UNKNOWN` and fenced later requests |
| Write lost | `act-lost` scenario: the submit answer never arrived, the record stayed `unknown` — "FENCED. Request 1 (submit) has an unknown outcome and may have applied" — `data-fence="true"` blocked every later request, and a read did not lift the fence |
| Read lost | `read-lost` scenario: `unavailable`, "This is not an application with no claim basis." |
| In progress | The stub port answers within a microtask on a normal read; a `LOADING` frame was observable after the applicant-scope switch, before "Read again" — "This request is still loading. Nothing is confirmed." |
| Keyboard | Tab reached `origination-submit` on the 7th press on the `clean` read. On `consent-withdrawn` the off consent control `origination-renew-cns-0001` stayed in the tab order (45th press) with `aria-disabled` and named its reason through `aria-describedby`. Enter on an enabled control sent the request once |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360); the tables scroll inside their own labelled regions |
| HTTP desk | `data-origination-state="not-bound"` with the not-bound reason, `data-enabled="false"` on every request control, zero rows, `data-adapter-environment="integration-http"`. The only request outside the page assets was the shell's `GET /health` probe to port 8765 |

Not observed in the browser: a screen reader pass, and a real producer, which stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/credit-origination.test.ts` covers every read and request outcome, the claim, reference, amount, unit, kind, state, scope, and cut validation, the four-lane separation, the stale-policy, consent, document, and limit assessment, the contradictions, the eligibility rules, the not-bound port, and a source scan. `packages/protocol-adapter/test/credit-origination-controller.test.ts` covers the context key, dropped reads, scope switching, the not-sent and not-bound refusals, the unknown fence that a read does not lift, and the limit race. `apps/web/test/credit-origination.test.tsx` covers the screen for each state, the four lanes, the flagged lanes and withheld permission, the per-row correction controls, the applied, rejected, refused, and unknown request records, the registry surface, the handoff pending row, the nine fixture rows, the mounted route, and a source scan of the three new web modules.
