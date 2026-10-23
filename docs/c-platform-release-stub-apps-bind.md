# Platform release stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped release candidate and user review screen at `/release`. It is the synthetic reduction of pending node `c-platform-release` (plan revision 2026-10-13, 준태님 승인): the real final review, user acceptance, RELEASE gate, and operations handoff stays pending on that node, which is not promoted and stays in `docs/aiops/PENDING_NODES.json`, and which waits on the external `kix-protocol:k-platform-release` and the user RELEASE decision. This node assembles one release candidate packet: the producer/consumer source, the synthetic artifact descriptor, and the config tuple pinned under the live tuple key; the sibling qualification record re-run as technical evidence only; the install, publish, and operate decisions presented and never taken; the support, incident, privacy, accessibility, and update/rollback handoffs; and the deferred scope and unresolved items on five separate denominators. It is not a release, not a public deployment, not a real-money approval, not real operations, and not a real-user acceptance, and it does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). This delivery is the uncommitted diff on `agent/kixc-c-platform-release-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no release, deploy, or provider call. Its run re-pins the live tuple, re-executes one sibling qualification run through `OperationalQualificationController` over a fresh stub runner as technical evidence, and assembles the packet in-process. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`RELEASE_NOT_COMPOSED` is the shared not-composed list), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`RELEASE_HOLD_NOT_BOUND` quotes the locked binding). `prepare_trade` is not mapped onto it.

On `integration-http` the run is `not-bound`: pending node `c-platform-release` is not promoted, `kix-protocol:k-platform-release` is not merged, the RELEASE gate has not run, the user RELEASE decision is not taken, and the contract-only catalogue has no release command. There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Producer/consumer current source, artifact, and config tuple pinned | `packet.candidate` records both OpenAPI pins, merge and feature SHAs, the source contract sha, domain, and pinned action count; the consumer working-tree descriptor (the exact SHA stays the reviewer's PR record), the synthetic artifact descriptor with `digest` null and `deployed` false, and the config tuple (stub default, loopback-only base, one attempt, no retry, no idempotency key, no redirect following, no stub fallback, no proxy, production/truth flags false, runtime not enabled) | `packages/protocol-adapter/test/platform-release.test.ts` (candidate tuple), `platform-release.test.tsx` |
| Approval for a different UI or contract is never reused | `candidate.tupleKey` is the live tuple key at build time; `refuseReleasePacket` refuses whole any packet whose recorded tuple key differs from the live tuple, and the `tuple-changed` outcome stops a run when the pin tuple drifts | `platform-release.test.ts` (approval scope, tuple-changed), `platform-release-controller.test.ts` |
| Technical qualification is distinct from real user acceptance | `packet.qualification` is the executed sibling run record (`technicalOnly`, `acceptanceSeparated`); `packet.userAcceptance` stays `PENDING_USER_DECISION` with `realUserAcceptance` false; a packet that merges or decides them is refused whole | `platform-release.test.ts` (separate records, refusal), `platform-release.test.tsx` |
| Install, publish, operate presented; none taken | `RELEASE_DECISIONS` carries `install` as `awaiting-user-decision` on the verified stub scope and `publish`/`operate` as `not-open` with their blockers; any decided value is refused whole | `platform-release.test.ts` (decisions), `platform-release.test.tsx` |
| Support, incident, privacy, accessibility, update/rollback handoffs | `releaseOpsHandoff` keeps the five lanes: the handoff packet's diagnoses (UNKNOWN, NOT_BOUND, STALE, REJECT kept separate) and its `PENDING_PRODUCERS` list (the screen renders the count from the module itself), the redacted receipt export and session consent flags, the accessibility baseline, and the page-load update/rollback record | `platform-release.test.ts` (handoff lanes), `platform-release.test.tsx` |
| Deferred scope and unresolved items on the final denominators | `RELEASE_DENOMINATORS` keeps five area tables — scope, acceptance, environment, operations, gate — each with its own item count; the areas never merge into one readiness figure | `platform-release.test.ts` (denominator shape), `platform-release.test.tsx` |
| No public deploy, real money, or real operations before the user RELEASE decision | `release` stays all-false; every non-claim is a literal `false`; a packet that claims one is refused whole (`refuseReleasePacket`) and leaves the run `UNKNOWN` | `platform-release.test.ts` (non-claims, refusal), `platform-release-controller.test.ts` (claims-pass scenario) |

The spec asks for a real final review and operations handoff over real producer connections. None exists — `c-platform-release` is pending — so the runner is synthetic, every record is a stub-scope record, and the deferred and unresolved items stay on their own denominators as unverified. That is the stub scope this node was reduced to, and the deviation the spec already records.

## The synthetic runner

`packages/protocol-adapter/src/platform-release.ts`. A run re-pins the live tuple and re-executes the sibling qualification run against a fresh stub runner, so two runs of the same port produce identical packets apart from the packet id and the derived candidate id. There is no clock, no randomness, and no network: `generatedAt` is a fixed label and `packetId` is a serial.

The scenarios are `clean`, `held` (the run answer waits for `deliverHeld`), `read-lost` (the run answer never arrives), and `claims-pass` (the packet claims a release and a user acceptance; the controller leaves the run `UNKNOWN` `UNTRUSTED_PACKET`). The port checks the pin tuple before running (`checkDiscoveryReadTuple`); a drifted tuple answers `tuple-changed` before the packet builds.

## The controller

`packages/protocol-adapter/src/platform-release-controller.ts` holds the context key (`environment | domain | actorRef | incarnation`), the intent fence, and the outcome reducer.

| Event | What the controller does |
| --- | --- |
| A run while another is in flight | `FENCED` `in-flight`. One run at a time. |
| A repeated intent ref | `FENCED` `duplicate-intent`. The page mints no intent for you. |
| A run while an earlier run is unknown | `FENCED` `unknown-outcome`. Runs stay blocked; nothing retries the unknown run. |
| A lost, cut-off, mis-correlated, or thrown answer | `UNKNOWN` on the intent, and every later run is fenced. |
| A packet that fails `refuseReleasePacket` | `UNKNOWN` `UNTRUSTED_PACKET`. The packet is not stored. |
| A tuple-changed or invalid answer | `NOT_SENT`; the run stays a draft and is counted. |
| `switchContext` | New actor and incarnation; the held packet is dropped, an in-flight run becomes `UNKNOWN` (`CONTEXT_SWITCHED`), and its late answer is quarantined (`QUARANTINED`, `context-changed`). |
| `not-bound` environment | `FENCED` `not-bound` before the port; `sent` stays zero. |

There is no retry, no idempotency key, no polling, and no stub fallback. A run is sent once per intent.

## Screen

`apps/web/src/platform-release.ts` holds the hook and the pure view builders. `apps/web/src/pages/PlatformReleasePanels.tsx` renders them, and `apps/web/src/pages/PlatformRelease.tsx` composes the page. The sections are the banner, controls (scenario select, assemble once, deliver held, switch actor, new session), status, the packet summary (state word, release record, non-claims), the candidate tuple (producer pins, consumer descriptor, artifact, config), the qualification record and the user-acceptance line, the three decisions, the five handoff lanes, the five denominators, the binding-integrity checks, and the session record.

Every state prints a word, not only a color: the status region carries a `StatusMark` word and `role="status"`, decision rows print `awaiting-user-decision` or `not-open`, denominator lines print their own item count, and check rows print `recorded` or `deviation`. A fenced, rejected, unknown, or quarantined last result moves focus to the status region through the model's `lastNeedsFocus`. The run control stays focusable through `aria-disabled` with its fence reason in a named paragraph. The banner prints `SYNTHETIC`. The page posts nothing, calls no `fetch`, keeps nothing in web storage, and sets no timer. It computes no amount, no readiness score, and no merged denominator.

## Contract fixture rows

The screen is registered as `platform-release` in `contract-fixtures.ts` with six synthetic rows: `untrusted-packet` (`CLAIM`) and `approval-reused` (`TUPLE`) as `REJECT`; `decision-pending`, `run-lost`, and `context-switch` (`CONTEXT_SWITCHED`) as `UNKNOWN`; and `tuple-changed` (`TUPLE_CHANGED`) as `STALE`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Browser run

`npm run dev` in `apps/web`, then open `/release`. The page starts with no run; the run control sends one release run; the scenario select restarts a synthetic session; the actor switch quarantines an in-flight result. Keyboard: every section is anchored in the page nav, every off control stays focusable with its reason one element away, and a result that needs attention moves focus to the status region.

## Hold

No release, no production deploy, no public host, no real payment, no real KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, and no real-user acceptance was run or taken. No SLO is stated. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them. The packet this page records is a synthetic `STUB_CANDIDATE_RECORDED` record: an approval under a different source or contract tuple is never reused, technical qualification is never real user acceptance, and no decision is taken before the user RELEASE decision.

## Tests

`packages/protocol-adapter/test/platform-release.test.ts` covers the candidate tuple pin record, the qualification/acceptance separation, the three presented decisions, the five handoff lanes, the five denominators, the non-claims and release refusal, the approval-scope refusal, the malformed-packet refusals, the locked-binding records, determinism, the not-bound port, the tuple-changed refusal, the fixture rows, and the forbidden-token source checks. `packages/protocol-adapter/test/platform-release-controller.test.ts` covers send-once, the fences, the unknown path, the context-switch quarantine, the untrusted-packet path, not-bound, invalid intents, tuple-changed, and subscriber notification.

`apps/web/test/platform-release.test.tsx` renders the page, checks the packet sections and the non-claim wording, checks the fences and the status words, and asserts the README and fixture documentation entries.
