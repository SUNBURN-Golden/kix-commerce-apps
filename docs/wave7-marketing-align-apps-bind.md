# Wave 7 marketing align apps bind

This bind records how the M01–M05 stub sits against the published contract-only catalogue. Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

## Status and gate

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343).

Wave 7 opens when `w6a-evidence` merges. The gate record for that opening is kix-protocol [`docs/decisions/PROGRAM_ROADMAP_20260930.md`](https://github.com/BeautifulMind-JT/kix-protocol/blob/main/docs/decisions/PROGRAM_ROADMAP_20260930.md) §2 R-7. This worktree could not read that file, or kix-protocol `TASK_005`. The quote of R-7 already recorded in [wave-6a-evidence-apps-bind.md](wave-6a-evidence-apps-bind.md) is the in-repo copy: when the kix-commerce-apps node `w6a-evidence` merges, Wave 7 opens. This file does not quote `TASK_005` line contents, and it does not invent them.

M2 is selected. The booking journey composes `create_event`, then `prepare_trade`, then `accept_trade`, and nothing past `accept_trade`. `capture` and `settle_capture` are never composed and never sent. Marketing does not compose them either. `commit_trade`, `open_admission`, and `admit` stay uncomposed on that journey.

H1 is selected. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body on the journey. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. Marketing is not a `CommerceProtocol` desk method, so there is no new `COMMERCE_METHODS` entry.

No catalogue, gate, or SDK change is consumed. No compatibility manifest is consumed, so the evolution consumption rule has nothing to move. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the README Protocol pin section records them. This document does not copy that table.

The live-gate job (`KIX_REQUIRE_GATE=1`) was not run locally. It needs a kix-protocol checkout and the `KIX_PROTOCOL_READ_TOKEN` secret. A desk-job skip of the adapter gate suites is not a pass.

## Alignment

`MARKETING_CONTRACT_ALIGNMENT` in `apps/web/src/marketing/contracts.ts` is the record. It holds field names only. It holds no values, no policy, and no amounts. It does not feed `invokeLocalCall`. The stub never builds a `set_consent` or `authorize_marketing` body.

| Surface | Published command | Recorded state | Why the stub does not use it |
| --- | --- | --- | --- |
| M01 | none | `no-published-command` | No catalogue command for membership. Pending name: `wave7-marketing-contracts`. That contract is not merged here. |
| M02 | none | `no-published-command` | No catalogue command for presale. `listPerformances` is an adapter display read, not a catalogue command. Recording interest does not place a hold. |
| M03 | none | `no-published-command` | No catalogue command for a coupon. Markers have no price and no tender. |
| M04 | none | `no-published-command` | No catalogue command for a referral. The desk has no disburse action. |
| M05 | `set_consent`, `authorize_marketing` | `published-not-bound` | Both names are in the vendored catalogue. This stub does not call them. Binding is the later node `w7-m05-consent-bind`. |

`set_consent` field names: `allowed`, `business`, `channel`, `domain`, `eventId`, `expectedConsentVersion`, `purpose`. All of those are required. `additionalProperties` is false.

`authorize_marketing` field names: `business`, `channel`, `domain`, `eventId`, `expectedConsentVersion`, `purpose`, `subject`. All of those are required. `additionalProperties` is false.

The stub flags are `performanceNotes` and `membershipNotes`. They are not that body. The screen prints the missing field names and does not collect them. No `purpose`, `channel`, `business`, `subject`, or `expectedConsentVersion` value is chosen here.

M01–M04 stay 설계중. M05 stays 미착수. Labels are not promoted.

## Not bound / not called

Marketing sends no booking, resale, admission, settlement, or credit write. It also sends no `capture`, `settle_capture`, `prepare_trade`, or `reserve_listing`. It does not send `set_consent` or `authorize_marketing`. It does not send `commit_trade`, `open_admission`, or `admit`.

`placeHold` stays not-bound with `consideredAction` `reserve_listing`. Marketing does not map any desk method onto a different body.

`MARKETING_BOUNDARY` stays `protocolBinding: "none"`, `openApiBound: false`, `outboundSend: "none"`, and `creditDisbursement: "none"`.

Runtime code under `apps/web/src/marketing` does not import the protocol adapter and does not read the OpenAPI pin. The pin read is the test `apps/web/test/marketing-contracts.test.ts`, at test time only.

## Browser run

Observed in headless Chrome 154.0.8037.57 on 2026-10-09. The stub desk was Vite preview of the production bundle at `http://127.0.0.1:5283`. The HTTP desk was a second preview at `http://127.0.0.1:5284`, built with `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765`. Nothing was listening on port 8765. No page exception was reported. Ports 5173 and 5174 were already in use by other worktrees, and a dev server could not start because the file-watcher limit was exhausted, so this run used `vite preview` instead of `vite` dev.

| State | Observed |
| --- | --- |
| Stub hub | Published contract section for M01–M05. M05 label `M05 · 미착수`. M05 line names `set_consent` and `authorize_marketing` as published, not called. Tier `guest`, consent `unset`. OpenAPI bound `no`. |
| M02 as guest | `데모 창 닫힘 · Closed`. Catalog titles loaded. North Station Lanterns still showed `40 still open`. All three Record demo interest buttons were disabled. |
| M01 blank name | Alert: `Enter a display name of 1–40 characters.` No card. |
| M01 card | Display name Mira. Local ref `mbr_stub_1`. Status `설계중`. |
| M02 after that card | `데모 창 열림 · Open`. Interest recorded for North Station Lanterns at 8 Oct 2026, 16:34 UTC, window `open-demo`. Capacity stayed `40 still open on the catalog`. No hold was created. |
| M03 fixture | `LANTERN-NOTE` attached. |
| M03 duplicate | `That demo code is already on this session.` |
| M03 unknown | `Unknown demo code. Markers are display-only.` |
| M04 own code | `This session cannot accept its own demo code.` Markers stayed 0. Credit disbursement `none`. |
| M04 unknown | `Unknown demo referral code.` |
| M04 partner | Counted `REF-STUB-HALL`. Demo markers `1`. Credit disbursement `none`. |
| M05 save | Stamp `SAVED` (the stamp style uppercases the word). Text included `not the set_consent body`, the missing field names, and `channelSend: none`. |
| M05 withdraw | Stamp `WITHDRAWN`. `channelSend: none` stayed. The same not-the-body line stayed. |
| Hub before reload | Tier `fan`, presale notes `1`, coupon markers `1`, reward markers `1`, consent `withdrawn`. |
| Reload | Tier `guest`, presale notes `0`, coupon markers `0`, reward markers `0`, consent `unset`. `mbr_stub_1` was gone. |
| Integration HTTP on M02 | Banner: `Loopback gate is unavailable (GATE_UNAVAILABLE). The client does not retry and does not fall back to the stub. The desk stays on integration HTTP.` Alert: `listPerformances is not-bound. The contract-only catalogue has no list or read command. listPerformances stays on the stub.` That last sentence is the recorded not-bound reason. The catalog titles were not shown. The window stayed closed. There was no stub catalog and no stub fallback. |

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. The five pins stay where the gate bind put them.
