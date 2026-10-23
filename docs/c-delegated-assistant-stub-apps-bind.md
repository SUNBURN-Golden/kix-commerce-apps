# Delegated assistant stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped delegated assistant at `/assistant`. It is the synthetic reduction of pending node `c-delegated-assistant`: the real grant, proposal, approval, and command read model and the real producer connection stay pending on `kix-protocol:ai-delegation-execution-decision` and `kix-protocol:k-authority-qualification`, and on the unpromoted `delegation-surface` node. This node wires a language request to a structured proposal, a separate approve control, and two synthetic write kinds onto a deterministic synthetic source. It is not a producer connection and does not claim one. A request is untrusted intent, a proposal is the page's own record, an approval is the approve control's own press, and a confirmed command is the synthetic source's record of it: a sentence is never authority for funds, rights, signing, or execution, and nothing here adopts an execution delegation.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `7c2452645c50b8ede17bdd762794adeabe42319e`. This delivery is the uncommitted diff on `agent/kixc-c-delegated-assistant-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its read and its two write kinds — draft-order and cancel-draft — land on an in-process synthetic source, which is a stand-in for a delegation producer. Neither write kind is a desk method and neither is a catalogue command; `delegate` and `close_delegation` are pinned actions this page never sends (`DELEGATION_NOT_COMPOSED` records both, plus the platform list), `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent, and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`DELEGATION_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it. A staged draft is not a hold and not a booking.

On `integration-http` the read and the writes are `not-bound`: "No current producer tuple exists for the delegation assistant: kix-protocol:ai-delegation-execution-decision and kix-protocol:k-authority-qualification are not merged, and the delegation-surface node is not promoted. The contract-only catalogue has no command or read for a delegation grant, an assistant proposal, or an assistant command. The delegation assistant stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Scope, deadline, target, budget, and allowed actions are structured | `DelegationGrant` (`scope`, `notAfter`, `targetEventRef`, `commandBudget`, `allowedActions`, `requestedMode`, `adoptedMode`, `version`, `state`), `DELEGATION_CONTRACT_REGISTER` | `packages/protocol-adapter/test/delegated-assistant.test.ts`, `apps/web/test/delegated-assistant.test.tsx` |
| A proposal and an execution approval are shown separately | `DelegationProposal` (`open`/`dismissed`/`consumed`), the four lanes, the approve and dismiss controls, `gateFor` | both suites |
| Revoke, stale grant, and a lost command are reconciled against the current protocol | `GRANT_REVOKED` (denied, not recorded), `GRANT_STALE`/`GRANT_EXPIRED`/`MODE_CAPPED`/`ACTION_NOT_GRANTED`/`TARGET_OUTSIDE_SCOPE`/`BUDGET_EXHAUSTED`/`DUPLICATE_DRAFT` rejects, `RESPONSE_LOST`/`CLAIM`/`CORRELATION` unknowns, the `unknown-outcome` and `proposal-stale` fences, quarantine of a late result | both suites |
| An LLM sentence is never promoted to execution authority | `interpretDelegationRequest` is deterministic, `INJECTION_FLAGGED` refuses instruction-like text whole, `refuseDelegationSnapshot`/`refuseDelegationReceipt` refuse a payload that omits or asserts a non-claim (`DELEGATION_NON_CLAIM_FIELDS`, seven, all `false`) | both suites |
| An ambiguous goal infers no new risky authority | `clarify` turns for a missing action or target, `OUT_OF_SCOPE` refuses verbs outside the two delegated commands, the `no-grant` and `not-listed` fences never search for or infer a grant | both suites |
| An unadopted execution delegation stays in query/propose mode | `grt-0002` is requested at `command` and adopted at `propose`; `MODE_CAPPED` rejects the write and the `mode-capped` fence stops the approve control; a snapshot reporting adopted above requested is refused (`STATE`) | both suites |

The spec asks for natural-language requests to be connected to queries, proposals, and approved commands inside the current authority. No delegation producer contract or read model exists in this repository or in the pinned catalogue (`c-delegated-assistant` is pending), so the adapter is the synthetic port and the interpreter is a deterministic stand-in for an LLM. That is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/delegated-assistant.ts`. State lives in the object, so a new port is a new session. It serves one principal, `pal-0001`, to the desk actor `delegate-desk`; `pal-0002` is a principal the desk holds no grant from. One active grant `grt-0001` covers listings under `evt-0001` at requested and adopted mode `command` with a command budget of two — a count of commands with no amount. A second grant `grt-0002` covers `evt-0002` requested at `command` and adopted at `propose`: an unadopted execution delegation that stays in query/propose mode. Three listings sit under the two events, and no draft is staged at the start.

A read answers `ready` with a snapshot, `empty`, `stale` (a watermark older than the floor the page holds), `denied` (`GRANT_REVOKED` or `SCOPE_DENIED`), `refused` (`CLAIM`, `SCOPE_LEAK`, or a shape failure), `tuple-changed`, `not-bound`, or `unknown` — each a distinct state, never an empty list. A snapshot carries the seven non-claims (`assistantTextIsAuthority`, `proposalIsApproval`, `approvalIsResult`, `fundsMoved`, `rightsTransferred`, `executionDelegationBound`, `grantInferredFromText`) all `false`; a payload that omits one or states it otherwise is refused whole before a row shows.

A write is validated before it is scoped (`invalid-request`: `INTENT`, `STEP`, `IDENTITY`, `VERSION`), then the grant gate reads the grant the source holds now and stops at the first reason: revoked (`denied`, not a rejection and not recorded), stale version (`GRANT_STALE`), past deadline (`GRANT_EXPIRED`), adopted mode below `command` (`MODE_CAPPED`), action not listed (`ACTION_NOT_GRANTED`), budget used (`BUDGET_EXHAUSTED`), then the target check (`TARGET_OUTSIDE_SCOPE`, `LISTING_NOT_OPEN`, `DRAFT_NOT_OPEN`, `DUPLICATE_DRAFT`, `UNKNOWN_REF`). Each rejection maps to exactly one return action the page offers: read again (`GRANT_STALE`, `LISTING_NOT_OPEN`, `DRAFT_NOT_OPEN`, `DUPLICATE_DRAFT`, `UNKNOWN_REF`), revise the request (`ACTION_NOT_GRANTED`, `TARGET_OUTSIDE_SCOPE`), or nothing (`GRANT_EXPIRED`, `MODE_CAPPED`, `BUDGET_EXHAUSTED`). Whether a cancel restores a command budget is a product policy that is not published, so the source states `UNDETERMINED` and the page restores and recomputes nothing. These rules are stub policy for tests and the demo. They are not protocol law.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read and write. Two grants, three listings, no draft. |
| `empty` | Lists no grant for this principal. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `denied` | The synthetic grants for this principal were withdrawn. The read is `denied` (`GRANT_REVOKED`). |
| `expired` | `grt-0001` is already past its deadline. A write is `GRANT_EXPIRED`. |
| `budget-spent` | `grt-0001` has no command budget left. A write is `BUDGET_EXHAUSTED`. |
| `closed-listing` | `lst-0001` is closed at the source. A draft order on it is `LISTING_NOT_OPEN`. |
| `draft-lost` | A draft order is recorded and its answer never arrives. |
| `cancel-lost` | A cancel is recorded and its answer never arrives. |
| `held-response` | The source holds each answer until it is delivered. |
| `receipt-claims-execution` | The source records a draft order, then answers that funds moved. The answer is refused (`CLAIM`) and the write stays unknown. |
| `snapshot-claims-authority` | The source answers a read that claims assistant text is authority and an execution delegation is bound. The whole payload is refused (`CLAIM`). |
| `scope-leak` | The source sends a draft that belongs to another principal. The whole payload is refused (`SCOPE_LEAK`). |
| `race-superseded` | The first write after the first read finds the grant already at a newer version at the source (`GRANT_STALE`), as a supersede between read and write would. |

Five simulated events stand in for things a real producer would cause: `grt-0001` is revoked, superseded to a newer version, or passes its deadline, the `grt-0001` command budget is used by another channel, and `lst-0001` closes. The page labels each one "Simulate:" and none is an approval, a mode raise, or a command. **The page does not read again after a simulated event**, so it stays behind until the next read — that is what makes the revoke, supersede, and expiry paths testable end to end.

## The controller's fences

`packages/protocol-adapter/src/delegated-assistant-controller.ts`. The context key is environment, domain, actor, principal, and session incarnation; a context switch starts a new incarnation, drops a read that lands late (`DROPPED`, `context-changed`), marks an in-flight write `UNKNOWN`, and quarantines its late result (`QUARANTINED`, applied nowhere). One write is in flight per grant; each is sent once under the caller's own intent reference; a lost or mis-correlated answer stays `UNKNOWN` and fences every later write under that grant (`unknown-outcome`), and a read never lifts the fence. A proposal recorded before a context switch is stale (`proposal-stale`) and cannot be approved. The single gate `gateFor` is also what the page previews, so an approve control that is off shows the same reason the send would have been fenced with. These fences are client guards in this page load only; durable session recovery stays on pending node `c-async-session-fence`/`c-delegated-assistant`.

## Tests

`packages/protocol-adapter/test/delegated-assistant.test.ts` covers the ref vocabulary, the interpreter (proposal, answer, clarify, refused, injection-flagged), each read outcome, the tuple pin check, the write decision order, the lost and refused answers, the simulated events, the payload refusals, the contract register against the pinned catalogue, and the controller's fences, quarantine, and not-bound port end to end.

`apps/web/test/delegated-assistant.test.tsx` covers every screen state, the four lanes, the proposal-to-command flow, the refused and clarified requests, the fenced approve controls with their reasons, the rejection card and its return action, the unknown and quarantined session lines, the register and never-sent lists, the source-file token scan, and the registry, packet, and doc names.

## Hold

The real connection is `c-delegated-assistant`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, no refund, and no message. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The grant figures stay the source's own or `UNDETERMINED`. The product policy — whether a cancel restores a command budget — is not published and stays `UNDETERMINED`.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-15, driven by a Playwright script kept outside the repo. The stub desk was the production build (`apps/web/dist`) served from `http://127.0.0.1:4190`; the HTTP desk was a second build (`apps/web/dist-http`, `VITE_KIX_PROTOCOL_MODE=http`, `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`) served from `http://127.0.0.1:4191`, and nothing was listening on port 8765. There was no page exception on either desk. On the stub desk every request was a page `GET` — no `POST` and no request to port 8765. The HTTP desk made no request outside the page assets beyond the shell's `GET /health` probe to port 8765. The only console error on the stub desk was a 404 on `/favicon.ico` — the static file server ships no favicon and the build declares none — and the HTTP desk added only the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-delegation-state="ready"` on the default `clean` scenario; grants `grt-0001` (listings under `evt-0001`, requested and adopted `command`) and `grt-0002` (requested `command`, adopted `propose`) listed; the four lanes at zero; "The last read is current." |
| Proposal then approval then command | "draft an order for lst-0001" produced proposal `prp-0001` — "Recorded as a proposal. Nothing is sent." The approve control was enabled; pressing it recorded `intent-1` with outcome `CONFIRMED` in the session record ("Sent 1"), staged `drf-0001` (`data-state="staged"`), and the note "Draft order recorded by the synthetic source as drf-0001. It stages an order draft only: it is not a hold, not a booking, not a payment, and not a right. This is not a protocol receipt." The lanes read "1 proposal recorded" and "1 approval pressed". |
| Refused request | "pay the seller" produced a refused turn — `OUT_OF_SCOPE`: "The request names "pay", which is not one of the two delegated commands (draft-order, cancel-draft)." No proposal was recorded and nothing was sent. |
| Clarified request | "draft an order" with no listing named produced a clarify turn and no proposal. |
| Grant revoked | The `revoke-grant` simulate control printed "Grant grt-0001 was revoked at the source at version 5 … This page has not read again, so it does not show this yet." After the next read, a new proposal's approve control stayed off with "BLOCKED. Grant grt-0001 is revoked in the last read." — the gate stopped the send before it left, with the same reason `gateFor` previews. |
| Grant expired | `expired` scenario: the approve control stayed enabled (the grant's deadline is a source-side fact), the send was rejected `GRANT_EXPIRED` — "Grant grt-0001 passed its deadline 2026-10-01T00:00:00.000Z. The source applied nothing for this request." |
| Budget spent | `budget-spent` scenario: the approve control stayed off — "BLOCKED. Grant grt-0001 used its command budget in the last read." No request was sent. |
| Listing closed | `closed-listing` scenario: the approve control stayed off — "BLOCKED. lst-0001 is closed in the last read." No request was sent. |
| Write answer lost | `draft-lost` scenario: the send stayed `UNKNOWN (RESPONSE_LOST)` in the session record — "It may or may not have been recorded. Writes under this grant are blocked, and a read does not resolve it." The unknown-outcome fence showed. |
| Held answer | `held-response` scenario: the send stayed `IN_FLIGHT` until the "Deliver the held response" control ran; the delivered answer then recorded `CONFIRMED`. |
| Claiming receipt | `receipt-claims-execution` scenario: the answer claiming funds moved was refused (`CLAIM`); the write stayed `UNKNOWN` and fenced later writes under the grant. |
| Grant superseded mid-flight | `race-superseded` scenario: the write was rejected `GRANT_STALE` — "Grant grt-0001 is no longer at version 4. The grant the command was built on is stale." |
| Read states | `empty` ("No grant is listed for this principal in this read"), `stale` (watermark 2026-10-10 behind the 2026-10-12 floor), `denied` (`GRANT_REVOKED`), `refused` (`CLAIM` on `snapshot-claims-authority`, `SCOPE_LEAK` on `scope-leak` — "Draft drf-0099 belongs to another principal", no row shown). |
| Cancel | `cancel-lost`: the read lists no staged draft, so "cancel the draft" produced no proposal — the interpreter clarified rather than infer a draft. The lost-cancel answer itself is covered by the adapter and web tests, not observed here. |
| Scope switch | The switch-scope control moved to principal `pal-0002`; the read ended `denied` (`SCOPE_DENIED`) — "Actor delegate-desk holds no grant from principal pal-0002", no grant or listing shown. Switching back restored the `pal-0001` read. |
| In progress | The stub port answers within a microtask; a loading frame was not caught on read. The server-rendered test covers the loading markup. |
| Keyboard | Tab reached `dlg-ask` on the 11th press. Blocked controls stay in the tab order with `aria-disabled` and name their reason through `aria-describedby`. |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360); the tables scroll inside their own labelled regions. |
| HTTP desk | `data-delegation-state="not-bound"` with the not-bound reason (`kix-protocol:ai-delegation-execution-decision` and `kix-protocol:k-authority-qualification` not merged, `delegation-surface` not promoted), `data-adapter-environment="integration-http"`, `data-transport-state="unavailable"`, zero rows, every request control off. The only request outside the page assets was the shell's `GET /health` probe to port 8765. |

Not observed in the browser: a screen reader pass, the dropped-read and quarantine paths (they need a read in flight when the context changes — the microtask port resolves too fast), the lost-cancel answer (no staged draft in that scenario's read), and a real producer, which stays unverified by design for this stub scope.
