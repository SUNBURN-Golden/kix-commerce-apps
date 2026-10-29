# Receipt explorer apps bind

This bind is the read-only receipt explorer at `/receipts`. It shows the operation, status, source, and profile of receipts already on this page load, connects an error code to that action and to the unconfirmed reason, and offers one redacted support export. It adds no command, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. Base HEAD for this page is `6d4de9d4fac12c01c851d63c4cae82da42d71e08`. The working tree is uncommitted.

## What the page shows

The page reads the journey, gift, consent, and organizer desks already on this page load. It does not post, and a reload does not post. Buyer sees journey, gift, and consent rows. Organizer sees organizer rows. Operator sees the buyer rows and the organizer rows from the same page load. A receipt whose session id is not this page load is dropped and is not listed, including in the export.

Status is copied from the receipt. `unknown` stays `unknown`. `stale` stays `stale`. `mapOperationalError` only labels the code class. A confirmed desk row with no receipt is shown as `unknown`. `placeHold` stays not-bound, `consideredAction` `reserve_listing`, `mappedOntoPrepareTrade` false. `prepare_trade` is not a mapping of `placeHold({ eventId, quantity })`.

A stub-shape receipt uses profile `contract-only` and `OPENAPI_CONTRACT_PIN.infoVersion`. An integration-gate receipt uses profile `integration-gate` and the integration-gate pin version. The screen profile follows the adapter environment. A candidate whose profile does not match its source is malformed and is not shown as confirmed.

An adapter-path row uses action `adapter_path`. It is an observation, not a protocol command and not a receipt. The path detail is not copied onto the row.

Recorded and not sent lists `JOURNEY_NOT_COMPOSED`, `GIFT_NOT_COMPOSED`, `CONSENT_NOT_COMPOSED`, and `ORGANIZER_NOT_COMPOSED` for the roles that already have those senders, with the locked reasons. The page does not compose `capture` or `settle_capture`. `commit_trade`, `open_admission`, and `admit` stay uncomposed on the journey.

The support export is the same redacted package the page shows. Denied field keys are omitted. Tokens, emails, phone numbers, and account numbers are replaced. `readConfirmsUnknown`, `retry`, and `fallbackToStub` are false. Mock FSM phases are not promoted to catalogue receipts.

## UX decisions made here

These are ordinary presentation choices. They are recorded so a later change does not treat them as an open product policy.

| Decision | Choice |
| --- | --- |
| Role tabs | Buyer, organizer, and operator. The initial tab is buyer |
| Operator | The same page load's buyer receipts and organizer receipts |
| Profile | The pinned contract status already paired with the source |
| Session | This page load only. A reload opens a new session |
| Posts | This page does not send |
| Adapter path | Shown as an observation, not as a receipt |
| Not composed | Listed by sender, action, and the locked reason |

## Browser run

Observed in headless Chrome 154.0.8037.97 on 2026-10-12. The stub desk was `vite preview` at `http://127.0.0.1:5291` from the default production build. The HTTP desk was a second preview at `http://127.0.0.1:5292`. Vite inlines `VITE_KIX_PROTOCOL_MODE` and `VITE_KIX_PROTOCOL_API_BASE` at build time, so that preview was a separate build with mode `http` and base `http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception.

The same Chrome profile had already stored desk attempts for these event ids, so the operation ids on the observed run were `jrn:evt_lanterns:4:create_event`, `jrn:evt_lanterns:4:prepare_trade`, `jrn:evt_lanterns:4:accept_trade`, and `org:evt_org_browser:3:create_event`. The explorer printed the ids the desks had already assigned.

| State | Observed |
| --- | --- |
| Empty | `/receipts`. `data-adapter-environment="stub"`, `data-profile="contract-only"`, `data-role="buyer"`. Timeline and detail said "No receipt on this page load." Detail `data-state="empty"`. No `data-confirmed="true"`. The ruling, the stub sentence, the unknown-read sentence, and the other-session sentence were on the page. Buyer tab `aria-selected="true"`. The diagnostic textarea was read-only. |
| Keyboard | ArrowRight moved the selected tab to Organizer and focused it. End moved to Operator. Home moved to Buyer. After receipts existed, ArrowDown moved the timeline current entry from `create_event` to `prepare_trade`. |
| 1280px | Receipt sections nav computed `position: static`. |
| 720px and 390px | Receipt sections nav computed `position: sticky` and `bottom: 0px`, and it sat on the bottom edge. A nav link computed `min-height: 44px`. |
| Confirmed journey | On `/booking/evt_lanterns`, Send `create_event`, Send `prepare_trade`, and Send `accept_trade` each reached "Last confirmed receipt" for that step and "Confirmed stub-shape receipt. Not from the gate." The buyer tab then showed three entries, each `confirmed`, source `stub-shape`, profile `contract-only`, `data-confirmed="true"`. |
| Role split | The buyer tab did not show `evt_org_browser` or `evt_org_bad`. The organizer tab did not show `evt_lanterns`. It showed `create_event` confirmed and a second `create_event` `not-sent` with `data-confirmed="false"`, then fenced `close_sales`, `open_admission`, `complete_event`, `cancel_event`, and `issue_invitation`. The operator tab showed both `jrn:evt_lanterns:4:accept_trade` and `org:evt_org_browser:3:create_event`. |
| Not sent | An organizer `create_event` with invitation quota `1.5` was `not-sent` on `/organizer` and on the organizer receipt tab. It was not confirmed. |
| Copy | The Copy diagnostic button focused the read-only textarea. Headless Chrome did not grant clipboard write, so the status said "Select the diagnostic and copy it from the text box." The text included `"kind": "support-diagnostic"` and `"readConfirmsUnknown": false`. |
| Reload | A reload returned the timeline to "No receipt on this page load." The journey and organizer operation ids were gone. The `placeHold` not-bound row stayed. |
| HTTP mode | Banner: "Loopback gate is unavailable (GATE_UNAVAILABLE). The client does not retry and does not fall back to the stub. The desk stays on integration HTTP." The page was `data-adapter-environment="integration-http"` and `data-profile="integration-gate"`. Three `adapter_path` rows were `unavailable`, source `none`, profile `none`, `data-confirmed="false"`. The page said an adapter path observation is not a protocol command and not a receipt. The receipt text did not include `127.0.0.1`. No `data-confirmed="true"`. |

An in-flight row and a gate `UNKNOWN` did not stay on screen under the stub. Those states are covered by `apps/web/test/receipt-explorer.test.tsx`. The browser does not reach a live gate. The page did not post `placeHold`, `capture`, or `settle_capture`.

## Hold

Producer manifest, source cut, and refresh epoch are not fields on the receipts these desks already keep. This page does not invent them. Refund and price policy stay `UNDETERMINED`. Persisting an unconfirmed intent across reload is `c-async-session-fence`.

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. The five pins stay where the gate bind put them.

## Tests

`apps/web/test/receipt-explorer.test.tsx` covers the builder and the page. Registry, journey, gift, organizer, and consent suites stay as they are.

Browser exercise is the `Browser run` section above. The live-gate job is not a local pass: `KIX_REQUIRE_GATE=0` skips it.

## Audit 8: retained operations in timeline and export

Consent and organizer flows project completed history in completion order, followed by current rows with operation IDs absent from that history. Deduplication is scoped to each desk/event. Null-ID blocked observations and path observations remain. Only confirmed entries project receipt fields; pending, UNKNOWN, rejection and not-sent entries export empty fields. Authorization resets remove no completed evidence.

Existing source/profile adjudication, redaction, role/session isolation, complete-model export and pagination apply to history too. Selection identity still includes session, role, context, reference, action and operation ID; it excludes mutable timeline sequence. Diagnostics observe current desk rows only, so history does not replay completions. This remains a read, with `readConfirmsUnknown`, retry, fallback, production and truth flags false.

Regression coverage and actual local verification: [audit-8 evidence](audit-8-fix-evidence.md).
