# Delegated assistant stub apps bind

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

Filled in below after the local browser check of `/assistant`.
