# Journey identity stub apps bind

This bind is the stub-scoped journey context desk at `/identity`, the synthetic reduction of pending node `c-journey-identity`. The real context-bound identity registry and read-projection evidence contract stay pending on kix-protocol:protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, and contract-compatibility-profile. This node defines an app-internal context key model and a read-observation adjudicator over a deterministic synthetic source. It is not a producer connection and does not claim one; the key format is never an external schema, operation, capability, or public identifier.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. `contract_change=NO`.

## What this page sends

Nothing goes to a protocol. The only write is a synthetic `attach` — recording a current observation as this session's evidence — and it lands on an in-process synthetic source. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, and `admit` stay uncomposed, and `refund_ticket` is recorded in `JOURNEY_IDENTITY_NOT_COMPOSED` and never sent. `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`JOURNEY_IDENTITY_HOLD_NOT_BOUND` quotes the locked binding).

On `integration-http` the read and the attach are `not-bound`: the contract-only catalogue has no journey read or evidence command. There is no stub fallback, no third adapter, and no request.

## The context key

`JourneyContextParts` binds a session to: adapter `environment` (mode), `actorRef` (a label, never an authentication result), `role` (buyer/organizer/operator), `domain` (the pinned protocol domain), `cutGeneration` (the source cut the session is bound to), `tupleKey` (an app-internal comparison string over the live pin tuple — not a protocol digest), and `incarnation`. `journeyContextKey` joins them into the internal correlation key stamped on every read request and every write. The key is not published anywhere.

## The adjudicator

`adjudicateObservation(context, item, floor)` judges every row of a synthetic read before it may be used:

| Verdict | Rule |
| --- | --- |
| `refused` | The row claims a non-claim (`confirmsPayment`, `confirmsIssuance`, `confirmsAdmission`, `realIntegration`, `productionEnvironment` not literal false) or is malformed. The source also refuses the whole payload before a row shows. |
| `foreign` | The row was minted under a different tuple, domain, or mode, under a newer cut, or — for a receipt — under another actor, role, or session. A receipt minted under another context is never this journey's evidence. |
| `stale` | The row was minted under an older cut or carries a watermark behind the reader's floor. |
| `current` | Usable as a non-authoritative observation of this context. It is never a proof of payment, issuance, or admission. |

## Session isolation

`switchContext` (actor or role) and `resetSource` (a stub re-initialisation or a mode change) isolate the earlier session: its key, fields, and unknown count go to the isolated-sessions journal, in-flight writes become `UNKNOWN` (`CONTEXT_SWITCHED`/`SOURCE_RESET`), and their results are quarantined. A stub reset keeps every earlier UNKNOWN on record and still fencing its subject. A read reporting a different cut generation is `generation-moved` and applies nothing.

## Acceptance mapping

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Context key model (mode, actor, role, domain, cut, tuple, incarnation) | `journeyContextKey`, `JourneyContextParts` | `journey-identity.test.ts` (key fields and uniqueness) |
| Reads adjudicated; context/generation mismatch and stale receipts refused or STALE before use | `adjudicateObservation`, `refuseIdentitySnapshot` | `journey-identity.test.ts`, `journey-identity-controller.test.ts`, `journey-identity.test.tsx` |
| Actor/mode/generation change isolates the prior session; stub reset keeps UNKNOWN | `JourneyIdentityController.switchContext`/`resetSource`, isolated journal | `journey-identity-controller.test.ts` (reset keeps unknown fenced) |
| A receipt/read of another context is never evidence | foreign verdicts, `EVIDENCE_FOREIGN` source rejection | both adapter suites and the screen test |
| A read is never shown as proof of payment/issuance/admission | five non-claim fields, whole-payload refusal | `claims-proof` scenario tests |

## Scenarios

`clean`, `empty`, `stale` (watermark behind floor), `foreign-mix` (mode/domain/tuple/actor/session rows), `older-cut` (older- and newer-cut rows), `claims-proof` (whole read refused), `attach-lost` (answer lost, late result deliverable), `held-response`. The synthetic controls (`rotateCut`, `deliverHeld`, `deliverLate`, actor/role switch, source reset) stand in for events a real producer would cause; a real producer offers none of them.

## Hold

The real node is `c-journey-identity` (contract_change=YES, user merge). This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. A real browser pass against a producer stays unverified by design, since no live environment exists for this stub scope.

## Tests

`packages/protocol-adapter/test/journey-identity.test.ts` covers the context key, the adjudicator verdicts, the refs, every scenario, the attach rejections, the tuple change, and the not-bound port. `packages/protocol-adapter/test/journey-identity-controller.test.ts` covers the fences, the unknown/late/quarantine rules, context switch and source reset isolation, and the generation-moved read. `apps/web/test/journey-identity.test.tsx` covers the rendered states, the verdict markup, the off controls' reasons, and the registry row.
