# Marketing journey stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped marketing benefit journey at `/marketing/journey`. It is the synthetic reduction of pending node `c-marketing-journey`: the real connection stays pending on `kix-protocol:wave7-marketing-contracts` and on the unpromoted `w7-m01-membership`, `w7-m02-presale`, `w7-m03-coupon`, and `w7-m04-referral` nodes. This node wires the benefit seam — a fan finds a benefit, applies it to an order, is rejected or accepted by the source, and has it reclaimed — onto a deterministic synthetic source, and it consumes consent as an observation. It is not a producer connection and does not claim one. A benefit notice confirms no purchase, and an application confirms no purchase and pays no reward.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical (`83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). The branch base is `ebbc6667a29d0937bea2e2101d9049eda1cfa41a`. This delivery is the uncommitted diff on `agent/kixc-c-marketing-journey-stub`. The supervisor commits.

## What this page sends

Nothing goes to a protocol. The page sends no local call, no `create_event`, `prepare_trade`, or `accept_trade`, and no money posting. Its read, its two write kinds — apply and reclaim — and its simulated producer events land on an in-process synthetic source, which is a stand-in for the producer. It posts neither `set_consent` nor `authorize_marketing`: the only sender of those two is `ConsentBind` on `/marketing/m05`, and this page reads the consent state the source reports and links to that page (`MARKETING_CONSENT_NOT_POSTED` records both as never posted from here). `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, `admit`, and `refund_ticket` are recorded and not sent (`MARKETING_NOT_COMPOSED` reuses the platform record), and `placeHold` stays not-bound with `consideredAction` `reserve_listing` (`MARKETING_HOLD_NOT_BOUND` quotes the locked binding and the page prints its reason). `prepare_trade` is not mapped onto it.

On `integration-http` the read and the writes are `not-bound`: "No current producer tuple exists for the marketing journey: kix-protocol:wave7-marketing-contracts is not merged, and the membership, presale, coupon, and referral nodes are not promoted. The contract-only catalogue publishes set_consent and authorize_marketing only. It has no command or read for membership eligibility, presale priority, a usage count, a coupon budget, a referral attribution, or a benefit reclaim. The marketing journey stays NOT_BOUND on integration-http." There is no stub fallback, no third adapter, and no request.

## Scope and acceptance

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Eligibility, priority, usage count, coupon budget, and referral attribution are tied to the producer seam | `MarketingBenefit` (`verdict`, `priorityRank`, `usage`, `budget`, `attribution`), `MarketingMembership.version`, `MARKETING_CONTRACT_REGISTER` | `packages/protocol-adapter/test/marketing-journey.test.ts`, `apps/web/test/marketing-journey.test.tsx` |
| Cancel, refund, reclaim, and duplicate use are shown | `MarketingApplication` (`reclaim-due`, `dueReason`, `reclaimed`, `channel`), the `reclaim` write, `DUPLICATE_USE`, the `duplicate-elsewhere` scenario | all three suites |
| M05 CRM scope is separate from consent consumption | `MARKETING_CRM_SCOPE` (two consumed rows, four outside this journey, none completes CRM), `MARKETING_CONSENT_NOT_POSTED`, the consent section | `marketing-journey.test.ts`, `marketing-journey.test.tsx` |
| Discover, apply, rejected, and reclaim user journey | `MARKETING_LANES`, `projectMarketing`, the lanes, benefits, orders, and rejections sections | `marketing-journey-controller.test.ts`, `marketing-journey.test.tsx` |
| Consent withdrawal, a duplicate benefit, and a stale eligibility end to end | the three journey describes in the controller suite and the web suite | both |
| A benefit notice confirms no purchase and pays no reward | `MARKETING_NON_CLAIM_FIELDS` (seven, all `false`), `refuseMarketingSnapshot`, `refuseMarketingReceipt`, a button-label check | `marketing-journey.test.ts`, `marketing-journey.test.tsx` |
| After a consent withdrawal, no new marketing authority is reused | `AUTHORIZATION_STALE`, `CONSENT_WITHDRAWN`, `CONSENT_VERSION_STALE`, the `authorization` record, the three-step consent test | all three suites |
| A full CRM product is not completed by a UI stub with no contract | `MARKETING_CRM_SCOPE`, `crmProductComplete` non-claim, the pending row, the contract register | `marketing-journey.test.ts`, `marketing-journey.test.tsx` |
| No current producer tuple means `NOT_BOUND` | `createNotBoundMarketingJourney`, the integration-http screen state | `marketing-journey.test.ts`, `marketing-journey.test.tsx` |

The spec asks for eligibility, priority, usage count, coupon budget, and referral attribution to be bound to the producer. No marketing producer contract or read model exists in this repository or in the pinned catalogue (`c-marketing-journey` is pending), so the adapter is the synthetic port. That is the one deviation from the spec text, and it is the stub scope this node was reduced to. The M01–M04 session stubs under `apps/web/src/marketing` are a different thing and share no state with this journey.

## The synthetic source

`packages/protocol-adapter/src/marketing-journey.ts`. State lives in the object, so a new port is a new session. It serves one subject, `sub-0001`, to the actor `fan-desk`; `sub-0002` is a subject the desk actor holds no grant for, and it is also the referrer of the referral benefit. An actor and a subject string are context labels, not an authentication result, and the source decides scope.

A read returns a snapshot: the membership basis (tier and a version), the consent view (state, version, purpose, channel `none`, and an authorization with a state and the consent version it was issued at), four benefits, two orders, the applications, and seven non-claim fields. Validation happens before a row is returned: a malformed reference, an unknown kind, verdict, tier, or state, a non-whole count, a row that belongs to another subject, an application naming a benefit or order the payload does not list, a valid authorization beside consent that is not granted, an application that states a restoration policy other than `UNDETERMINED`, or any non-claim field that is not the literal `false` refuses the whole payload. A receipt is refused when it names another step, another benefit, order, or application, a state that does not belong to its step, a restoration policy, or a broken non-claim. The counts are moved by the source on an apply as a stand-in for the producer; the client copies them and never adds, subtracts, orders, or compares them.

The seed holds:

| Benefit | Kind | Consent | Source verdict in `clean` | Figures |
| --- | --- | --- | --- | --- |
| `ben-0001` Member presale window | `presale` | needed | `eligible` | usage 0 of 1, rank 1, tier `member` |
| `ben-0002` Lantern listing coupon | `coupon` | not needed | `eligible` | usage 0 of 1, budget 2 of 3 redemptions, rank 2, group `coupon` |
| `ben-0003` Last ferry coupon | `coupon` | not needed | `budget-exhausted` | usage 0 of 1, budget 1 of 1 redemptions, rank 3, group `coupon` |
| `ben-0004` Referral attribution | `referral` | needed | `eligible` | usage 0 of 1, referrer `sub-0002` unattributed, rank 4 |

A coupon budget is counted in redemptions and carries no amount. Orders `ord-0001` and `ord-0002` are the order source's own facts, observed here (`open`, `cancelled`, `refund-observed`); this journey never changes them except through a labelled simulation. Consent starts granted at version 2 with an authorization valid at version 2, and the membership starts at tier `member`, version 3.

The source decides an apply in this order and stops at the first reason: unknown benefit or order (`UNKNOWN_REF`), order not open (`ORDER_NOT_OPEN`), for a benefit that needs consent the consent state (`CONSENT_REQUIRED`, `CONSENT_WITHDRAWN`), the authorization at the current version (`AUTHORIZATION_STALE`), and the consent version the request carries (`CONSENT_VERSION_STALE`), then the eligibility version the request carries (`ELIGIBILITY_STALE`), the tier (`NOT_ELIGIBLE`), the same benefit already on the order (`DUPLICATE_USE`), another coupon in the same group on the order (`NOT_STACKABLE`), usage (`USAGE_LIMIT_REACHED`), budget (`BUDGET_EXHAUSTED`), and attribution (`ATTRIBUTION_TAKEN`). Each rejection code maps to exactly one return action: read again (`ELIGIBILITY_STALE`, `CONSENT_VERSION_STALE`, `DUPLICATE_USE`, `ORDER_NOT_OPEN`, `UNKNOWN_REF`, `ALREADY_RECLAIMED`), open the consent page (`CONSENT_REQUIRED`, `CONSENT_WITHDRAWN`, `AUTHORIZATION_STALE`), or nothing (`NOT_ELIGIBLE`, `USAGE_LIMIT_REACHED`, `BUDGET_EXHAUSTED`, `NOT_STACKABLE`, `ATTRIBUTION_TAKEN`). These rules are stub policy for tests and the demo. They are not protocol law.

| Scenario | What the source does |
| --- | --- |
| `clean` | Answers every read and write. Four benefits, two open orders, consent granted with a valid authorization. |
| `empty` | Lists no benefit for this subject. The read is `empty`. |
| `stale` | Serves a watermark older than the floor the page holds. The read is `stale`. |
| `consent-unset` | No consent is recorded. Benefits that need consent read `consent-required`. |
| `consent-withdrawn` | Consent is withdrawn before the first read and the authorization is stale. |
| `authorization-stale` | Consent was granted again at a new version and the authorization is still the older one. |
| `usage-limit` | One coupon is already used to its limit by another channel. |
| `attribution-taken` | The referral is already attributed to another referrer. |
| `duplicate-elsewhere` | Another channel applies the same benefit to the same order between the read and the write. |
| `budget-race` | The coupon budget is used up between the read and the write. |
| `apply-lost` | An apply is recorded and its answer never arrives. |
| `reclaim-lost` | A reclaim is recorded and its answer never arrives. |
| `held-response` | The source holds each answer until it is delivered. |
| `receipt-claims-reward` | The source records an apply, then answers that a reward was paid. The answer is refused (`CLAIM`). |
| `snapshot-claims-crm` | The source answers a read that claims the CRM product complete. The whole payload is refused (`CLAIM`). |
| `scope-leak` | The source sends a row that belongs to another subject. The whole payload is refused (`SCOPE_LEAK`). |
| `denied` | The synthetic grant is withdrawn. The read is `denied` (`GRANT_REVOKED`). |

Six simulated events stand in for things a real producer or the consent page would cause: the fan withdraws consent, the fan grants consent again, a new authorization is recorded at the current consent version, the membership tier lapses, an order is cancelled, and a refund is observed for an order. The page labels each one "Simulate:", and none is an approval, a payment, or a message. **The page does not read again after a simulated event**, so it stays behind until the next read or the next rejection — that is what makes the stale-eligibility and consent-withdrawal paths testable end to end.

## Consent is consumed here and set elsewhere

The consent section shows the state, the version, the authorization, the purpose, and the channel (`none`) as the source reports them, with a link to the consent page. `set_consent` and `authorize_marketing` are published commands, and this journey posts neither; the consent page's `ConsentBind` does. After a withdrawal the source marks the authorization stale and rejects an apply of a benefit that needs consent (`CONSENT_WITHDRAWN`); after consent is granted again, the older authorization is still stale (`AUTHORIZATION_STALE`) because it was issued at an older consent version; only a new authorization at the current version lets the benefit apply, and the receipt then carries that new version. A request built on the consent version before the new authorization is stale on the version (`CONSENT_VERSION_STALE`). The source never reports `withdrawnAuthorizationReused` as anything but `false`, and a payload that says otherwise is refused. A benefit that needs no consent is unaffected by a withdrawal.

An earlier application that relied on consent withdrawn afterwards is flagged (`consentWithdrawnSince`) and left as it is: whether such an application must be reclaimed is a product policy that is not published, so the page prints `UNDETERMINED`, reclaims nothing, and blocks only a new apply.

The CRM scope register separates the two things consumed (the consent state read and the authorization check) from the four that are outside this journey (audience segmentation, campaign send, a CRM profile, and a data-use export). No row completes a CRM product, the M05 label stays 미착수, and a screen with no contract does not complete it.

## Reclaim is not a refund and restores nothing

A cancelled order or an observed refund makes an applied benefit `reclaim-due` with its reason, and reclaims nothing. A reclaim is its own request. The receipt states `usageRestoration` as `UNDETERMINED`, the usage count and the coupon budget stay where the source had them, and the page restores and recomputes nothing. The journey issues no refund and composes no `refund_ticket`.

## The controller

`packages/protocol-adapter/src/marketing-journey-controller.ts`. The context key is the mode, the domain, the actor string, the subject, and a session incarnation.

| Event | What the controller does |
| --- | --- |
| A read that arrives for an older context | Dropped. It never touches the current view. |
| A read older than a newer applied one | Dropped. |
| A read that began before a write settled, or before a context switch, and answers late | Applied as evidence, and it does not clear the behind mark the write or the switch set (`behindAfterSeq`). Only a read that began afterwards can say the view is current, so a late early read cannot re-enable a second apply. |
| A subject scope switch | The watermark floor of the earlier subject is not carried to the new one. |
| A read that stops being ready (stale, denied, refused, tuple-changed, unavailable) | Rows are cleared. Nothing stale stays on screen. |
| `switchContext` (a subject scope or a new incarnation) | A new context at the next incarnation. A write in flight becomes `UNKNOWN` (`CONTEXT_SWITCHED`), and the snapshot is cleared. An unknown on a benefit still blocks that benefit for that subject when the person returns. |
| A write the last read cannot support | `FENCED` with the reason (`no-snapshot`, `snapshot-stale`, `not-listed`, `verdict-blocked`, `order-closed`, `already-applied`, `not-reclaimable`, `duplicate-intent`, `not-bound`). The port is never called. |
| A write while another is in flight or unknown on the same benefit | `FENCED` (`in-flight`, `unknown-outcome`). A different benefit is not held back. |
| A confirmed write | The read is marked behind (`own-write`) until the next read. |
| A rejected write | The read is marked behind (`rejection`): the source disagreed with the read the write was built from. |
| A write whose answer never arrived or arrived untrusted, including an answer that claims a purchase, a reward, a discount, or a send | `UNKNOWN`. It may have been recorded, every later write on that benefit is fenced, and a read does not lift the fence. |
| A result that lands after the context changed | Quarantined. It is applied nowhere and the earlier unknown still counts. |
| A thrown or cut-off read | `unavailable`. It is not sent again. |

The controller copies `expectedEligibilityVersion` and `expectedConsentVersion` from the last read and never raises them. There is no retry, no `Idempotency-Key`, no polling, and no stub fallback. The caller supplies each intent; the controller mints none. A started synthetic session is the page-load equivalent of a reload: nothing here resolves anything at a producer.

## Screen

`apps/web/src/marketing-journey.ts` holds the hook and the pure view builders. `apps/web/src/pages/MarketingJourneyPanels.tsx` renders them, and `apps/web/src/pages/MarketingJourney.tsx` composes the page. The sections are controls, status, the four stages, consent, benefits, orders and applications, rejections, the session record, and the contract register. Every source row prints `data-source="synthetic-marketing"` and `SYNTHETIC`.

Controls that are off use `aria-disabled` rather than a native `disabled`, so they stay in the keyboard order and name their reason through `aria-describedby`. A rejection, an unknown result, a fenced or unsent write, and a read the source refused, denied, found stale, or did not answer move focus to the status region. The scenario is a choice that applies only on its own button ("Start a session with this scenario"), so moving through the list with the arrow keys resets nothing. On `integration-http` the banner says NOT BOUND and claims no synthetic source (`data-source="none"`), and the scenario button and the four Simulate events are `aria-disabled` and point at a printed reason; they act on nothing and do not fall back to the synthetic source. The shell marks only the journey link as the current surface on `/marketing/journey`; the Marketing link stays current on the other marketing routes. Every state has a word, not only a style, and wide tables scroll inside their own labelled regions. The page posts nothing and calls no `fetch`. It starts one read when it opens and one read after each settled write or subject switch, and otherwise only when the person asks. Nothing polls and nothing sets a timer.

There is no control named for a purchase, a reward, a message, an audience, or a CRM product. The buttons are Apply, Reclaim, Read again, Switch subject scope, the scenario controls, and the "Simulate:" events.

## Contract fixture rows

The screen is registered as `marketing-journey` in `contract-fixtures.ts` with twelve synthetic rows: `stale-read` and `eligibility-stale` as `STALE`; `consent-withdrawn`, `authorization-stale`, `duplicate-use`, `usage-limit`, `budget-exhausted`, `scope-denied`, and `claim-refused` as `REJECT` with their codes; and `apply-lost`, `reclaim-lost`, and `read-lost` as `UNKNOWN`. None owns a pass and none substitutes a stub for a failed live call. The mapping table is `docs/c-contract-fixture-library-apps-bind.md`.

## Hold

The real connection is `c-marketing-journey`. This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, no live marketplace, no refund, and no message. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. Every figure stays the source's own number or `UNDETERMINED`. The product policies — whether a reclaim restores a usage count or a coupon budget, whether a withdrawal must reclaim an earlier application, how a presale priority is ranked, and what a CRM audience or campaign is — are not published, and they stay `UNDETERMINED`.

## Browser run

Observed in headless Google Chrome 154.0.8037.97 on 2026-10-14, driven by a Playwright script kept outside the repo. The stub desk was the default production build and the HTTP desk was a second build with mode `http` and base `http://127.0.0.1:8765`; the script served both from `127.0.0.1` with its own static server. Nothing was listening on port 8765. This table is from the last full run, after the fixes that an independent read of the diff led to; it describes the tree in this diff. There was no page exception and no console message on the stub desk. The HTTP desk added only the shell's failed probe to port 8765.

| State | Observed |
| --- | --- |
| Normal | `data-marketing-state="ready"`, "Benefits read." Four benefits with the source's verdicts `eligible`, `eligible`, `budget-exhausted`, `eligible`; four lanes (`discover=4`, `apply=0`, `reject=0`, `reclaim=0`); consent `granted` with a `valid` authorization; six CRM scope rows, two `consumed` and four `outside-this-journey`, each `data-completes-crm="false"`. Of eight apply controls six were on and the two for the budget-exhausted coupon were off with "The last read says budget-exhausted." One surface link (`/marketing/journey`) was current. Requests were three `GET`s to the page host |
| Keyboard apply | Tab reached "Apply ben-0002 to ord-0001" on the 44th press from the start of the page. Enter: "Apply recorded by the synthetic source as app-0001. It confirms no purchase, pays no reward, and applies no discount. This is not a protocol receipt." The application showed "Named by a confirmed apply of this page", the apply lane read 1, and the same apply control was then off ("This benefit is already applied to this order (app-0001)") and kept focus |
| Reclaim | "Simulate: ord-0001 is cancelled" with Enter: "This page has not read again, so it does not show this yet", and the application still read "Not due for reclaim". After Read again the order read `cancelled` and the application "Due for reclaim: the order was cancelled. Nothing was reclaimed by that." Reclaim with Enter: "Reclaimed at the source." The usage figure (1 of 1) and the budget (committed 3, limit 3) were unchanged, and "Usage and budget restoration on reclaim: UNDETERMINED." Every request in the run was a `GET` |
| Stale eligibility | "Simulate: the membership tier lapses" then Enter on "Apply ben-0001": the page had still shown `eligible`. "Apply rejected (ELIGIBILITY_STALE) … The membership basis is no longer at version 3. Read again to see what the source holds now", `data-return-action="read-again"`, focus moved to `mkj-status`, and after the read that followed the write ben-0001 read `not-eligible` and "The last read is current." |
| Consent withdrawal | Withdraw with Enter, then Enter on "Apply ben-0001": "Apply rejected (CONSENT_WITHDRAWN) … The earlier authorization is not reused", `data-return-action="manage-consent"`, with "Open the consent page". After the read, consent `withdrawn`, authorization `stale`, ben-0001 `consent-withdrawn` and off; ben-0002, which needs no consent, stayed on. After "grant consent again" and a read, ben-0001 read `authorization-stale` ("issued at consent version 2 … not reused") and stayed off. After "a new authorization is recorded" and a read it read `eligible`, and the apply gave an application that "Relied on consent version 4". Enter on the consent link went to `/marketing/m05` without a reload, and Back returned to a ready journey |
| Duplicate benefit | `duplicate-elsewhere`: Enter on "Apply ben-0001": "Apply rejected (DUPLICATE_USE) … already applied to ord-0001 (app-0001)". The application showed "Applied by another channel" and "Observed only. It is not named by a confirmed apply of this page, and this page does not claim it" |
| In progress | `held-response`: Enter on "Apply ben-0002 to ord-0001" left a session row `IN_FLIGHT`. The other order of that benefit was off with "Another write on this benefit is in flight (intent-1)", and a different benefit stayed on. "Deliver held response" with Enter gave the confirmed apply. A second held apply followed by "Switch subject scope" turned its row `UNKNOWN`, and after delivery the page printed "Result confirmed for intent-2 was quarantined (context-changed). It changed nothing." The read in the other scope was `denied` |
| Scenario picker | Four ArrowDown presses on the select moved only its value (to `consent-withdrawn`); the banner scenario stayed `clean` and four benefits stayed on screen. Tab reached "Start a session with this scenario", and Enter started the session with the chosen scenario |
| Empty, stale, denied | `empty`: "No benefit is listed for this subject in this read." `stale`: "Stale benefits read. Watermark 2026-10-10T00:00:00.000Z is older than the floor 2026-10-12T00:00:00.000Z." `denied`: `GRANT_REVOKED`. None showed a benefit. Stale and denied moved focus to the status region; empty moved none |
| Refused | `scope-leak`: "The payload was refused (SCOPE_LEAK)" naming `app-0099`. `snapshot-claims-crm`: "(CLAIM) … crmProductComplete". Neither showed a benefit or an application |
| Source verdicts | `consent-unset`: ben-0001 and ben-0004 `consent-required`. `usage-limit`: ben-0002 `usage-limit-reached`. `attribution-taken`: ben-0004 `attribution-taken`. `budget-race`: Enter on "Apply ben-0002" gave "Apply rejected (BUDGET_EXHAUSTED) … Nothing on this page corrects it", and the read showed it `budget-exhausted` |
| Lost and untrusted | `apply-lost`: "Apply result unknown (RESPONSE_LOST). It may or may not have applied. Writes on this benefit are blocked, and a read does not resolve it", focus on the status region, and the second order of that benefit off. `receipt-claims-reward`: "Apply result unknown (CLAIM)", the same fence, and no reward or rejection row |
| Subject scope | "Switch subject scope" with Enter: "The source refused this actor and subject (SCOPE_DENIED) … Actor fan-desk holds no grant for subject sub-0002." Zero benefits, focus on the status region |
| Narrow | At 360 px the page had no horizontal scroll (`scrollWidth` 360, the same as the `/inventory` baseline); two labelled, focusable regions hold the wide tables |
| Navigation | One surface link was current on `/marketing/journey`, and only the Marketing link on `/marketing/m01`. The marketing hub links to the journey |
| HTTP desk | `data-marketing-state="not-bound"` with the not-bound reason, `data-adapter-environment="integration-http"`, zero benefits and zero applications, a banner that says NOT BOUND with `data-source="none"`, and "Start a session with this scenario" and the four Simulate events `aria-disabled="true"` with `aria-describedby` pointing at a printed reason. Enter on the scenario button and on a Simulate event left the state, the environment, and the row count unchanged. The only request outside the page host was the shell's `GET /health` probe to port 8765, which failed with `ERR_CONNECTION_REFUSED`. No `POST` |

Not observed in the browser: a screen reader pass, the loading frame (the stub port answers within a microtask, so the in-progress state was caught through the held response instead), and a real producer, which stays unverified by design for this stub scope.

## Tests

`packages/protocol-adapter/test/marketing-journey.test.ts` covers the contract register against the vendored pin, the not-composed and not-posted records, the locked hold binding and the byte-identical bindings file, the CRM scope, the return action per code, the reference kinds, the port selection, every read outcome, every rejection code, the three-step consent test, the reclaim and order events, every invalid request, every scenario, the payload validators, and a source scan. `packages/protocol-adapter/test/marketing-journey-controller.test.ts` covers the context key, dropped reads, the fences, send-once, version copying, the three end-to-end journeys (stale eligibility, consent withdrawal, duplicate benefit), reclaim, unknown outcomes, quarantine, subject switching, and a controller source scan. `apps/web/test/marketing-journey.test.tsx` covers the screen for each state, the four lines, the guarded controls and their reasons, the fence sentences, the result lines, the absence of a purchase, reward, message, or CRM control, the three journeys as rendered, reclaim, the figures copied verbatim, the non-claims, the CRM and consent records, the mounted route, the hub link, the registry row, the handoff pending row, the twelve fixture rows, and a source scan of the three new web modules.
