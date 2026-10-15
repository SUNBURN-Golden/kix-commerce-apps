# Platform operational qualification stub apps bind

This bind is the stub-scoped operational qualification screen at `/qualification`. It is the synthetic reduction of pending node `c-platform-operational-qualification` (plan revision 2026-10-13, 준태님 승인): the real platform, finance, and marketing operational qualification stays pending on that node, which is not promoted and stays in `docs/aiops/PENDING_NODES.json`, and which waits on `kix-protocol:ps-07-scale-qualification`, `kix-protocol:cr-10-credit-qualification`, and the unpromoted `commerce-integration-closeout`. This node composes the sibling synthetic sources — the platform trade page, the provider checkout page, the installable mobile shell, and the marketplace scale bench — through their own controllers into one recorded qualification packet and one set of real-user review candidates. It is not a service qualification, not a real-user review, not a public deployment approval, not a real-money approval, and not a producer qualification receipt, and it does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). This delivery is the uncommitted diff on `agent/kixc-c-platform-operational-qualification-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no provider, device, or marketplace call. Its run executes fourteen deterministic journeys in-process against fresh synthetic sources; each journey's writes land on that sibling's own synthetic source through its own controller, once per leg. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`QUALIFICATION_NOT_COMPOSED` is the journey list plus `refund_ticket`), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`QUALIFICATION_HOLD_NOT_BOUND` quotes the locked binding). `prepare_trade` is not mapped onto it.

On `integration-http` the run is `not-bound`: no current producer tuple exists for operational qualification because the pending node is not promoted, the two kix-protocol qualifications are not merged, `commerce-integration-closeout` is unpromoted, and the contract-only catalogue has no qualification command. There is no stub fallback, no third adapter, and no request. The not-bound check in each packet drives the integration-http twins of the four exercised surfaces and records that every call answers `not-bound`.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Normal, rejection, STALE, UNKNOWN, cancellation, refund, recovery, permission-revocation exercised | `QUALIFICATION_CLASSES` names the eight classes; each exercised journey records exercises on its own class, and the packet covers all eight | `packages/protocol-adapter/test/operational-qualification.test.ts` (class coverage), `operational-qualification-controller.test.ts` |
| Source, device, provider, rights, finance unresolved on separate denominators | `QUALIFICATION_DENOMINATORS` keeps five area tables, each with its own item count; the areas are never merged into one readiness figure | `operational-qualification.test.ts` (denominator shape), `operational-qualification.test.tsx` |
| Operations support, incident handoff, and current UI review material bundled | `qualificationOpsBundle` names the handoff packet's diagnoses (UNKNOWN, NOT_BOUND, STALE, REJECT kept separate), the pending-producer list, and the fixture-catalogue material; `QUALIFICATION_REVIEW_CANDIDATES` is the candidate list and stays `candidate` | `operational-qualification.test.ts` (ops bundle, candidates), `operational-qualification.test.tsx` |
| Qualification packet and real-user review candidate | the packet carries journeys, exercises, denominators, evidence, candidates, pins, promotion, and non-claims; its only state word is `STUB_RUN_RECORDED` | `operational-qualification.test.ts` (packet shape, state word) |
| Functional, performance, security, environment evidence per scope | `QUALIFICATION_EVIDENCE_SCOPES` orders the four scopes; rows carry basis `executed`, `reused`, or `unverified` | `operational-qualification.test.ts` (evidence scopes), `operational-qualification.test.tsx` |
| A per-call success is not an end-to-end journey close | a journey verdict computes from the terminal state of the whole leg sequence: the rival-channel journey is `open` though its booking confirmed, and the declined provider journey is `open` though its begin confirmed | `operational-qualification.test.ts` (per-call is not e2e) |
| No identity leak across post-hoc results and actor switches | the runner drives a context switch mid-flight on the platform journey and records the quarantine; the run controller drops the packet, marks the in-flight run `UNKNOWN` (`CONTEXT_SWITCHED`), and quarantines its late answer | `operational-qualification-controller.test.ts` (switch, quarantine, earlier-context fence) |
| Qualification never promotes to public deploy or real-money approval | `promotion` stays all-false; every non-claim is a literal `false`; a packet that claims one is refused whole (`refuseQualificationPacket`) and leaves the run `UNKNOWN` | `operational-qualification.test.ts` (non-claims, refusal), `operational-qualification-controller.test.ts` (claims-pass scenario) |

The spec asks for a real operational qualification over real producer connections. None exists — `c-platform-operational-qualification` is pending — so the runner is synthetic, every journey is a stub-scope record, and the unresolved items stay on their own denominators as unverified. That is the stub scope this node was reduced to, and the deviation the spec already records.

## The synthetic runner

`packages/protocol-adapter/src/operational-qualification.ts`. A run re-executes the whole matrix against fresh stub sources, so two runs of the same port produce identical packets apart from the packet id. There is no clock, no randomness, and no network: `generatedAt` is a fixed label and `packetId` is a serial.

The fourteen journeys: a clean platform trade (read, book, transfer), the same trade under a rival channel (transfer rejected `VERSION_STALE`), a stale platform read that fences the write, a platform transfer whose answer is lost then delivered late (recorded evidence only, the right stays fenced `unknown-outcome`), a platform write in flight across an actor switch (quarantined), the full provider checkout (begin, return, report, observe, issue, refund record), the declined provider checkout (`PAYMENT_DECLINED`, issue fenced `payment-unobserved`), the unqualified account (fenced `account-unqualified`), the claim-refused provider read, the mobile order withdrawal, the mobile offline recovery (offline read, restore replays nothing, resume fences writes until an explicit read), the mobile confirm whose answer was lost, the marketplace permission revocation and restore (denied while revoked, a fresh read and a new page after restore), and the lapsed queue admission (expired grants nothing and is never revived).

The scenarios are `clean`, `held` (the run answer waits for `deliverHeld`), `read-lost` (the run answer never arrives), and `claims-pass` (the packet claims a promotion; the controller leaves the run `UNKNOWN` `UNTRUSTED_PACKET`). The port checks the pin tuple before running (`checkDiscoveryReadTuple`); a drifted tuple answers `tuple-changed` before any journey runs.

## The controller

`packages/protocol-adapter/src/operational-qualification-controller.ts` holds the context key (`environment | domain | actorRef | incarnation`), the intent fence, and the outcome reducer.

| Event | What the controller does |
| --- | --- |
| A run while another is in flight | `FENCED` `in-flight`. One run at a time. |
| A repeated intent ref | `FENCED` `duplicate-intent`. The page mints no intent for you. |
| A run while an earlier run is unknown | `FENCED` `unknown-outcome`. Runs stay blocked; nothing retries the unknown run. |
| A lost, cut-off, mis-correlated, or thrown answer | `UNKNOWN` on the intent, and every later run is fenced. |
| A packet that fails `refuseQualificationPacket` | `UNKNOWN` `UNTRUSTED_PACKET`. The packet is not stored. |
| A tuple-changed or invalid answer | `NOT_SENT`; the run stays a draft and is counted. |
| `switchContext` | New actor and incarnation; the held packet is dropped, an in-flight run becomes `UNKNOWN` (`CONTEXT_SWITCHED`), and its late answer is quarantined (`QUARANTINED`, `context-changed`). |
| `not-bound` environment | `FENCED` `not-bound` before the port; `sent` stays zero. |

There is no retry, no idempotency key, no polling, and no stub fallback. A run is sent once per intent.

## Screen

`apps/web/src/operational-qualification.ts` holds the hook and the pure view builders. `apps/web/src/pages/OperationalQualificationPanels.tsx` renders them, and `apps/web/src/pages/OperationalQualification.tsx` composes the page. The sections are the banner, controls (scenario select, run once, deliver held, switch actor, new session), status, the packet summary (state word, counts, pin tuple, promotion, non-claims), the journeys with every recorded leg, the exercise-class table, the five denominators, the four evidence scopes, the review candidates, the operations bundle, and the session record.

Every state prints a word, not only a color: the status region carries a `StatusMark` word and `role="status"`, journey verdicts print `closed`, `open`, or `blocked`, exercise rows print `recorded` or `deviation`, and evidence rows print their basis (`executed`, `reused`, `unverified`). A fenced, rejected, unknown, or quarantined last result moves focus to the status region through the model's `lastNeedsFocus`. The run control stays focusable through `aria-disabled` with its fence reason in a named paragraph. The banner prints `SYNTHETIC`. The page posts nothing, calls no `fetch`, keeps nothing in web storage, and sets no timer. It computes no amount, no readiness score, and no merged denominator.

## Contract fixture rows

The screen is registered as `platform-operational-qualification` in `contract-fixtures.ts` with eight synthetic rows: `per-call-not-e2e` (`VERSION_STALE`), `untrusted-packet` (`CLAIM`), and `permission-revoked` (`PERMISSION_REVOKED`) as `REJECT`; `run-lost`, `context-switch` (`CONTEXT_SWITCHED`), and `denominator-unresolved` as `UNKNOWN`; and `stale-read` and `tuple-changed` (`TUPLE_CHANGED`) as `STALE`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Browser run

`npm run dev` in `apps/web`, then open `/qualification`. The page starts with no run; the run control sends one qualification run; the scenario select restarts a synthetic session; the actor switch quarantines an in-flight result. Keyboard: every section is anchored in the page nav, every off control stays focusable with its reason one element away, and a result that needs attention moves focus to the status region.

## Hold

No production deploy, no public host, no real payment, no real KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, and no real-user review was run. No SLO is stated. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The five pins stay where the gate bind put them. The packet this page records is a synthetic `STUB_RUN_RECORDED` record: a per-call confirmed is never an end-to-end journey close, and the packet is never promoted to a public deployment, a real-money approval, a service qualification, or a completed real integration.

## Tests

`packages/protocol-adapter/test/operational-qualification.test.ts` covers the packet shape, the class coverage, the separate denominators, the per-scope evidence, the non-claims and promotion refusal, the locked-binding records, the pin tuple, determinism, the not-bound port, the tuple-changed refusal, and the forbidden-token source checks. `packages/protocol-adapter/test/operational-qualification-controller.test.ts` covers send-once, the fences, the unknown path, the context-switch quarantine, the untrusted-packet path, not-bound, invalid intents, tuple-changed, and subscriber notification.

`apps/web/test/operational-qualification.test.tsx` renders the page, checks the packet sections and the non-claim wording, checks the fences and the status words, and asserts the README and fixture documentation entries.
