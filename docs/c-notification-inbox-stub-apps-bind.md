# Notification inbox stub apps bind

This bind is the stub-scoped notification inbox at `/notifications`. It is the synthetic reduction of pending node `c-notification-inbox`: the real connection stays pending on `kix-protocol:k-operator-contract`, and the pending node stays unimplemented. This node wires the notification seam — a feed of producer-contracted event kinds only, dedupe on the source's own key, read state, notification grants with generations and revocation, watermark and generation currentness, sensitive detail shown only under `read-sensitive`, offered actions that move the person to the current authority query or the support material, and the redacted inquiry material itself — onto a deterministic synthetic source. It is not a producer connection and does not claim one, an arrival confirms no economic effect, and a hidden control is never enforcement: the source checks every read, inquiry, and request on its own, and the tests send calls straight to the port to prove the screen is not the boundary.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `ca55b9c8b97304f7d5efdf5eb683c88ad72acba6`. This delivery is the uncommitted diff on `agent/kixc-c-notification-inbox-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no external notification send. Its read, its one inquiry call, and its two request kinds — mark-read and resolve — land on an in-process synthetic source, which is a stand-in for the producer. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`NOTIFY_NOT_COMPOSED` reuses the platform record), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`NOTIFY_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read, the inquiry, and the requests are `not-bound`: "No current producer tuple exists for the notification inbox: kix-protocol:k-operator-contract is not merged and pending node c-notification-inbox is not promoted. The contract-only catalogue has no notification read, no dedupe or read-state command, no offered-action resolve, and no support-inquiry command. The inbox stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Only producer-contracted event kinds reach the inbox | `NOTIFY_EVENT_KINDS` stands in for the merged producer contract; `refuseNotification` answers any other kind with `UNCONTRACTED` and the whole payload is refused | `packages/protocol-adapter/test/notification-inbox.test.ts` (kind-uncontracted) |
| Dedupe on the source's own key | `dedupe` in `notification-inbox.ts` keeps the first delivery by seq, drops the second, and counts the drop on the snapshot | `notification-inbox.test.ts` (duplicate), `notification-inbox.test.tsx` (dropped once, counted) |
| Read/unread state | `mark-read` flips read state at the source; a second mark is rejected `ALREADY_READ`; the snapshot reports the source's own unread count | `notification-inbox.test.ts` (marks a notification read), the controller suite |
| Currentness: watermark, grant generation, stale issue | `watermarkFloor`/`stale`, `grantFloor`/`generation-stale`, and `issueState` per row (`stale-issue` keeps the row, its offered action resolves nothing) | `notification-inbox.test.ts` (stale, generation-stale, late), `notification-inbox-controller.test.ts` |
| Tenant and subject scope is decided at the adapter boundary | the `gate`, `inboxFor`, and `focusFor` in `notification-inbox.ts`; a row of another tenant or another subject refuses the whole payload, and a direct open of one is denied | `notification-inbox.test.ts` (tenant-mix, subject-mix, direct open), `notification-inbox.test.tsx` |
| Notification grants, revocation, and generations | `SEED_GRANTS`, `generations`, `revoked`, and the `revoke-grant`/`rotate-grant`/`deliver-late` synthetic controls; every request carries the grant generation its read reported | `notification-inbox.test.ts` (denied, grant-rotated, GENERATION_STALE), both suites |
| Sensitive detail is withheld unless the role holds read-sensitive | `rowFor` withholds; a payload that sends it anyway is refused `SENSITIVE_LEAK`; inquiry lines are refused on a sensitive token | `notification-inbox.test.ts` (sensitive detail, inquiry-leak), `notification-inbox.test.tsx` |
| From a notification to the authority query or support material | `resolve` yields a destination — `open-authority` maps to the receipts desk, `open-support` maps to `readInquiry`; a resolve is a move, never a send | `notification-inbox.test.ts` (destinations), `notification-inbox.test.tsx` (authority link, support material) |
| An arrival confirms no economic effect and wires no external send | `NOTIFY_NON_CLAIM_FIELDS` state seven falses or the payload is refused; the receipt carries `confirmsEconomicEffect`/`externalSendWired` false or is refused | `notification-inbox.test.ts` (claims-arrival, external-wired, resolve-claims), `notification-inbox.test.tsx` |
| UI hiding is tested apart from the port's own checks | the page's `ControlModel` reasons are display; `notification-inbox.test.ts` calls `port.read`, `port.readInquiry`, and `port.act` directly with no screen | `notification-inbox.test.ts` (denied, revoked grant, sensitive leak), `notification-inbox.test.tsx` |
| UNKNOWN, NOT_BOUND, STALE, REFUSED, DENIED, and INVALID stay separate | the read, inquiry, and act outcome unions; a lost answer fences the session and a read does not lift the fence | all three suites |

The spec asks for a real notification producer. No notification read, dedupe, read-state, resolve, or inquiry command exists in this repository (`c-notification-inbox` is pending on `kix-protocol:k-operator-contract`), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to.

## The synthetic source

`packages/protocol-adapter/src/notification-inbox.ts`. State lives in the object, so a new port is a new session. The desk shares the tenants and people of the permissions sibling: `ten-0001` the desk's own and `ten-0002` a foreign one whose actor reads only its own rows. A notification grant is its own record (`ngr-` refs), separate from the desk's role assignment, and it carries a generation the source can rotate or revoke. The seed feed lists thirteen notifications across the four actors plus one foreign row that is never served to this desk.

A notification row carries its notification ref, tenant, the one subject it is addressed to, the contracted event kind, the source's own `dedupeKey`, a seq, the grant generation it was issued under, the issued instant, a read flag, a sensitive flag, the headline, the detail (shown or withheld), the issue state, and the offered action or none. `inquiry-ready` and `hold-expiring` exist as contracted kinds; `blast-uncontracted` exists only inside the `kind-uncontracted` scenario, which is refused.

Five capabilities stay separate: `read-inbox`, `mark-read`, `resolve-action`, `read-sensitive`, `read-inquiry`. Every role on the desk reads its own inbox, marks read, resolves, and reads the material; only organizer, settler, and support hold `read-sensitive`. The withheld detail never leaves the source: `rowFor` sends `detail: null` and `detailState: "withheld"`, and a payload that leaks it is refused whole.

The support material (`nqy-` refs) is the source's own file. It declares `provenance: synthetic`, `realPersonalData: false`, `deliveredExternally: false`, and `authorityRecord: false`, or the payload is refused, and every line passes the sensitive-token check or the payload is refused. The material belongs to one subject in one tenant; a read for another subject's or another tenant's inquiry is denied.

A read outcome is `ready`, `empty`, `stale`, `generation-stale`, `denied`, `refused`, `invalid-request`, `tuple-changed`, `not-bound`, or `unknown`. A request outcome is `applied`, `rejected` (`NO_CAPABILITY`, `GENERATION_STALE`, `STALE_ISSUE`, `UNKNOWN_NOTIFICATION`, `ALREADY_READ`, `OFFER_MISSING`, `UNKNOWN_INQUIRY`), `denied`, `refused`, `invalid-request`, `tuple-changed`, `not-bound`, or `unknown`. `STALE_ISSUE` is the answer a stale-issued notification's resolve gets: the check is the source's own, and the action never skips it.

## The controller

`packages/protocol-adapter/src/notification-inbox-controller.ts` holds the context key, the read and inquiry reducers, and the request fence.

| Event | What the controller does |
| --- | --- |
| A read or an inquiry that arrives for an older context | Dropped. It never touches the current view. |
| A read or an inquiry older than a newer applied one | Dropped. |
| A read that stops being ready (stale, generation-stale, denied, refused, invalid, tuple-changed, unavailable) | Rows, the assessment, the focus, and the inquiry material are cleared. Nothing stale stays on screen. |
| `switchTenant`, `switchActor`, `switchRole` | A new context at the next incarnation. The earlier rows and material are cleared, an answer in flight for them is dropped, and their earlier unknown outcomes are counted, not forgotten. |
| A request the read cannot support | `NOT_SENT` with the reason (`not-bound`, `no-snapshot`, `stale-read`, `blocked`, `no-capability`, `unknown-ref`). The port is never called. A stale-issued row's resolve is `blocked`. |
| A request built under a grant generation the source moved past | `GENERATION_STALE` at the source. The request carried the generation its read saw. |
| A recorded or rejected request | The view is marked behind. The rows on screen stay the last read's until the next read. |
| A request whose answer never arrived or arrived untrusted | `UNKNOWN`. It may have been recorded, every later request in that context is fenced, and a read does not lift the fence. |
| An inquiry that lands after the read stopped being ready | Dropped (`read-not-ready`). The view holds no material. |
| A thrown or cut-off read or inquiry | `unavailable`. It is not sent again. |

There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. A started synthetic session is the page-load equivalent of a reload.

## Screen

`apps/web/src/notification-inbox.ts` holds the hook and the pure view builders. `apps/web/src/pages/NotificationsPanels.tsx` renders them, and `apps/web/src/pages/Notifications.tsx` composes the page. The sections are the banner and controls, status, who may do what, the deep-opened notification, the inbox, the support material, requests, and the session record. The inbox lists only the notifications the source addressed to this subject in this tenant; anything else stays absent, not hidden.

Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. When many controls share one reason — the mark-read and resolve blocks — the page prints it once and each control points at it. A stale-issued row keeps a blocked resolve whose reason says it resolves nothing under an older generation. A note that needs attention, a read the source refused, denied, found stale or generation-stale, or did not answer, and an inquiry it refused or denied move focus to the status region through the model's `focusToken`. The scenario, actor, and role pickers apply only on their own buttons, so moving through the list with the arrow keys resets nothing. A typed reference is a direct open — the page's stand-in for a typed URL — and the source answers it on its own check. The banner prints `data-source="synthetic-notification-inbox"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The resolved destination renders as a move: `open-authority` shows a link to the receipts desk carrying the reference text, and `open-support` shows the guarded control that loads the source's material. Neither is a send.

The hook starts a read when the page opens, one read after a tenant, actor, or role switch, and again only when the person asks. Nothing polls and nothing sets a timer.

## Contract fixture rows

The screen is registered as `notification-inbox` in `contract-fixtures.ts` with twelve synthetic rows: `stale-read`, `late-stale-issue`, and `generation-stale` as `STALE`; `tenant-mix`, `subject-mix`, `duplicate-dropped`, `permission-revoked`, `uncontracted-kind`, `sensitive-leak`, and `arrival-claim` as `REJECT` with their codes; and `write-lost` and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-notification-inbox`, which waits on `kix-protocol:k-operator-contract`. This node consumes no SDK, manifest, or vector and serves no producer. No external send or provider API is wired: the inbox is a projection, not a delivery channel, and a notification confirms no payment, settlement, issuance, or permission grant. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, and no refund. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol.

## Browser run

Not separately recorded for this node: the page is a static React tree over the same in-process port the tests drive, the web suite renders every read state including generation-stale, the foreign tenant's own inbox, the denied and refused direct opens, the stale-issued row's blocked resolve, the dedupe count, the withheld sensitive detail, the loaded and refused support material, the resolved destinations, the unknown-outcome fence, and the not-bound port, and it mounts the `/notifications` route. The browser checks the spec asks for — keyboard reach of the guarded controls, the pickers that apply only on their own buttons, and the focus moves — are covered by the same `aria-disabled`/`aria-describedby`/`focusToken` mechanics the finance, tenant-permissions, and delegated-assistant runs recorded; a real producer stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/notification-inbox.test.ts` covers the reference shapes, the capability table, the grant gate's denial and revocation, the foreign tenant's own read, every payload refusal (tenant mix, subject mix, uncontracted kind, sensitive leak, arrival and external-send claims), dedupe, read state, the late and rotated stale-issue checks, the generation floor, the sensitive detail split, the offered-action resolves and their rejections, the inquiry material's declaration and denial, the synthetic controls, the not-bound port, a changed tuple, and the effect counts. `packages/protocol-adapter/test/notification-inbox-controller.test.ts` covers the context key, dropped reads and inquiries, a tenant, actor, and same-actor role switch that clears the view, the not-sent and not-bound refusals, the stale-issued block, the generation-stale request, the unknown fence that a read does not lift, the serialisation of requests, and the inquiry drops. `apps/web/test/notification-inbox.test.tsx` covers the screen for each state, each role's inbox, the authority table, the direct-open denials with no substitute row, the withheld sensitive detail, the dedupe line, the stale-issue block, the recorded requests with both claims false, the destinations and material, the registry surface, the pending producer row, the fixture rows, the mounted route, and a source scan of the new web modules.
