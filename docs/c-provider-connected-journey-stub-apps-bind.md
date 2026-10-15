# Provider connected journey stub apps bind

This bind is the stub-scoped approved-provider checkout page at `/provider`. It is the synthetic reduction of pending node `c-provider-connected-journey`: the real connection stays pending on `kix-protocol:k-provider-sandbox` and `kix-protocol:k-authority-qualification`, and the original node remains in `docs/aiops/PENDING_NODES.json` for a later promotion. This node wires the provider seam — a checkout redirect, a return landing, a provider report, a payment observation, a right issuance, and a refund record, with an environment verdict and an account-qualification verdict that come from the source — onto a deterministic synthetic source. It is not a provider integration and does not claim one.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `ca55b9c8b97304f7d5efdf5eb683c88ad72acba6`. This delivery is the uncommitted diff on `agent/kixc-c-provider-connected-journey-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its writes land on an in-process synthetic source, which is a stand-in for the provider desk. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, and `admit` stay uncomposed, and `refund_ticket` is recorded and not sent (`PROVIDER_NOT_COMPOSED`, which reuses `JOURNEY_NOT_COMPOSED` and adds `refund_ticket`). `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`PROVIDER_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it, and none of the four synthetic steps (`begin`, `observe`, `issue`, `refund`) is a desk method or a catalogue command.

On `integration-http` the read and every write are `not-bound`: "The contract-only catalogue has no read command for a provider order, checkout, payment, issuance, or refund projection, and the provider sandbox and authority qualification contracts are not merged in kix-protocol." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Sandbox and production banners, plus account and environment checks | `environmentVerdict` and `accountVerdict` on the read and on every answer; the banner renders both | `packages/protocol-adapter/test/provider-journey.test.ts`, `apps/web/test/provider-journey.test.tsx` |
| A return URL alone never counts as a success | the return landing is its own line; `observe` waits on the provider report, and issuance and refund wait on an observed payment | `provider-journey.test.ts`, `provider-controller.test.ts`, `provider-journey.test.tsx` |
| Redirect, return, observation, issuance, and refund are linked by receipt | every step carries `orderRef` and `checkoutRef`, and `issue` and `refund` resolve the payment the observation named | `provider-journey.test.ts` |
| User abandonment, lost answers, repeated intent, and late results | scenarios `abandoned`, `begin-lost`, `observe-lost`, `issue-lost`, `refund-lost`, `observe-late`, `held-response`; the naive source never de-duplicates, the fence does | `provider-journey.test.ts`, `provider-controller.test.ts` |
| No test account or provider qualification is shown as synthetic, not as success | `accountVerdict.qualified === false` fences every write; the unqualified scenario is labelled | `provider-controller.test.ts`, `provider-journey.test.tsx` |
| A sandbox success creates no real payment or admission right | six non-claim fields on every payload; a claim-bearing read is refused whole, a claim-bearing answer becomes untrusted `UNKNOWN` | `provider-journey.test.ts`, `provider-controller.test.ts` |
| Provider errors, late callbacks, and UNKNOWN returns are reported | `provider-error` scenario, the late-result evidence line, and the unknown fence | `provider-controller.test.ts`, `provider-journey.test.tsx` |

The spec asks for a "real sandbox E2E with environment evidence". No provider sandbox contract or account exists in this repository (`kix-protocol:k-provider-sandbox` and `kix-protocol:k-authority-qualification` are pending), so the adapter is the synthetic port and the real environment is unverified. That is the stub scope this node was reduced to, and the spec's own reduced text says so.

## Identity

Every reference has its own kind and prefix: `ord-` order, `cko-` checkout, `ret-` return landing, `cbk-` provider report, `psp-` payment, `iss-` issuance, `rgt-` right, `rfd-` refund, `trm-` terms. `isProviderRef(ref, kind)` is true for one kind only, so a payment reference is never read as a checkout reference. The controller refuses a write whose target is the wrong kind before it sends anything (`NOT_SENT`, `identity`).

`PROVIDER_IDENTITY_REGISTER` says which identity has a named field in the pinned catalogue. A test reads the vendored contract-only OpenAPI file and checks every listed field.

| Identity | Field here | Status | Pinned fields |
| --- | --- | --- | --- |
| order | `orderRef` | not-bound | none. The pinned money posting names `orderId`, and this journey composes none of the bodies that carry it |
| checkout | `checkoutRef` | not-bound | none. No pinned body or receipt names a checkout id |
| return | `returnRef` | not-bound | none. No pinned body or receipt names a provider return landing |
| report | `reportRef` | not-bound | none. No pinned body or receipt names a provider callback id |
| payment | `paymentRef` | not-bound | none. A payment id is named only by `capture`, `settle_capture`, `adjust_pg_cancel`, `finalize_effect`, `observe_effect`, and `observe_return`; each also carries an amount and a currency, and this journey composes none of them. There is no payment observation read |
| issuance | `issuanceRef` | not-bound | none. No pinned body or receipt names an issuance id |
| right | `rightRef` | field named | `create_listing.ticketId`, `prepare_trade.ticketId`, `offer_gift.ticketId`, `refund_ticket.ticketId` |
| refund | `refundRef` | not-bound | none. `refund_ticket` is pinned (`domain`, `expectedVersion`, `ticketId`) and never sent. No refund id and no compensation policy are published |
| terms | `termsRef` | field named | `accept_trade.termsHash`, `accept_gift.termsHash` |
| version | `expectedVersion` | field named | `create_listing`, `prepare_trade`, `refund_ticket`, `offer_gift` |

Naming a field is not binding it. The values on the page are synthetic references, the pinned catalogue publishes no receipt path that would carry them, and no body is built from the register.

## The synthetic source

`packages/protocol-adapter/src/provider-journey.ts`. State lives in the object, so a new port is a new session. It holds two orders: `ord-0001` with qualified terms `trm-0001`, and `ord-0002` whose amount the source states as `UNDETERMINED`.

The read carries an `environmentVerdict` (`sandbox` or `production`) and an `accountVerdict` (`sandbox-qualified`, `unqualified`, or `production-account`) that the source owns. The page copies both and derives neither. `PROVIDER_DESK_ACTOR` (`provider-buyer`) is the synthetic qualified account; `PROVIDER_GUEST_ACTOR` (`provider-guest`) is not. The actor string is a context label and not an authentication result.

The source has four writes. A begin opens a checkout (`cko-`, `returnRef`, and a `returnUrl` labelled synthetic). An observe reads the provider report on the checkout and records a payment (`psp-`) only after a report has landed; a return landing alone leaves it pending, an abandoned checkout is refused, and a decline is a decline. An issue records an issuance and a right (`iss-`, `rgt-`) after the payment is observed; the right grants no admission authority. A refund records a refund (`rfd-`) after the payment is observed; it executes no return of funds and `COMPENSATION_UNDEFINED` never appears — where the policy is unknown the source says so.

The source events keep the same ordering. A provider report applies only while the checkout still awaits one, so a closed checkout takes no report. An abandonment applies only while no report is recorded, so a checkout whose report landed — observed or declined — stays decided and cannot be flipped to abandoned. An observe, issue, or refund against a closed checkout is refused `CHECKOUT_ABANDONED`. An abandoned checkout pays, issues, and refunds nothing.

Every read and every answer carries six non-claim fields, all false: `realPayment`, `fundsMoved`, `admissionGrant`, `refundExecuted`, `providerIntegrationComplete`, `productionEnvironment`. A read that omits one or says otherwise is refused whole before a row shows. An answer that says otherwise is not trusted and the write becomes `UNKNOWN`.

The source is deliberately naive. It does not de-duplicate an intent and has no idempotency key, so a repeated write is applied again. The only thing that stops a second effect is the client fence below, and a test counts begins at the source to prove it.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every write. |
| `provider-error` | Every write rejects `PROVIDER_UNAVAILABLE`. |
| `return-only` | No provider report arrives unless a test lands one; `observe` stays pending after a return. |
| `declined` | The provider report on `ord-0001` is a decline. |
| `abandoned` | The checkout closes when the buyer leaves; nothing is observed, issued, or refunded. |
| `unqualified` | The read reports an unqualified account. |
| `production-claimed` | The read reports a production environment; the read is refused and the writes stay fenced. |
| `claims-real` | The read claims `realPayment`; the read is refused whole. |
| `receipt-claims` | The read is clean and every answer claims `realPayment`; the write becomes untrusted `UNKNOWN`. |
| `begin-lost` | A begin is applied and its answer is lost. |
| `observe-lost` | An observe is applied and its answer is lost. |
| `observe-late` | An observe is applied, its answer is lost, and a late result can be delivered later. |
| `issue-lost` | An issue is applied and its answer is lost. |
| `refund-lost` | A refund is applied and its answer is lost. |
| `held-response` | Effects apply at once and answers are held until `deliverHeld`. |
| `stale` | Serves a watermark older than the floor. The read is `stale`. |
| `empty` | Has no orders. The read is `empty`. |

The facets on an order are read from the source: redirect (a checkout record), return (landed or pending), payment (a `psp-` reference, pending, declined, or unknown), issuance (an `iss-`/`rgt-` pair or none), and refund (an `rfd-` reference or none). A return landing and a provider report are two different lines, and a return landing is never a payment observation.

## The controller

`packages/protocol-adapter/src/provider-controller.ts`. The context key is the mode, the domain, the actor string, and a session incarnation.

| Event | What the controller does |
| --- | --- |
| A write while another write on the same order is in flight | `FENCED` (`in-flight`). It never reaches the port. |
| A write on an order with an unknown result | `FENCED` (`unknown-outcome`), in any context and after any read. |
| A late result for an unknown write | Recorded as evidence. The write stays `UNKNOWN` and the fence stays. |
| A late result for another context, or for a write that is not unknown | Quarantined. Nothing changes. |
| A write with no current read | `FENCED` (`no-snapshot`). |
| A write after the source said the last read was behind, or after the page's own write | `FENCED` (`snapshot-stale`) until a fresh read. |
| The same intent sent again | `FENCED` (`duplicate-intent`). Nothing is sent. |
| A write in a declared-production environment | `FENCED` (`environment`). |
| A write from an unqualified account | `FENCED` (`account-unqualified`). |
| An issue or refund without an observed payment | `FENCED` (`payment-unobserved`). A return landing alone does not unlock it. |
| A write whose target reference is the wrong kind, not in this snapshot, or a stale version | `NOT_SENT` (`identity`, `unknown`, `stale`). |
| An answer that never arrives | `UNKNOWN`. The order is blocked for the rest of the session. |
| An answer that claims a non-claim field | `UNKNOWN` (`untrusted`). Nothing is applied on this page. |
| A read after a write was answered | Refreshes the snapshot for the next write. It never lifts a fence. |

The controller serialises one write at a time per order, sends each intent once, and never resends. A second order is a different scope and stays open while the first is held or unknown. A changed session context counts earlier unknown writes instead of forgetting them: writes on their orders stay blocked, and their late answers are quarantined.

## Order shapes

An order shows one of these. There is no completed or done shape.

| Shape | Meaning |
| --- | --- |
| `none` | No checkout is open on the order. |
| `checkout-open` | A checkout exists; no return and no report are recorded. |
| `returned-unobserved` | The return landed; no provider report and no payment observation. |
| `abandoned` | The buyer left and the provider closed the checkout. |
| `payment-declined` | The provider reported a decline. |
| `payment-observed` | A `psp-` payment is observed; no issuance and no refund. |
| `issued` | A payment and an `iss-`/`rgt-` issuance are each observed. |
| `refund-recorded` | A payment, an issuance, and an `rfd-` refund record are each observed. |
| `unknown-effect` | A write on the order has an unknown result. |

A chain a read reports is linked to this page only when confirmed receipts of this page named each prior reference. An order observed after a lost answer is shown as observed only; this page does not claim it, and the session record says "No order row is linked to it".

## Screen

`apps/web/src/provider-journey.ts` holds the hook and the pure view builders. `apps/web/src/pages/ProviderJourneyPanels.tsx` renders them, and `apps/web/src/pages/ProviderJourney.tsx` composes the page. Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A blocked, rejected, unknown, or quarantined result moves focus to the status region. Every state has a word, not only a style, and wide tables scroll inside their own labelled region instead of widening the page. Every row prints `data-source="synthetic-provider"` and `SYNTHETIC`. The page posts nothing and calls no `fetch`.

The hook starts a read when the page opens and one more read after a write that was answered (confirmed, rejected, or unknown). A fenced write, an unsent write, and a quarantined result trigger no read. Nothing polls and nothing sets a timer. The synthetic controls (scenario, land the return, deliver the provider report, leave the checkout, deliver held response, deliver late result, switch session context, start a new synthetic session) stand in for events a real provider would cause, and a real provider offers none of them.

## Hold

The real connection is `c-provider-connected-journey`. This node consumes no SDK, manifest, or vector and serves no provider. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Order amounts, refund policy, provider credentials, and the retention of an unknown write stay `UNDETERMINED` where the source does not state them. The external prerequisites `kix-protocol:k-provider-sandbox` and `kix-protocol:k-authority-qualification` are not merged; a real sandbox E2E stays unverified.

## Browser run

Observed in headless Chrome 154.0.8037.97 on 2026-10-14, driven by a Playwright script kept outside the repo. The stub desk was the default production build served by `vite preview` from `127.0.0.1`; the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`, served the same way, with nothing listening on that port. There was no page exception on either desk. The stub desk logged only a favicon 404, and the HTTP desk logged only the same 404 plus the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | "Provider desk read." Two orders (`ord-0001`, `ord-0002`), "Environment sandbox, actor provider-buyer, qualification sandbox-qualified." Tab reached the first Begin button on the 38th press (the shell links come first). Enter opened `cko-0001` and the order showed `checkout-open` |
| Return then report | Land the buyer on the return URL: `returned-unobserved`, the payment line stayed `pending`, and Record the issuance stayed `aria-disabled`. Deliver the provider report, then Record the payment observation: `psp-0001` observed. Record the issuance and Record the refund each confirmed on their own line; final shape `refund-recorded`, `linked=true` |
| Return only | With `return-only`, the observe press after the landing was rejected `PAYMENT_PENDING` and the shape stayed `returned-unobserved` |
| Declined | Observe after the decline report was rejected `PAYMENT_DECLINED`; shape `payment-declined` |
| Abandoned | Abandon the checkout after a begin: `abandoned`, "Nothing was paid, issued, or refunded" |
| Empty | `empty` read: "No orders in this synthetic session." with one Read again action |
| Stale | `stale` read named the watermark and the floor |
| Unqualified | `unqualified` read: Begin checkout `aria-disabled="true"` with the qualification reason |
| Production | `production-claimed`: `environment-refused`, no order row |
| Claims | `claims-real`: `refused` naming `realPayment`, no order row; `receipt-claims`: the begin answer turned `UNKNOWN` and Begin stayed `aria-disabled` |
| In progress | In `held-response` the begin sat in flight: Begin on `ord-0001` was `aria-disabled="true"`, the `ord-0002` Begin carried no `aria-disabled`, and the fenced button still took keyboard focus |
| Answer lost | In `begin-lost` the result was `UNKNOWN`, Begin on `ord-0001` stayed `aria-disabled`, and `ord-0002` stayed free |
| Late result | In `observe-late`, Deliver late result printed the late-result line; shape `unknown-effect`, the write stayed `UNKNOWN` |
| Stale session | Switch session context while the begin was in flight: state `unread`; delivering the held answer printed a quarantined line |
| Narrow | At 360 px `scrollWidth` was 360 — no horizontal scroll |
| HTTP desk | `data-provider-state="not-bound"`, `data-adapter-environment="integration-http"`, no order rows, and zero Begin buttons |
| Requests | On the stub desk every request was a page `GET`. No `POST`, and the only request to port 8765 was the shell's `GET /health` probe on the HTTP desk |

Not observed in the browser: the loading frame, because the stub port answers within a microtask (the server-rendered test covers the loading markup), and a screen reader pass. A real browser pass against a provider sandbox stays unverified by design, since no live environment exists for this stub scope.

## Tests

`packages/protocol-adapter/test/provider-journey.test.ts` covers the identity register against the pin, the not-composed record and the byte-identical bindings hash, reference kinds, the port choice, every read outcome, the writes and each refusal, the environment and account verdicts, the non-claim fields, the naive source, each fault scenario, and a source scan. `packages/protocol-adapter/test/provider-controller.test.ts` covers the context key, dropped reads, the write fence, one order at a time, the unqualified and production fences, payment-unobserved, client resend, untrusted answers, late results, a stale session, the not-bound port, and a changed tuple. `apps/web/test/provider-journey.test.tsx` covers the screen for each state, every fence sentence, the journeys above as rendered pages, the mounted route, the registry, handoff, and fixture rows, and a source scan of the three new web modules. The workspace registry, contract fixture library, and handoff tests check the `provider-connected-journey` surface and its ten fixture rows.
