# SDK0 mock scenario kit (stub)

## Consumption evidence correction — 2026-10-23

Recorded option (b) now binds the consumed p-sdk-0 BOOTSTRAP SDK, manifest, and vector digests into fixture catalogue v2, discovery's shared synthetic-port checks, release, qualification, and handoff. See [audit-6-decision-apps-bind.md](audit-6-decision-apps-bind.md) for the owner ruling, current tuple, historical v1, consumer mapping, verification, and boundaries. Unavailable domain producer tuples retain nulls and NOT_BOUND. BOOTSTRAP remains `catalogue-schema-binding only`; this grants no qualification or release authority.

The original delivery description and run records below are historical. Any statement there that consumption digests stay null describes v1 at that delivery, not the current app evidence tuple. Both OpenAPI pins, `PINNED_ACTIONS`, the CI gate SHA, `protocolMergeSha`, and locked desk bindings are unchanged.

## Scope and ruling

`contract_change=NO`. This is app-internal offline demo/test material over the already-vendored p-sdk-0 BOOTSTRAP SDK and contract-fixture catalogue v1. It introduces no public schema, operation, capability, identifier format, route, screen, runtime adapter, or dependency.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

The journey contains `create_event` → `prepare_trade` → `accept_trade` only. `capture` and `settle_capture` are never composed or sent. `commit_trade`, `open_admission`, and `admit` remain uncomposed in that journey. `placeHold` records `reserve_listing` as its considered action and stays not-bound; its body is never mapped onto `prepare_trade`. The not-bound cases copy the catalogue's existing reasons.

Builder source HEAD: `288c8ef8b58dec52093cfbc0a9cbca6b65deeab3` on `agent/kixc-c-sdk0-mock-scenario-kit-stub`. Changes are intentionally uncommitted for supervisor review. This document describes the working-tree delta from that source, not a newly committed delivery SHA.

## Verified SDK tuple

`SDK0_MOCK_PROVENANCE` records a separate binding from verified `KIX_SDK_0_PIN`:

| Field | Value |
| --- | --- |
| Producer merge | `a74e7c459d3be6754ac3cf24503e43c7bc312358` |
| Producer source commit | `7481b0e16ce9b903abbffa62249bb91cd9e63cfe` |
| Manifest sha256 | `1cce4ee5a9aa64ef40825c0e6dedf920050e594cf20ea0aaf087ecbde46f0cca` |
| Generated catalogue sha256 | `891ddd65f29262603bd0f76746a9308c810a71d4afd717b0f4d2e3f7d46dbaa2` |
| Profile kind / revision | `BOOTSTRAP` / `bootstrap-1` |
| Profile sha256 | `4c92cf6d905f83fb3f5cd52e166dbadf057451ae46441fce1f91baaaa4367d34` |
| Grants | `catalogue-schema-binding only` |

The SDK supplies `CommandName` and `LocalCallEnvelope`, with `body: Record<string, unknown>` and untyped results. The kit uses those types and `buildLocalCallEnvelope`'s existing generated-client schema validator offline. Receipt envelopes pass `assertLocalCallReceipt` and `enforceRemotePayloadGuards`; independent result-key assertions and the actual `BookingJourney` verify local result consumption. These checks do not establish generated result typing or semantic conformance.

Catalogue v1's `sdkDigest`, `manifestDigest`, and `vectorDigest` stay null. Its historical tuple and evidence are unchanged; SDK provenance is attached only to the new scenario wrapper. The OpenAPI pins, `PINNED_ACTIONS`, CI gate SHA, vendor material, and `commerce-bindings.ts` are unchanged.

## Scenario API

Import directly from `packages/protocol-adapter/src/sdk0-mock-scenarios.ts`. The module is deliberately absent from the runtime barrel and package exports, and from `apps/web/src` imports. A local demo harness can consume the same synchronous snapshots as the tests without selecting an adapter.

```ts
import {
  createSdk0MockScenario,
  scenarioObservation,
} from "./packages/protocol-adapter/src/sdk0-mock-scenarios";

const scenario = createSdk0MockScenario({
  fixtureId: "booking-journey.create_event.success",
  seed: 7,
});
const observation = scenarioObservation(scenario);
```

`SDK0_MOCK_SCENARIO_IDS` is the supported case list. `Sdk0MockScenario` is a discriminated union on `klass`. Every scenario contains a fresh catalogue `fixture`, its `projection`, `fixtureId`, `seed`, `tupleKey`, `source: "stub-shape"`, and `sdkBinding`. The source describes synthetic kit output even when the historical fixture describes a gate failure. These wrappers are never added to a command body or receipt.

- `SUCCESS`: a validated SDK `envelope`, a local `receipt`, and null `failure`.
- `REJECT`, `UNKNOWN`, `STALE`: a validated SDK `envelope`, null `receipt`, and serializable `failure` with `code`, `requestId`, and `correlationId`.
- `NOT_BOUND`: null envelope, receipt, and failure, plus `method`, `consideredAction`, and the recorded `reason`. No manufactured command body.

Receipts contain exactly `domain`, `operationId`, `sequence`, `action`, and `result`. `fixtureObservationFor(fixture, patch?)` replaces duplicate full-catalogue test helpers. `scenarioObservation(scenario)` reads constructed envelope identity, failure code, and actual receipt result keys for classification against the original catalogue.

## Case/class/body/result mapping

All kit sources are `stub-shape`. Command identities (operation, actor, action) are copied unchanged from each named catalogue case. Body signatures below are exact key sets:

- C: `domain`, `eventId`, `organizer`, `policy`, `seats`.
- P: `amount`, `buyer`, `domain`, `expectedInventoryVersion`, `expectedVersion`, `inventoryId`, `tradeId`.
- A: `domain`, `termsHash`, `tradeId`.

| Fixture ID | Class | Action or method | Body | Result keys / failure |
| --- | --- | --- | --- | --- |
| `booking-journey.create_event.success` | SUCCESS | `create_event` | C | `eventId`, `policyHash`, `inventoryIds`, `reservationSeconds` |
| `booking-journey.prepare_trade.success` | SUCCESS | `prepare_trade` | P | `tradeId`, `ticketId`, `externalOrderId`, `status`, `termsHash` |
| `booking-journey.accept_trade.success` | SUCCESS | `accept_trade` | A | `accepted` |
| `booking-journey.create_event.reject` | REJECT | `create_event` | C | no result; `EVENT_EXISTS` |
| `booking-journey.create_event.unknown` | UNKNOWN | `create_event` | C | no result; `INTERNAL_ERROR` |
| `booking-journey.create_event.stale` | STALE | `create_event` | C | no result; `STALE_RESPONSE` |
| `not-bound.placeHold` | NOT_BOUND | `placeHold` considers `reserve_listing` | none | no result or failure |
| `not-bound.confirmBooking` | NOT_BOUND | `confirmBooking` considers `capture` | none | no result or failure |
| `not-bound.settlementPreview` | NOT_BOUND | `settlementPreview` considers `settle_capture` | none | no result or failure |

Every row is checked by `packages/protocol-adapter/test/sdk0-mock-scenarios.test.ts` and rendered by `apps/web/test/contract-fixture-library.test.tsx`. Receipt-shaped cases also enter the actual receipt explorer's classification/explanation. The full fixture catalogue still traverses that path; this subset replaces no coverage. A traced `STALE_RESPONSE` stays catalogue class `STALE`, but the actual journey disposition is `UNKNOWN` and the next write is fenced. A rejection stays rejected and fences too; no failed outcome receives a success receipt.

## Seed determinism

Seeds must be unsigned 32-bit integers, including boundary values 0 and 4294967295. Unsupported case IDs and invalid seeds fail closed. There is no implicit seed.

The seed is formatted as eight hexadecimal digits in synthetic event, inventory, trade, ticket, order, terms, request, and correlation labels. For seed 7, the event is `show-mock-00000007`. With the same seed, create's inventory matches prepare's inventory, and prepare's trade/terms match accept's body. Receipt sequence positions are fixed at 1, 2, 3. These references are app-local synthetic labels, never a new public identifier format or a claim of ownership.

The existing synthetic `SHOW_POLICY` values are copied unchanged: primary price 100000, resale cap 150000, primary fee 500 bps, resale fee 300 bps, organizer 200 bps, resale allowed, and `FULL_CHAIN_UNWIND_FIXTURE`. Prepare amount remains the existing literal 100000; reservation seconds remains the existing literal 900. No prices, shares, financial entries, expiry policy, rights, or settlement results are calculated. These values establish no product policy. Seed variation changes labels only, not those values, catalogue identity, class, or projection.

Every call returns fresh nested objects. Tests cover repeated/interleaved calls, fresh module imports, boundary seeds, serialization, and caller mutation isolation. Neither clocks, randomness, storage, global counters, nor environment configuration influence output. Import and construction use no HTTP/gate call, fetch, socket, process launcher, retry, redirect, or stub fallback. A throwing global network spy and an explicit import/source boundary test guard this offline seam.

## Reused coverage and acceptance evidence

The adapter fixture-library suite retains all assertions and actual adapter/journey invocations, including malformed/foreign receipt rejection, not-bound transport refusal, tuple drift, and forbidden-computation checks. Both fixture-library suites share observation construction; the web suite retains registry coverage, all catalogue rows, malformed status/actor/session checks, and independent expected class/confirmed values. The SDK-pin suite still verifies the original vendored bytes and provenance.

Verification ran from the repository root. Except for the initial host install, npm commands use the exact prefix `npm exec --yes --package=node@22.23.3 --` to match CI's Node 22 major without adding a repository dependency. Long output is redirected to the named `/tmp` logs while the foreground tool session remains tracked; no job is detached.

| Actual command | Result |
| --- | --- |
| `npm ci` | PASS on host Node 20.19.2; repeated below on Node 22. Full install audit reported 5 existing development-tree vulnerabilities (2 moderate, 1 high, 2 critical); no dependency change made. |
| `npm exec --yes --package=node@22 -- node --version` | PASS: `v22.23.3`; subsequent commands pin that exact temporary version. |
| `npm exec --yes --package=node@22.23.3 -- npm ci` | PASS: clean install, lockfile unchanged. Same full-tree audit advisories. |
| `npm exec --yes --package=node@22.23.3 -- npm run test -w @kix/protocol-adapter -- test/sdk0-mock-scenarios.test.ts test/contract-fixture-library.test.ts test/sdk-pin.test.ts` | Initial run: 31 passed / 1 failed because the new negative guard assertion used an unrecognized flag. Corrected to the existing guarded `protocolTruth` flag; 32 passed, then 33 passed after adding documentation coverage (11 kit + 9 catalogue + 13 SDK pin). |
| `npm exec --yes --package=node@22.23.3 -- npm run test -w @kix/web -- test/contract-fixture-library.test.tsx` | PASS: initially 4 tests; final expanded suite 5 tests, preserving the original full-catalogue path and adding synthetic kit candidates separately. |
| `npm exec --yes --package=node@22.23.3 -- npm run typecheck` | Initial run caught a widened `receipt.action: string`; added `satisfies MockReceipt`. Subsequent complete adapter + web runs PASS. |
| `npm exec --yes --package=node@22.23.3 -- npm run build` | PASS. Vite emitted its existing large-chunk warning; independent bundle limits pass below. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22.23.3 -- npm test` | First run: adapter 1317 passed / 23 skipped; web 744 passed / 7 timed out, with 7 worker RPC timeouts. The affected unrelated web tests each reported a roughly 206-second stall. No test, timeout, or configuration was changed. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22.23.3 -- npm test > /tmp/kixc-sdk0-npm-test.log 2>&1` | PASS on unchanged rerun: adapter 1317 passed / 23 live-gate tests skipped; web 751 passed. The previous stall did not reproduce. |
| `npm exec --yes --package=node@22.23.3 -- npm run lint` | PASS, zero lint warnings. |
| `KIX_REQUIRE_GATE=0 npm exec --yes --package=node@22.23.3 -- npm run coverage:check > /tmp/kixc-sdk0-coverage.log 2>&1` | PASS, all existing floors. Adapter lines/statements 91.20%, branches 84.55%, functions 97.44%; web lines/statements 83.81%, branches 84.66%, functions 60.56%. All stub tests pass again; 23 live-gate tests remain skipped. |
| `npm exec --yes --package=node@22.23.3 -- npm run deps:check` | PASS: 4 package manifests, 589 lockfile entries. |
| `npm exec --yes --package=node@22.23.3 -- npm run cycle-check` | PASS: no circular imports in adapter, web, or e2e. |
| `npm exec --yes --package=node@22.23.3 -- npm run audit:warn` | PASS: production-only audit found 0 vulnerabilities. |
| `npm exec --yes --package=node@22.23.3 -- npm run budget` | PASS: initial JS gzip 289741 bytes, CSS gzip 4758 bytes, total gzip 623021 bytes; all chunk and growth limits pass. |
| `npm exec --yes --package=node@22.23.3 -- npm run typecheck:e2e` | PASS. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_E2E_RECORD_OUT=/tmp/kixc-sdk0-browser-e2e-record.json npm exec --yes --package=node@22.23.3 -- npm run test:e2e > /tmp/kixc-sdk0-e2e.log 2>&1` | PASS: 14 files, 51 tests. Record: Chrome 155.0.8059.84, loopback stub, zero app network calls, zero non-loopback requests, zero non-GET requests; HTTP-mode, production, payment, and release claims false. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kixc-sdk0-a11y-record.json npm exec --yes --package=node@22.23.3 -- npm run test:a11y > /tmp/kixc-sdk0-a11y.log 2>&1` | First run: 228 passed / 2 timed out (marketing narrow, help desktop), then incomplete observation matrix. Marketing's 226612 ms timeout coincided with a 226-second tool-session pause. No assertions, timeouts, or configuration changed; the full suite is rerun separately. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_A11Y_RECORD_OUT=/tmp/kixc-sdk0-a11y-rerun-record.json npm exec --yes --package=node@22.23.3 -- npm run test:a11y > /tmp/kixc-sdk0-a11y-rerun.log 2>&1` | PASS on unchanged rerun: 10 files, all 230 tests, including 74 axe scans and the complete keyboard/structure/reflow/alternate-state matrix. This remains an automated observation, not user acceptance. |
| `KIX_E2E_CHROME=/usr/bin/google-chrome KIX_E2E_NO_SANDBOX=1 KIX_BUDGET_RECORD_OUT=/tmp/kixc-sdk0-bundle-budget-record.json npm exec --yes --package=node@22.23.3 -- npm run test:budget > /tmp/kixc-sdk0-browser-budget.log 2>&1` | PASS: 3 files, 9 tests, including runtime split, chunk-load failures, keyboard recovery, and bounded long-list rendering. |

Browser checks exercise existing screens; this node changes no product UI or route, so journey/a11y/evidence matrices remain unchanged.

Final protected-file comparison uses `git diff --exit-code -- packages/protocol-adapter/src/commerce-bindings.ts packages/protocol-adapter/src/openapi-contract-pin.ts packages/protocol-adapter/src/integration-gate-pin.ts packages/protocol-adapter/src/sdk-pin.ts packages/protocol-adapter/vendor .github/workflows/ci.yml .aiops docs/aiops package.json package-lock.json`. It passes with no differences. The working file and source-HEAD blob for `commerce-bindings.ts` both hash to `47ab5e10cbf5f8f10bed718b4dd5190fe5dfe76f`. `git diff --check` passes.

Changed files: `packages/protocol-adapter/src/sdk0-mock-scenarios.ts`, `packages/protocol-adapter/test/sdk0-mock-scenarios.test.ts`, `packages/protocol-adapter/test/contract-fixture-library.test.ts`, `apps/web/test/contract-fixture-library.test.tsx`, this bind document, and `README.md`.

## UNDETERMINED and not verified

Session retention remains **UNDETERMINED — 담당 사용자/법무**. Existing sessionStorage behavior is unchanged; no TTL is defined. The kit uses no storage.

The default adapter stays stub. Real gate/producer/provider integration, hardware, real payment, KYC, credit disbursement, bank rails, live marketplace, venue scanning, public deployment, production runtime, semantic conformance, N/N-1 qualification, user acceptance, and release are not verified or authorized by this work. Production and protocol-truth flags remain false. Live-gate suites skipped with `KIX_REQUIRE_GATE=0` are skipped, never passed. No protocol repository was changed, and no Git/GitHub mutation or ASTRA comment/marker was performed.

## Plan deviations

The final read-only design plan is followed. The observation helper is named `fixtureObservationFor` (also proposed in its earlier interface sketch), alongside `scenarioObservation`; three locked not-bound examples are included. There are no production UI changes, so browser state/keyboard evidence is reused through the existing browser suites. The host default is Node 20.19.2; after an initial install, verification uses a temporary npm-exec Node 22.23.3 matching CI's major version, without changing dependencies or the lockfile.
