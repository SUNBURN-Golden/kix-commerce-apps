# Installable mobile stub apps bind

This bind is the stub-scoped installable mobile shell at `/mobile`. It is the synthetic reduction of pending node `c-installable-mobile` (plan revision 2026-10-13, 준태님 승인): the real installable web/mobile packaging, the real producer connection, and the real device session stay pending on that node, which is not promoted and stays in `docs/aiops/PENDING_NODES.json`. This node wires the install and revisit seam — installable-web packaging and in-place update support, a session that reconnects, stored items kept as copies, a link that drops and restores, a device clock that reports but decides nothing, an app resume that re-executes nothing, and a pending order whose confirm and withdraw are separate one-shot writes — onto a deterministic synthetic source. It is not a device attestation, not an authentication result, not a store listing, not a payment, not an admission grant, and not a producer read, and it does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). This delivery is the uncommitted diff on `agent/kixc-c-installable-mobile-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no external store, device, or provider call. Its reads and its six writes — install, update, reconnect, present, confirm, withdraw — land on an in-process synthetic source, which is a stand-in for the shell backend. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent, and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`MOBILE_HOLD_NOT_BOUND` quotes the locked binding reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the writes are `not-bound`: no current producer tuple exists for the installable shell because pending node `c-installable-mobile` is not promoted and the contract-only catalogue has no install, session, vault, presentation, or device command. There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Installable web/mobile packaging support range and update | `MOBILE_SUPPORT_ROWS` marks installable-web packaging `supported`, in-place update `supported`, a native store shell, push, and background sync `unsupported`, and real-device evidence `undetermined`; an update is a source-offered row applied by one write on the expected version | `packages/protocol-adapter/test/installable-mobile.test.ts` (update applies only what is offered), `installable-mobile-controller.test.ts` (no-update fence) |
| Cached read versus current authority | every stored vault item carries `authorityVerdict`, `verdictAt`, and a `currency` word — `current`, `cached`, or `clock-uncertain`; an offline, stale, or unanswered read keeps the snapshot as `cached` and never current authority, and every write stays fenced `snapshot-stale` (`cached-read`) until an explicit read lands | `installable-mobile-controller.test.ts` (offline cached copies, stale watermark, cached copies fenced after restore and after stale or unanswered reads), `installable-mobile.test.tsx` |
| Network loss and reconnect | `dropConnection`/`restoreConnection` on the port; a read answers `offline`, a write answers `unknown` and applies nothing, a restore changes nothing until an explicit read — the held copy keeps its `cached-read` fence | `installable-mobile.test.ts` (offline read and write), `installable-mobile-controller.test.ts` (link-offline fence, cached fence after restore, restore replays nothing), `installable-mobile.test.tsx` |
| Re-login and session change | `switchContext` bumps the incarnation and the actor, drops the snapshot, turns an in-flight write `UNKNOWN` (`CONTEXT_SWITCHED`), and quarantines its late answer; the earlier actor's session and stored copies are not reused | `installable-mobile-controller.test.ts` (context switch, re-login), `installable-mobile.test.tsx` |
| App resume | `resume()` marks the held read `resumed` and sends nothing; every write stays fenced `snapshot-stale` until an explicit read lands | `installable-mobile-controller.test.ts` (resume re-executes nothing), `installable-mobile.test.tsx` |
| Device clock skew | the read carries `deviceNow`; the source compares it with its own authority instant and returns `in-step`, `skewed`, or `unreported`; a skewed or missing clock marks stored verdicts clock-uncertain and decides nothing | `installable-mobile.test.ts` (clock verdict), `installable-mobile-controller.test.ts` (clock-uncertain currency), `installable-mobile.test.tsx` |
| Offline QR/stored screen mints no admission | a stored pass keeps `grantsAdmission: false` in the projection, the vault card prints "grants no admission", and the present write is fenced link-offline | `installable-mobile-controller.test.ts` (offline cached copies), `installable-mobile.test.tsx` |
| App resume replays no uncertain write | an `UNKNOWN` confirm or withdraw stays fenced through resume, refresh, and reconnect; a late result is recorded evidence, never a resolution | `installable-mobile-controller.test.ts` (uncertain write across resume), `installable-mobile.test.tsx` (lost confirm, late result) |
| UNKNOWN, NOT_BOUND, and STALE stay separate | distinct read outcomes (`stale`, `not-bound`, `unknown`), write outcomes, and fences; the model words each differently | all three suites |

The spec asks for a real installable app, a real device session, and real mobile return tests. None exists in this repository — `c-installable-mobile` is pending — so the adapter is the synthetic port, the shell, session, and vault are synthetic records, and real-device evidence stays `undetermined` on the support range. That is the stub scope this node was reduced to, and the deviation the spec already records.

## The synthetic source

`packages/protocol-adapter/src/installable-mobile.ts`. State lives in the object, so a new port is a new session. A snapshot carries the install record (`installRef`, `shellRef`, version, an offered update row or none), the session (`sessionRef`, actor, verdict `active` or `expired`, and a note that an expired verdict is never revived), the vault (stored items each with `vaultRef`, kind `pass` or `receipt`, owner, `cachedAt`, `authorityVerdict`, `verdictAt`), the pending order (`orderRef`, state, version, amount as the source's own text in the synthetic unit `mock-unit` (`MOBILE_UNIT`), `paymentRef`, `withdrawalRef`), the link, the clock view, the environment block, the support range, and the seven non-claims `realPayment`, `fundsMoved`, `admissionGrant`, `rightCreated`, `installVerified`, `productionEnvironment`, `mobileIntegrationComplete`, each literally `false`.

A read outcome is `ready`, `empty`, `stale`, `offline`, `refused` (`CLAIM`, `ENVIRONMENT`), `tuple-changed`, `not-bound`, or `unknown`. A write outcome is `confirmed`, `rejected` (`ALREADY_INSTALLED`, `NOT_INSTALLED`, `NO_UPDATE`, `SESSION_ACTIVE`, `SESSION_EXPIRED`, `PASS_NOT_PRESENTABLE`, `ORDER_NOT_PENDING`, `VERSION_STALE`, `UNKNOWN_REF`, `IDENTITY_MISMATCH`), `unknown` (recorded `RESPONSE_LOST`, `CORRELATION`, `CONTEXT_SWITCHED`, or `UNTRUSTED_RECEIPT` on the intent), `invalid-request`, `tuple-changed`, or `not-bound`. A `confirmed` receipt that does not state every non-claim as `false` is untrusted: the controller records the write `UNKNOWN` (`UNTRUSTED_RECEIPT`).

Writes apply at the source once: install on an empty device, update only what the source offered on the expected version, reconnect only when no active session exists for this actor, present only a presentable stored pass owned by this actor, confirm only a pending order on its expected version, withdraw only an unconfirmed pending order. Every `confirmed` receipt mints its own synthetic refs (`ins-`, `shl-`, `upd-`, `ses-`, `pre-`, `pmt-`, `wdr-`).

The synthetic controls are `dropConnection`, `restoreConnection`, `offerUpdate`, `expireSession`, `deliverHeld`, and `deliverLate`. The scenarios are `clean`, `empty`, `stale`, `update-available`, `session-expired`, `offline`, `production-claimed`, `confirm-lost`, `withdraw-lost`, `held-response`, `read-lost`, `claims-grant`, and `receipt-claims`. The port checks the pin tuple before the first row (`checkDiscoveryReadTuple`); a drifted tuple answers `tuple-changed` on reads and writes alike. The not-bound port answers `not-bound` on every call and accepts no synthetic control.

## The controller

`packages/protocol-adapter/src/installable-mobile-controller.ts` holds the context key (`environment | domain | actorRef | deviceId | incarnation`), the read reducer, the write fence, and the projection.

| Event | What the controller does |
| --- | --- |
| A read answer landing after the context key changed | `DROPPED context-changed`, counted. |
| A read answer older than the newest applied read | `DROPPED older-read`, counted. |
| A read while the link is down | `offline`: the held snapshot stays on screen as cached copies, never current; writes fence `link-offline` while the link is down and `snapshot-stale` (`cached-read`) after it returns. |
| A read behind the floor | `stale`: a held snapshot stays labelled and fences `snapshot-stale` (`cached-read`); with nothing held the fence is `no-snapshot`. |
| A lost or cut-off read | `unavailable`: not an empty device; a held snapshot stays cached and fences `snapshot-stale` (`cached-read`) until an explicit read. |
| The link restored without a new read | Nothing is replayed; the held copy keeps its `cached-read` fence until an explicit read lands current evidence. |
| `resume()` | Marks the held read `resumed`. No write is sent, no write is resolved; everything fences `snapshot-stale` until an explicit read. |
| `switchContext` | New actor and incarnation; in-flight writes become `UNKNOWN` (`CONTEXT_SWITCHED`); their late answers are quarantined. |
| A write while its scope has an in-flight or unknown intent | `FENCED` `in-flight` or `unknown-outcome`. The scope is `shell`, `session`, a vault ref, or an order ref. |
| A repeated intent ref | `FENCED` `duplicate-intent`. The page mints no intent for you. |
| A write while the link is down | `FENCED` `link-offline`. The port is never reached. |
| A `confirmed` receipt missing a non-claim | `UNKNOWN` `UNTRUSTED_RECEIPT`. The write may or may not have applied. |
| `acceptLate` on an unknown write in the current context | `RECORDED` as `late` evidence. The outcome stays `UNKNOWN` and the fence stays. |
| `acceptLate` for another context or a write that is not unknown | `QUARANTINED`. It changes nothing. |

There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload, and an app resume re-executes nothing.

## Screen

`apps/web/src/installable-mobile.ts` holds the hook and the pure view builders. `apps/web/src/pages/InstallableMobilePanels.tsx` renders them, and `apps/web/src/pages/InstallableMobile.tsx` composes the page. The sections are the banner, controls (scenario, reported device clock, read again, resume app, drop and restore connection, offer update, expire session, deliver held, deliver late, re-login, new session), status, link and clock, install and update, session, stored items, the pending order, the support range, the session record, and the identity links.

Loading, empty, stale, offline, refused, environment-refused, not-bound, tuple-changed, and unavailable each print a word, not only a color: the status region carries a `StatusMark` word and `role="status"`, each stored item carries its currency word (`current authority`, `cached copy`, `clock-uncertain`), and every off control stays focusable through `aria-disabled` with its reason in a named paragraph. A fenced, rejected, unknown, or quarantined last result moves focus to the status region through the model's `lastNeedsFocus`. The stored copy note prints on every vault card: a stored copy grants no admission, offline or online, and is never sent as authority. The banner prints `SYNTHETIC`. The page posts nothing and calls no `fetch`, keeps nothing in web storage, and sets no timer.

The hook starts a read when the page opens. One read follows each settled write so the next step can use fresh evidence; nothing polls.

## Contract fixture rows

The screen is registered as `installable-mobile-shell` in `contract-fixtures.ts` with sixteen synthetic rows: `expired-pass` (`PASS_NOT_PRESENTABLE`), `session-expired` (`SESSION_EXPIRED`), `relogin-mismatch` (`IDENTITY_MISMATCH`), `offline-presentation` (`LINK_OFFLINE`), `already-installed` (`ALREADY_INSTALLED`), `order-settled` (`ORDER_NOT_PENDING`), and `claim-refused` (`CLAIM`) as `REJECT`; `offline-write-unknown`, `write-lost`, `late-answer`, `clock-skew`, and `read-lost` as `UNKNOWN`; and `offline-cached`, `resume-replay`, `stale-session`, and `stale-read` as `STALE`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Browser run

`npm run dev` in `apps/web`, then open `/mobile`. The page reads the synthetic source on load; the scenario select restarts a synthetic session; the clock select changes the reported device clock, never the authority. Keyboard: every section is anchored in the page nav, every off control stays focusable with its reason one element away, and a write that needs attention moves focus to the status region.

## Hold

The real connection is `c-installable-mobile`, which stays pending. This node consumes no SDK, manifest, or vector and serves no producer. No real install attestation, no device attestation, no real authentication, no real payment, no credit disbursement, no venue scan, no bank rail, no public host or production deploy, no real KYC, no push, and no background sync. A stored pass copy mints no admission; a confirm record is not a payment; a withdrawal record executes nothing. No SLO and no real-device measurement: browser-only behavior is synthetic and is never reported as mobile evidence. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol.
