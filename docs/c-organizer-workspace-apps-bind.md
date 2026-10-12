# Organizer workspace apps bind

This bind is the organizer workspace at `/organizer/workspace`. It edits the caller fields the six published lifecycle commands already accept, previews each command, and sends one command at a time through the page-load `OrganizerConsole` shared with `/organizer`. It adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical.

## What the page edits

The change list is local. A row is one command: `create_event`, `close_sales`, `open_admission`, `complete_event`, `cancel_event`, or `issue_invitation`. The preview shows the action, the actor, and the body `previewOrganizerStep` builds. That body is the body a later send posts. The operation id is minted by the desk at send time. The preview only checks that the id the desk would mint is within 100 characters.

`reservationSeconds` is sent on `create_event` only when the caller typed a canonical integer. A blank field is omitted. The page does not default it. `admissionStatus`, `issuerId`, and `sessionId` stay unsent. Seats, the invitation quota, the inventory id, and the expected inventory version stay caller-typed. A receipt does not increment the version.

Inventory ids copied from a `create_event` receipt are labelled as receipt ids. They are not a capacity figure. The page does not read remaining capacity, sales, or inventory, and it does not import `listPerformances`.

## What stays unconnected

| Topic | Why it stays unconnected |
| --- | --- |
| Edit after `create_event` | No published update command. The draft is local until a listed command is sent |
| Date, time, and venue | No published field carries them |
| Capacity, sales, and inventory read | No published read. Typed seats are caller input. The gate decides inventory |
| Settlement and funds | No funds. This page does not post a settlement command |
| Role or permission semantics | The actor string is not an authentication result |

`ORGANIZER_NOT_COMPOSED` still records `capture`, `settle_capture`, `commit_trade`, and `admit`. `placeHold` stays not-bound with `consideredAction` `reserve_listing`. This page does not map `placeHold` onto `prepare_trade`, and it does not compose `prepare_trade`.

## Submit

Prepare builds a local plan. Editing the change list after that marks the plan out of date and disables Submit. Submit runs the plan once. A second call returns the same promise. There is no run again. A new plan is a new list.

Each row is checked again at submit. If the desk row, the halt, or the body changed, the result is `STALE` and nothing is sent for that row. Otherwise the shared desk sends it. A halted console still returns `FENCED`. After the first result that is not `RECEIPT`, later rows are `NOT_ATTEMPTED`.

The summary is a count line. It is not a completion badge. `UNKNOWN` stays apart from `REJECTED`. A gate code is shown verbatim. The page does not map a code onto a role.

A duplicate row (the same event and step, or the same inventory id on `issue_invitation`) is blocked and is not sent.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

Stub-shape receipts are fixed literals, not gate receipts. The browser success path is that stub. A real `REJECTED` or `UNKNOWN` from the gate is covered by the Node tests, not by the browser. `KIX_REQUIRE_GATE=0` skips the live-gate suites. That skip is not a pass.

## Tests

`apps/web/test/organizer-workspace.test.tsx` covers the page, the partial rejection, the stale selection, the duplicate block, the single-use submit, the typed version, and the bad integer. `packages/protocol-adapter/test/organizer-console.test.ts` checks that the preview body equals the sent body and that a blank `reservationSeconds` is omitted. The organizer desk and panel suites stay as they are. The registry test drops `c-organizer-workspace` from the planned task list.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was Vite at `http://127.0.0.1:5188`. The HTTP desk was a second Vite at `http://127.0.0.1:5190` with `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE` set to a closed `http://127.0.0.1` port. No page error. The page text did not include a loopback URL.

| State | Observed |
| --- | --- |
| Empty change list | Submit disabled. The atomic-request sentence, the ruling, and the stub-shape sentence were on the page. The first Tab moved focus to a navigation link. |
| Ready preview for event id `show-browser-ok`, seat `A1` | The preview showed `create_event`, actor `operator`, and state `ready`. |
| Enter, then Enter again, on that prepared form | One receipt. Summary `1 receipt`. The receipt note said it was not from the gate. Focus moved to the results heading. A second receipt did not appear. |
| Non-canonical quota `1.5` on `show-browser-bad` | The preview state was `invalid` and named an integer. Submit reported `1 not sent`. |
| Two `create_event` rows for `show-browser-dup` | The preview blocked the second row as a duplicate. Submit reported `1 receipt, 1 fenced`. |
| Prepared `close_sales` for `show-browser-stale`, then the shared desk halted on a bad `create_event` | Submit reported `1 stale` and "Stale selection". The row did not say UNKNOWN. |
| `/organizer` after those sends | The existing console still rendered, including `Send create_event`. |
| Integration HTTP against a closed loopback port | The alert said the organizer path is unavailable and the desk does not fall back to the stub. The fieldset was disabled. The stub-shape sentence was not on the page. |

Two states were not reached in the browser. The stub resolves immediately, so an in-flight row was not visible; `organizer-workspace.test.tsx` renders that state while a deferred promise is pending. The stub does not produce a real `REJECTED` or `UNKNOWN`. Those outcomes are the Node tests. With `KIX_PROTOCOL_ROOT` pointed at the pinned merge `52a9b5cbf7777df55d2d2062cb8d99d862b423bb`, `KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter` passed, including `organizer-console-gate.test.ts`. That run is the live gate. The browser was not pointed at it. A local run with `KIX_REQUIRE_GATE=0` skips those suites. That skip is not a pass.
