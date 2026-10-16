# Fault and restart injection (stub) apps bind

This bind adds deterministic fault injection to the existing seams and checks that every injected fault leaves exactly one send per command and no new write or compensation after an UNKNOWN. It is the stub-scoped reduction of pending node `c-integrated-chaos-qualification`, which stays in `docs/aiops/PENDING_NODES.json`. A real connection waits on its producer prerequisites and becomes a separate follow-up node.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. The injector never composes a banned action or a reversal; it only counts any that reach the transport, and every row asserts that count is 0.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` do not move, and `packages/protocol-adapter/src/commerce-bindings.ts`, `packages/protocol-adapter/src`, and `apps/web/src` are untouched. `contract_change=NO`. Row ids, the send ledger, and the run records are app-internal. They are not a public schema, operation, capability, or identifier.

## What is injected

| Layer | Seam | Faults |
| --- | --- | --- |
| Node | the `fetchImpl` argument of `HttpProtocolAdapter` (a fake fetch on `http://127.0.0.1:8765`, the real adapter code) over the stub-shape invokers | PRE_SEND_THROW, LOST_AFTER_EFFECT, TRUNCATED_BODY, TIMEOUT, STALE_CORRELATION, INVALID_RECEIPT, REJECT_422, SERVER_5XX, REDIRECT, LATE_DELIVERY |
| Node | the `LocalCallInvoker` seam used by the journeys (in-process stub-shape source) | PRE_SEND_THROW, LOST_AFTER_EFFECT, INVALID_RECEIPT, REJECT_422 |
| Web (SSR) | `createJourneyDesk` with a lossy invoker and a fake `sessionStorage` | a lost answer, a second desk standing in for a reload, corrupt attempt counters |
| Browser | the production stub bundle in headless Chrome, `addInitScript` and `page.evaluate` only | quota error, corrupt blob, cleared storage, blocked storage, repeated reload |

Nothing is a hook in production source. The plan is data (`nth` and `action`), with no randomness and no clock. Only TIMEOUT and LATE_DELIVERY wait, on the adapter's own `timeoutMs` (60 ms here). A send ledger records one entry per call: operationId, action, whether the synthetic source applied it, the fault, any `Idempotency-Key` header, the `redirect` mode, and the url. Each matrix cell runs the surfaces booking, gift, organizer, and consent at every step and asserts all of:

- the write count at the fault equals the step index plus one, and stays there;
- the same step again, every later step, and the compensating extras (`cancel_gift`, `cancel_event`, `complete_event`) all come back FENCED;
- no operationId is sent twice or minted, no `Idempotency-Key` header is sent, `redirect` is `manual`, and no request leaves `127.0.0.1`;
- the halt object is unchanged afterwards, including after a late answer is released;
- the banned-action count is 0.

A pre-send throw reads UNKNOWN even though the ledger shows nothing applied. The ledger knows that and the UI cannot, so the fence holds. A 422 reads REJECTED, and every other fault reads UNKNOWN.

## Results

Node and browser rows keep separate denominators and are never summed. A row is `PASS`, `REUSED` (a pointer to an existing test that a test resolves), `LIMIT` (observed and recorded, not extended), `NOT_REACHABLE`, or `UNVERIFIED`.

### Node runner (fake fetch and in-process stub-shape source), 21 rows

| Row | Case | Status | Note |
| --- | --- | --- | --- |
| FI-N01 | PRE_SEND_THROW | PASS | 4 surfaces, every step; reads UNKNOWN with 0 applied at the source |
| FI-N02 | LOST_AFTER_EFFECT | PASS | applied at source 1, caller sees UNKNOWN |
| FI-N03 | TRUNCATED_BODY | PASS | |
| FI-N04 | TIMEOUT | PASS | `REQUEST_TIMEOUT`, no resend |
| FI-N05 | STALE_CORRELATION | PASS | `STALE_RESPONSE` reads UNKNOWN |
| FI-N06 | INVALID_RECEIPT | PASS | wrong action in the receipt reads UNKNOWN, never a receipt |
| FI-N07 | REJECT_422 | PASS | REJECTED, later steps fenced |
| FI-N08 | SERVER_5XX | PASS | |
| FI-N09 | REDIRECT | PASS | not followed |
| FI-N10 | LATE_DELIVERY | PASS | answer released after the caller moved on changes nothing |
| FI-N11 | duplicate trigger while in flight | PASS | in-flight fence, 1 send |
| FI-N12 | probe after UNKNOWN | PASS | `observeTransport` sends no write and lifts no fence |
| FI-N13 | actor switch after UNKNOWN | PASS | a different donor and recipient are still fenced |
| FI-N14 | mode selection | PASS | a failed HTTP step does not switch to the stub-shape invoker |
| FI-N15 | reload over a damaged store | PASS | three reloads over a clean, write-refusing and silently truncating store keep the source submit count at 1 |
| FI-N16 | concurrent gift on two instances | PASS | a labelled fixture source decides; exactly one RECEIPT; each page sent once |
| FI-N17 | concurrent resale | REUSED | `platform-controller.test.ts` "two pages on one source" |
| FI-N18 | admission desk call over HTTP | PASS | `checkAdmission` stays not-bound; 0 requests, so 0 `admit` |
| FI-N19 | stale read and context switch | REUSED | `session-recovery-controller.test.ts` tab resume and the controller tests |
| FI-N20 | storage damage in the journal | REUSED | `session-journal.test.ts` partial, truncated and over-quota writes |
| FI-N21 | desk-method throw bumps the attempt | NOT_REACHABLE | `settlement-desk.ts` moves to a new idempotency key after any throw. In the shipped modes the stub is in-process and the HTTP desk methods are not-bound, so the path cannot run. Giving a desk UNKNOWN its own meaning is new business meaning and is not added here |

The three desk UNKNOWN cells of the browser journeys record (box office, admission, credit) stay NOT_REACHABLE for the same reason.

### Web (SSR) runner, 3 rows

| Row | Case | Status | Note |
| --- | --- | --- | --- |
| FI-W01 | every desk row after UNKNOWN | PASS | `canSend` false on all three rows, none reads confirmed, a duplicate click sends nothing |
| FI-W02 | second desk after a reload | LIMIT | The fence is page-load only. A fresh load takes the next attempt and can send a new `create_event` with a new operationId. Persisting that fence needs a retention value, which is UNDETERMINED |
| FI-W03 | corrupt attempt counters | PASS | `abc`, `-1`, `1.5`, empty, `NaN` are ignored and never lower the attempt |

### Browser runner (production stub bundle, headless Chrome), 7 rows

| Row | Case | Status | Note |
| --- | --- | --- | --- |
| FI-B01 | storage quota on attach | PASS | the attach is `aria-disabled` with `WRITE_REFUSED`, Sent 0 |
| FI-B02 | corrupt stored blob before reload | PASS | `SESSION_EVIDENCE_LOST`, Sent 0 |
| FI-B03 | storage cleared mid-session | PASS | the in-memory fence outlives the cleared store: Sent 1, no second send, no confirmed text. A reload after the clear is a fresh tab for the journal (see Limits) |
| FI-B04 | blocked sessionStorage | PASS | page loads, every write held, Sent 0 |
| FI-B05 | repeated reload of a held answer | PASS | three reloads: UNKNOWN each time, Sent 0 |
| FI-B06 | concurrent gift, resale, admit across tabs | NOT_REACHABLE | tabs share no source |
| FI-B07 | HTTP mode in a browser | UNVERIFIED | needs a gate with CORS; none is consumed |

Each browser test also sums the context ledger: 0 non-loopback requests, 0 non-GET requests, 0 application network calls.

## Records

Each runner writes its own record, keyed by app head, mode, and source, and the two are never merged.

| Runner | How to write it | Mode | Source |
| --- | --- | --- | --- |
| Node | `KIX_FAULT_RECORD_OUT=<file> npm run test -w @kix/protocol-adapter -- fault-injection` | `integration-http(fake fetch)` | fake fetch to `HttpProtocolAdapter` over stub-shape invokers |
| Browser | `KIX_E2E_RECORD_OUT=<file> npm run test:e2e` writes `<file>.fault.json` next to the journeys record | `stub` | `browser-production-bundle(stub)` |

Both carry `appHead` from `git rev-parse HEAD` at run time. This document records only the base main SHA, because a document cannot hold its own head. All claims are literal false: `serviceQualification`, `productionQualification`, `realPayment`, `httpModePass`, `released`. The browser fault record goes through the same redaction check as the journeys record.

## Limits

- This is not a service qualification. Every fault is synthetic: a fake fetch, an in-process source, or a script that throws inside a headless Chrome page. There is no real outage, real server, real PG data, or real device.
- A passing row is not an HTTP-mode result. The Node rows run the real `HttpProtocolAdapter` against a fake fetch, not against a gate.
- The fence on `/booking`, `/gift`, and `/organizer` lasts for the page load. A reload starts a new attempt (FI-W02). The journal on `/session` is the only persisted fence, and its retention is UNDETERMINED.
- After a store is cleared and the page reloaded, the journal cannot tell the tab from a new one.
- TIMEOUT and LATE_DELIVERY use a 60 ms client timeout, not the shipped one. No latency or SLO figure is claimed.
- The concurrent-gift row uses a labelled fixture source that decides. It does not show that any real source decides the same way.

## UNDETERMINED

Retention of a persisted fence, a desk-level UNKNOWN meaning, and any resend or compensation semantic are not decided here and are not added.

## Acceptance mapping

| Item | Evidence |
| --- | --- |
| Injector, 1 send per injection, 0 writes after UNKNOWN | `packages/protocol-adapter/test/support/fault-injector.ts`, matrix in `test/fault-injection.test.ts` |
| Browser and Node recorded separately by head, mode, source | the two records above, separate denominators in this document |
| No real fault, server, or PG data; small fixtures | the fake fetch and stub-shape invokers; the ledger zero-checks on `nonLoopback` |
| No duplicate write, early activation, or false completion | ledger asserts, `JourneyDesk` rows, browser status text |
| Stub is not shown as qualification | all claims false, the Limits above, a doc test |

## Not verified

The live gate (this node needs no producer), HTTP mode in a browser, a real device, a screen reader, latency, and the first CI run of the new browser file on the hosted runner.

## Hold

Stub or synthetic evidence only. No real fault, server, or PG data. Not a service qualification and not an HTTP-mode result. M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
