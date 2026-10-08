# Wave 6-A UI skeleton apps bind

The booking screen (`/booking/:eventId`) and the box office (`/`) show the catalogue journey step by step. Stub mode stays the default. HTTP mode stays the opt-in loopback. This screen does not add a command, a read, a retry, or a desk binding.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The panel runs `create_event`, then `prepare_trade`, then `accept_trade`, through `BookingJourney`. `capture` and `settle_capture` are never composed and never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed. `placeHold.consideredAction` stays `reserve_listing`. `placeHold` stays not-bound. `prepare_trade` is only the journey body. `placeHold({ eventId, quantity })` is not mapped onto it. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged.

The Wave 6 gate record is [kix-protocol issue 56, comment 5868307343](https://github.com/BeautifulMind-JT/kix-protocol/issues/56#issuecomment-5868307343). Wave 7 stays shut until `w6a-evidence` merges (kix-protocol `docs/decisions/PROGRAM_ROADMAP_20260930.md` §2 R-7). No catalogue, gate, or SDK change is consumed. Both OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` stay where the gate bind put them.

## What the screen shows

Stub mode runs a shape-only invoker in the adapter. Receipts are labelled stub-shape. They are not from the gate. The shipped `StubProtocolAdapter` still has no `invokeLocalCall`. HTTP mode uses `HttpProtocolAdapter` as the invoker and does not build a stub when the probe fails.

In a browser, integration HTTP shows the path as unavailable. The reviewed gate answers no CORS preflight (`docs/http-integration-gate-apps-bind.md`). The desk stays on integration HTTP. It does not fall back to the stub. Node tests exercise the live gate. A browser path needs a kix-protocol gate change. The page does not print a gate URL, and it does not add a dev-server proxy.

`create_event` sends a synthetic fixture policy, the same object as `SHOW_POLICY` in the journey test support. The screen does not display a price or a fee. A different value, or a displayed price, would be a product policy decision.

Operation ids are `jrn:<eventId>:<attempt>:<step>`. The attempt comes from the desk attempt counter and increases once per new page-load journey, so a reload does not reuse an id in the same tab. The UI does not mint a replacement id after a fence. An id the helper refuses (length or whitespace) is not sent.

State is page-load only. A reload clears the fence and starts a new journey. On a real gate the same `eventId` can then answer `EVENT_EXISTS`. That is not a confirmation of the cleared request, and it is not a business rejection of it.

## States

| Path status | Meaning |
| --- | --- |
| `available-stub-shape` | Stub is selected. Sends are allowed. Receipts are stub-shape. |
| `checking` | Integration HTTP is selected and the probe has not returned. Sends stay off. |
| `available` | The probe reported `up`. A browser does not reach this while the gate refuses CORS. |
| `unavailable` | The probe is `degraded` or `unavailable`, or the probe threw. Sends stay off. |

| Row status | Meaning |
| --- | --- |
| `not-started` | Waiting for an earlier step, or still checking. |
| `ready` | The next step that can be sent. |
| `in-flight` | One attempt is outstanding. |
| `confirmed` | The step has a receipt. |
| `rejected` | The gate rejected the step. This is the only business-rejection wording. |
| `unconfirmed` | Sent, no authoritative receipt. It may have applied. It is not a rejection. |
| `not-sent` | The helper refused the step before a request. |
| `blocked` | A halt fences this step. The next write stays blocked, including while the halt is `UNKNOWN`. |
| `unavailable` | The path is unavailable. No write is sent. |

The lines `Last confirmed receipt` and `Unconfirmed request` are separate. A timeout or a lost response is `unconfirmed`, not `rejected`. There is no retry control and no reset after `UNKNOWN`.

The box office is read-only. It shows the path, the planned steps, and the journeys opened on this page load, with a link to `/booking/:eventId`. Writes happen on the booking screen. The booking screen also shows the panel while the performance is loading and when the performance is missing, including when `listPerformances` is not-bound.

## Run locally

From the repository root:

```bash
npm ci
npm run typecheck
npm run build
KIX_REQUIRE_GATE=0 npm test
```

`KIX_REQUIRE_GATE=0` lets the live-gate files skip. A skip is not a pass of the live suite.

Browser, stub:

```bash
npm run dev
```

Open `/` and `/booking/<an id from the list>`. Send the three steps in order. Reload and confirm the page-load state is gone. Open an unknown event id and confirm the alert.

Browser, HTTP, with nothing listening (closed port) or with the reviewed gate (`python3 -m integration_gate --port 8765` at `52a9b5cb…`, only if that checkout is present):

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=http://127.0.0.1:8765 npm run dev
```

Both routes show unavailable and the send controls stay disabled. Do not start any other server. Do not add a proxy.

The adapter live suite, when the reviewed checkout is available:

```bash
KIX_PROTOCOL_ROOT=/path/to/kix-protocol-at-52a9b5cb KIX_REQUIRE_GATE=1 npm test -w @kix/protocol-adapter
```

If that checkout is not available, say the live suite was not run.

## Hold

No production deploy, no public host, no real payment, no KYC, no credit disbursement, no venue scan, no bank rail, and no live marketplace. No SLO. No Move, kernel, or settlement math is copied. Nothing in this change is inside kix-protocol. The web UI does not call `fetch`. `packages/protocol-adapter/src/commerce-bindings.ts` is unchanged. The five pins stay where the gate bind put them.
