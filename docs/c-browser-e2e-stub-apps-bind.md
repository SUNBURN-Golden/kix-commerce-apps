# Browser end-to-end journeys (stub) apps bind

This bind is `apps/e2e`: a headless Chrome suite that drives the desk's eight journeys (box office, booking, admission, resale, credit, gift, organizer, receipts) from the first screen to the last, in stub mode only. It is the stub-scoped reduction of pending node `e2e-browser-journeys`. That pending node stays in `docs/aiops/PENDING_NODES.json`. A real connection waits on its producer prerequisites and becomes a separate follow-up node.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. The suite asserts these on the screens: the not-bound text, the not-composed list, and the absence of any send control for the banned commands.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` do not move, and `packages/protocol-adapter/src/commerce-bindings.ts` and `apps/web/src` are untouched. `contract_change=NO`. The run record and the matrix are app-internal. They are not a public schema, operation, capability, or identifier.

## What it runs

| Step | What happens |
| --- | --- |
| Build | `build.ts` builds a clean production bundle of `apps/web` with the Vite API into a temp directory. Every `VITE_*` variable is removed and `envDir` is an empty directory, so a stray `.env` file or shell variable cannot select HTTP mode |
| Serve | `static-server.ts` serves that directory with `node:http` bound to `127.0.0.1` on a free port. It answers GET and HEAD only (405 otherwise), sends no CORS header, refuses path traversal, and returns the app shell only for an extension-less route. It asserts the bound address after `listen` |
| Browse | `browser.ts` launches the installed Chrome through `playwright-core` (exact version `1.58.2`) with `--no-proxy-server` and a host-resolver rule that maps every host except `127.0.0.1` to nothing. The context blocks service workers and aborts and records any request to another origin. A small init script counts `fetch`, XHR, `sendBeacon`, and `WebSocket` calls made by page scripts |
| Drive | Each journey test uses roles, labels, text, and the existing `id` and `data-status` attributes. After the first load it moves through in-app links, because desk state is module-level and a full load clears it |
| Judge | Waits poll page state. There are no fixed sleeps and no test retries (`retry: 0`), which matches the app's one-attempt rule |

There is no trace, video, or screenshot code. Nothing is uploaded.

## The matrix

`journey-matrix.ts` lists one cell for every journey and outcome. A cell is one of three kinds, and the global teardown fails the run if a cell has no executed check, a `BROWSER` cell has no check id, or a non-`BROWSER` cell has no pointer and owner.

| Journey | SUCCESS | REJECT | UNKNOWN | NOT_BOUND |
| --- | --- | --- | --- | --- |
| box office `/` | Initiate, Authorize, CAPTURED, COMMITTED, Reconcile on the mock settlement case | COMMITTED straight after Initiate shows `ILLEGAL_TRANSITION` and the phase stays INITIATED | not reachable | "Writes happen on the booking screen", placeHold, confirmBooking, and settlementPreview recorded as not bound; no send control |
| booking | Place hold, Confirm ("Simulated — no funds"), then `create_event`, `prepare_trade`, `accept_trade` | quantity 7 keeps the typed value and returns focus; `/booking/evt_missing` shows an alert | reference | placeHold `reserve_listing` not-bound; Not composed list; only three send controls |
| admission | Adopt, Authorize, Consume once | adopt for a right that was never issued is refused | not reachable | external admission `UNSUPPORTED`, routing `false`, no admit control |
| resale | Adopt, List, Hold buyer, Note payment, Bind, Accept transfer | listing an unknown booking is refused | reference | external marketplace `UNSUPPORTED`; refused on request |
| credit | Offer, Approve, Bind, Draw, Note repayment | Close with outstanding exposure is refused (`OUTSTANDING_REMAINS`) | not reachable | external credit `UNSUPPORTED`; funds, bank debit, KYC, and underwriting flags `false`; no disburse control |
| gift | `offer_gift` then `accept_gift` with the caller's own fields | an empty body is not sent (a not-sent screen, focus on the ticket id) | reference | "not a credit draw"; only three send controls |
| organizer | `create_event`, `close_sales`, `open_admission` with the caller's seats | blank seats are not sent (a not-sent screen) | reference | exactly the six published sends; Not composed list |
| receipts | one entry per operation id; the support export holds the false-claim flags | empty timeline, empty detail, "Nothing was kept off this screen" | reference (read note) | placeHold "Recorded and not sent"; capture, settle_capture, commit_trade, open_admission, admit recorded |

Reading the table honestly:

- The gift and organizer REJECT cells are **not-sent** screens. The desk refuses to send an incomplete body, so no gate rejection exists to show. The suite does not call these gate rejections.
- The stub-shape booking, gift, and organizer invokers never reject or lose a response, and the box office, admission, and credit controllers never lose one. Their UNKNOWN cells are **not reachable** without a fault hook. No hook was added to production source. The owner is `c-fault-injection-stub`.
- The booking, resale, gift, and organizer UNKNOWN cells are **references** to the Journeys table's "Response lost" row for that journey. Those rows are reused reference rows from the cross-surface node, with a `FENCED` or `COMPENSATION_UNDEFINED` word, and they are never closed. The suite checks the text. The desk did not lose a response in this run.
- The shared UNKNOWN browser evidence is the `/session` desk, where an unsettled intent turns UNKNOWN after a reload with no new send, and the `/journeys` page, which lists its Unknown rows (refund, marketing benefit, delegated assistant, credit servicing) as neither done nor closed.

## One attempt

The stub has no transport, so "one attempt" is checked as one operation id and one receipt per user action:

- A double click on `Send create_event` leaves one `jrn:evt_lanterns:1:create_event` on the page and one entry on `/receipts`, and the control is then disabled.
- A keyboard-only send (focus, Enter, then Enter again on the locked control, then Space on the next step) sends once per step.
- A reload clears the page-load journey, shows no old receipt, and the next send uses a new attempt id.
- Every test ends with a check that page scripts made zero `fetch`, XHR, beacon, or WebSocket calls, and each browser session ends with the ledger: zero requests to another origin and zero non-GET requests.

## Run it

```bash
npm ci
npm run typecheck:e2e
KIX_E2E_CHROME=/usr/bin/google-chrome npm run test:e2e
```

`KIX_E2E_NO_SANDBOX=1` is for a container or the CI runner whose Chrome cannot start its sandbox. The browser only loads its own loopback origin. `KIX_E2E_RECORD_OUT=<file>` writes the run record. The CI job is `browser-e2e` ("Browser journeys (stub, headless Chrome)"). It is additive: the `desk` job named "Typecheck, build, and test (stub)", the `gate-token` job, and the `live-gate` job and their steps are unchanged.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-16, `playwright-core` 1.58.2, on base `main` `810e5440ebc035442d4ab1f4aed5eb04cdaa5229`. Mode stub, server bound to `127.0.0.1`.

| Item | Result |
| --- | --- |
| Test files / tests | 11 / 42, all passed |
| Matrix | 32 cells; 24 browser-checked, 5 reference-checked, 3 not reachable |
| Requests to another origin | 0 |
| Requests that were not GET | 0 |
| `fetch`, XHR, beacon, or WebSocket calls by page scripts | 0 |
| Server bind | `127.0.0.1` |

Claims in the run record: `httpModePass` false, `productionQualification` false, `realPayment` false, `released` false.

The 38 checks that passed: the 24 journey cells (`<journey>.SUCCESS`, `.REJECT`, `.NOT_BOUND` for box office, booking, admission, resale, credit, gift, organizer, receipts), `receipts.UNKNOWN.read-note`, four `journeys-table.RESPONSE_LOST.*`, `journeys-page.UNKNOWN`, `session.UNKNOWN`, three `one-attempt.*`, and four `harness.*` (server, paths, external-blocked, redaction).

## Not verified

- HTTP mode in a browser. The reviewed gate answers no CORS, so a browser path needs a kix-protocol gate change, which is outside this node. This suite is not an HTTP-mode result and not a production qualification.
- Fault and latency injection, and an in-flight screen. The stub resolves at once. Owner: `c-fault-injection-stub`.
- Automated accessibility acceptance (axe or a similar tool). Owner: `c-a11y-acceptance-stub`.
- Real devices, other browsers, and screen readers. Only keyboard sends were driven.
- The first CI run on the `ubuntu-24.04` runner. Chrome there and its sandbox behavior are not confirmed until that job runs. If the sandbox fails, `KIX_E2E_NO_SANDBOX=1` is already set.
- Stub-shape receipts are not gate receipts. A passing screen here is not a real payment, a real ticket, real KYC, a credit disbursement, a venue scan, a bank rail, or a live marketplace, and none of those were touched.
