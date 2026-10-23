# Session recovery stub apps bind

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

This bind is the stub-scoped session recovery desk at `/session`, the synthetic reduction of pending node `c-async-session-fence`. That pending node stays in `docs/aiops/PENDING_NODES.json` and waits on its kix-protocol prerequisites. This node records an intent and its conflict scope in a tab-session journal before a synthetic write is sent, recovers an unsettled intent as `UNKNOWN` after a reload, and shows lost evidence as `SESSION_EVIDENCE_LOST`. It is not a producer connection and does not claim one. The journal format is app-internal and is never an external schema, operation, capability, or identifier.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README protocol pin section put them, and SDK, manifest, and vector digests stay null. `packages/protocol-adapter/src/commerce-bindings.ts` stays byte-identical. `contract_change=NO`. Built on main `c568c04`.

## What this page sends

Nothing goes to a protocol. The only write is the synthetic `attach` of `/identity`, reused through `JourneyIdentityController`: it lands on an in-process synthetic source. `capture` and `settle_capture` are never composed or sent, `commit_trade`, `open_admission`, and `admit` stay uncomposed, and `refund_ticket` is recorded in `JOURNEY_IDENTITY_NOT_COMPOSED` and never sent. `placeHold` stays not-bound with `consideredAction` `reserve_listing`. No desk method is remapped onto another body.

On `integration-http` the attach is `not-bound` (the contract-only catalogue has no journey read or evidence command). There is no stub fallback, no third adapter, and no request from this page. The existing loopback health probe the adapter makes in HTTP mode also fires on `/identity`; this page adds nothing to it.

## The journal

`openSessionJournal(store)` reads `sessionStorage` through a structural port (`getItem`, `setItem`, `removeItem`). Only `apps/web/src/session-store.ts` names the browser store; a blocked or missing store returns `null` and the journal then holds every write. No `localStorage`, cookie, server, or IndexedDB is used.

| Item | Value |
| --- | --- |
| Key | `kix-session-journal`; damaged blobs are set aside under `kix-session-journal-quarantine` |
| Version | `v: 1`. Any other version, or none, is `UNSUPPORTED_VERSION`. No migration exists because only v1 exists |
| Envelope | `{ v, loads, nextSeq, records, digest }`. The digest is a SHA-256 over the rest. It detects damage and is not authentication |
| Record | `{ seq, intentRef, scope, contextTag, outcome, code, loadNo }`. `outcome` is `IN_FLIGHT`, `CONFIRMED`, `REJECTED`, or `UNKNOWN` |
| Personal data | None. `intentRef`, `scope`, and `code` are short ASCII tokens, and `contextTag` is a 16-hex hash prefix of the context key, so an actor label never reaches storage. Anything else is refused before it is stored |
| Budget | 32 records and 12288 bytes. These are implementation choices, not a product policy value |
| Clock | None. Order is the sequence number and the load number. There is no timestamp |

There is no `clear`, `remove`, `evict`, `expire`, `resend`, or `resolve` call on the journal or the controller. A test checks that.

## The write flow

`SessionRecoveryController.run(target)`:

1. Verify the store against what this journal last wrote. A cleared store is `LOST_DURING_SESSION`; a damaged one is quarantined.
2. Gate. Evidence lost or no store holds every scope. An `UNKNOWN` or `IN_FLIGHT` record on the target's scope, from this page load or an earlier one, fences it. Then the underlying desk's own fence applies. Another scope is not affected.
3. Write the `IN_FLIGHT` record ahead of the send and read it back. A quota error, a blocked store, a write that throws part way, and a write that silently cuts the text short all refuse the intent, put the earlier blob back, and send nothing.
4. Send once.
5. Settle the record. If the answer cannot be recorded, the scope is locked `UNKNOWN` with `JOURNAL_SETTLE_FAILED`, and the answer is kept in memory as an observation only. The lock also holds after a reload.

Before step 3 the byte check reserves room for every open record to settle as `UNKNOWN` with the longest code, so a settle never overflows. A full journal refuses the next intent (`JOURNAL_FULL`) and evicts nothing, because an eviction could drop a fence.

## Recovery

Opening the journal counts one page load. Every record still `IN_FLIGHT` becomes `UNKNOWN` with `RECOVERED_AFTER_RELOAD`, and the change is written. A `pageshow` with `persisted` does the same with `TAB_RESUMED`. A later answer for such a record is kept in memory as evidence and changes nothing. Intent numbers continue across loads from `nextSeq`, so no number is issued twice.

After a reload, an unresolved intent comes back as UNKNOWN and is never sent again. The page has no resend, resolve, clear, or compensate control. Neither a read nor a late answer lifts the fence, and no new write or compensation goes out for that subject. A `CONFIRMED` record from an earlier load is shown as history: it is not a current fact and it lifts no fence.

## Lost evidence

| Cause | When |
| --- | --- |
| `CORRUPT` | Not JSON, wrong shape, extra key, bad record, digest mismatch, or over the byte budget |
| `UNSUPPORTED_VERSION` | Valid JSON with a `v` other than 1, or none |
| `LOST_DURING_SESSION` | The journal this page wrote is gone from the store during the session. The loss is recorded in the quarantine entry (cause only, empty `raw`), so it survives the next load |

The damaged blob is copied to the quarantine key and the original is removed. If the quarantine write fails, the original stays where it is and the session is still lost. The quarantine entry survives the next load, so a reload is not a way out. A loss is recorded only once the page notices it (a run, a resume, or the tab becoming visible runs the check); a clear followed by an immediate reload with no check looks like a new tab. If the quarantine write itself fails, the hold lasts this page load only. While evidence is lost every write is held, `nextSeq` is not reset, and no new reference is issued.

## UNDETERMINED and out of scope

| Item | State |
| --- | --- |
| Retention (how long a record is kept) | `UNDETERMINED`. It is a product and legal value that nobody has set. This node has no TTL, no expiry, and no control that removes a fence, so the fence is never cleared by time |
| Resolving or resending an `UNKNOWN` | Not done. The pinned catalogue has no authoritative confirmation to base it on, and a user-confirmed resend would be a new retry semantic that needs its own decision |
| A cleared or new tab | Indistinguishable. Only a mid-session loss is detected, and the page says so |
| Duplicated tab | The copy inherits the journal and the two then diverge. There is no cross-tab lock |
| Cross-device | No guarantee |
| Exactly-once | Not claimed. `exactlyOnceClaimed` and `durableAcrossStorageLoss` are `false` in the controller state, and the page prints the notice in every state |
| Schema migration | None, since only v1 exists |
| HTTP send | Stays `NOT_BOUND`. No producer, SDK, or provider |

## Acceptance mapping

| Spec item | Where it lives | Test |
| --- | --- | --- |
| Versioned `sessionStorage`-only journal, minimal data | `session-journal.ts`, `session-store.ts` | `session-journal.test.ts` (field refusal, round trip, source scan) |
| Quota or blocked write refused before send; failure after send is UNKNOWN | `begin`, `settle`, `markUnknown` | `session-journal.test.ts`, `session-recovery-controller.test.ts` |
| Reload or resume recovers UNKNOWN with no resend; cached CONFIRMED is history | `open`, `recoverInFlight`, `resume` | `session-recovery-controller.test.ts`, `session-recovery.test.tsx` |
| Corrupt or unsupported journal is quarantined as `SESSION_EVIDENCE_LOST`; no new IDs; no TTL | `quarantine`, `verify` | `session-journal.test.ts` (twelve damage cases, a failed quarantine, a store cleared mid-session, a thousand load cycles) |
| Record and byte budget with overflow | `begin` | `session-journal.test.ts` (the 33rd record, a small byte budget, no eviction of an UNKNOWN) |
| Done 1: a reload adds no command | `sent` stays 0 across the reload | spy on the port in `session-recovery-controller.test.ts`; browser pass |
| Done 2: nothing new or compensating after UNKNOWN | `gateFor` | same suites; another scope still sends |
| Done 3: storage loss is not shown as exactly-once | standing notice, state flags | `session-recovery.test.tsx` |

## Browser pass

Built from the worktree (`vite build`, one stub build and one `VITE_KIX_PROTOCOL_MODE=http` build) and served by a static server with SPA fallback; headless Chrome 1000px and 360px via playwright-core. Observed:

- Fresh tab: empty state, standing notice, retention `UNDETERMINED`.
- `attach-lost`, attach, reload: the page shows one unresolved write as UNKNOWN; that subject's Attach is `aria-disabled` with a printed reason, another subject's Attach is enabled, `Sent 0 in this load`, and the request log holds no non-GET request. Three more reloads keep it unknown with sent 0.
- Keyboard: Enter and Space on the off Attach send nothing and the control is focusable; Enter on the other subject sends once.
- `held-response`, reload while in flight: the in-flight state shows before, and after the reload the record is a recovered UNKNOWN with sent 0.
- A confirmed record shows as this-load, and as history after a reload.
- A corrupt blob and an unsupported version injected into the tab's store: `SESSION_EVIDENCE_LOST` with the cause, both Attach controls off, the blob moved to the quarantine key, still lost after another reload, Enter sends nothing.
- A store cleared in the page: `LOST_DURING_SESSION`, nothing sent.
- A store filled to its quota: Attach is refused with "Nothing was sent", no record is created.
- Integration-http build: `not-bound`, no Attach control, no request to the API beyond the adapter's existing loopback health probe, which `/identity` makes too.
- 360px: no horizontal overflow; the subject table sits in a focusable scroll region. No page error.

Not verified: a real mobile device, real bfcache restore (`pageshow` with `persisted` is covered by the controller test only), a real browser quota on another engine, and the HTTP gate from a browser (CORS). The simulated reload in the controller tests is a second journal over the same fake store, not a browser reload; the browser pass is where a real reload was seen.

## Hold

The real node is `c-async-session-fence` (a pending node that waits on kix-protocol work). This node consumes no SDK, manifest, or vector and serves no producer. No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Against a producer nothing is verified, since no live environment exists for this stub scope.

## Tests

`packages/protocol-adapter/test/session-journal.test.ts` covers the journal: tokens only, recovery, resume, the damage cases, quarantine, quota, reopening over a store cleared mid-session (still evidence-lost, nothing written), partial and silent partial writes, the budgets, and the source scan. `packages/protocol-adapter/test/session-recovery-controller.test.ts` covers the write-ahead order, a reload with a spy on the port, a reload after a store cleared mid-session (fenced, no second send), the fences, a settle that cannot be written, evidence loss, a tab resume, the not-bound desk, and the missing resend and clear calls. `apps/web/test/session-recovery.test.tsx` covers the rendered states, the off controls' reasons, the registry row, the fixture rows, the source scan, and the docs.
