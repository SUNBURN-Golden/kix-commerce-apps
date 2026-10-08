# Wave 6-A journey test apps bind

This bind records the live loopback journey test and the stub step-sequence parity for `BookingJourney`. Stub mode stays the default. HTTP mode stays the opt-in loopback. This document adds no command, no read, no retry, and no desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The helper composes `create_event`, then `prepare_trade`, then `accept_trade`, and nothing past `accept_trade`. `capture` and `settle_capture` are never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only an `invokeLocalCall` body.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 stays shut until `w6a-evidence` merges (kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7). No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them.

The parity report compares step, action, a normalised actor (`operator` or `buyer`), and sorted body and result key names. It does not compare ids or hashes. The shape-only invoker in `test/support/journey-fixture.ts` is a test fixture. The shipped `StubProtocolAdapter` has no `invokeLocalCall`, so the journey cannot run on the stub as a fallback.

## Evolution coverage

These rows map each case onto the test that already proves it. The new live file adds refresh, expiry, the live parity run, and the live request-before-effect fences. It does not copy the scripted fault file.

| Evolution case | Boundary | Test (file › name) | Mode |
| --- | --- | --- | --- |
| request-before-effect | `seatIndex` outside the created inventory, before any prepare request | `booking-journey-gate.test.ts` › does not send prepare_trade when seatIndex is outside the created inventory | live-gate |
| request-before-effect | unknown inventory id, gate rejection, next write fenced | `booking-journey-gate.test.ts` › fences the next write after the gate rejects an unknown inventory id | live-gate |
| request-before-effect | closed port | `booking-journey.test.ts` › fences after closed-port and does not mint an operationId | stub-run |
| request-before-effect | pre-send halt | `booking-journey.test.ts` › halts on a pre-send failure and does not call the invoker | stub-run |
| effect-with-response-loss | `create_event`, `prepare_trade`, and `accept_trade` | `booking-journey.test.ts` › records one create_event / prepare_trade / accept_trade effect and then loses the response | stub-run |
| effect-with-response-loss | discarded `create_event` success on the gate | `booking-journey-live.test.ts` › treats a discarded success response as unknown and does not send the next step | live-gate |
| stale correlation, wrong operation, extra keys | scripted receipt faults | `booking-journey.test.ts` › fences after stale / wrong-operation / extra-keys and does not mint an operationId | stub-run |
| malformed receipt | `bad-result` | `booking-journey.test.ts` › fences after bad-result and does not mint an operationId | stub-run |
| refresh | new `BookingJourney` after `UNKNOWN`; same `eventId` is `EVENT_EXISTS` | `booking-journey-gate.test.ts` › keeps a refreshed journey incomplete after a discarded create_event | live-gate |
| expiry | `accept_trade` when the clock has reached the reservation boundary | `booking-journey-gate.test.ts` › rejects accept_trade once the dedicated gate clock reaches expiry | live-gate |
| no retry and no `Idempotency-Key` | three local-call posts, header absent | `booking-journey-gate.test.ts` › matches the stub step report on the live gate | live-gate |
| no retry and no `Idempotency-Key` | one 422, then a fence | `booking-journey.test.ts` › treats a 422, including a transport-shaped error string, as a rejection and fences | stub-run |
| no next write while `UNKNOWN` | refreshed `prepare_trade` sends nothing | `booking-journey-gate.test.ts` › keeps a refreshed journey incomplete after a discarded create_event | live-gate |
| no next write while `UNKNOWN` | lost response does not start the next step | `booking-journey.test.ts` › records one create_event effect and then loses the response | stub-run |

Timeout and cutoff sit on the same `fences after %s and does not mint an operationId` test as the stale, wrong-operation, extra-keys, bad-result, and closed-port rows. A closed port on the parity file also shows that the shape-only invoker is not called.

## Expiry clock

Read from the reviewed tree (`52a9b5cbf7777df55d2d2062cb8d99d862b423bb`, feature `c7238bc24a399a6cabbab87ac23dbfd7e9c252dd`, one tree). `reference/v0.3-rc1/core.py` starts `clock` at `0`. `prepare_trade` on this journey omits `expiresAt`, so `LifecycleMixin._prepare_trade` sets it to that clock plus `reservationSeconds` from the create receipt. The create default is `900`. `Core._accept_trade` rejects `TRADE_NOT_ACCEPTABLE` when `clock >= expiresAt`.

The expiry test starts its own `python3 -m integration_gate --port 0` process. `advance_clock` is monotonic (`INVALID_FIXTURE_CLOCK` going backwards), so that call stays off the process shared with the other live cases. The test sends `now` equal to the create receipt's `reservationSeconds`. That call is raw and test-only. `BookingJourney` does not send `advance_clock`.

## Run locally

From the repository root. The desk job is:

```bash
npm ci
npm run typecheck
npm run build
KIX_REQUIRE_GATE=0 npm test
```

The parity file runs there. The live files skip with a warning when no reviewed checkout is configured. That skip is not a pass of the live suite.

The live suite needs the reviewed checkout, clean, plus `python3`:

```bash
KIX_PROTOCOL_ROOT=/path/to/kix-protocol-at-52a9b5cb KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter
```

Attach that output to the PR. If the checkout is not available, say the live suite was not run. Do not call a skip a pass.

## CI

`.github/workflows/ci.yml` is unchanged. `desk` sets `KIX_REQUIRE_GATE=0` and runs `npm test`, including the parity file. `gate-token` looks for the `KIX_PROTOCOL_READ_TOKEN` secret. `live-gate` runs `npm test -w @kix/protocol-adapter` with `KIX_REQUIRE_GATE=1` only when that secret is present. Without the secret, `live-gate` is skipped, not passed.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. The five pins stay where the gate bind put them.
