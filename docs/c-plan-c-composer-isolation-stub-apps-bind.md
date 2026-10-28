# Composer evidence isolation (stub)

## Scope and ruling

This node hardens app-internal ownership in `BookingJourney`, `GiftTransfer`,
`OrganizerConsole`, and `ConsentBind`. Public interfaces, command schemas, body
fields, guards, receipt predicates, ordering, and error classification remain as
published. No pins, bindings, dependencies, CI, or bundle limits change.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

Related records:
[journey](wave-6a-journey-adapter-apps-bind.md),
[journey receipt tests](wave-6a-journey-test-apps-bind.md),
[gift](gift-surface-apps-bind.md),
[organizer](organizer-admin-console-apps-bind.md),
[consent](m05-consent-bind-apps-bind.md),
[composer conformance](c-plan-d-invoker-loopback-conformance-stub-apps-bind.md),
[loopback replay](c-plan-c-loopback-replay-conformance-stub-apps-bind.md).

## Ownership boundaries

- Synchronous construction, schema validation, and `structuredClone` capture the
  private command body before dispatch. The invoker receives a separate body copy;
  its envelope and nested mutations cannot change receipt matching or halt evidence.
- Operation ID and actor are captured primitives. Gift captures the original donor
  before awaiting the offer. Consent authorization matches the expected version
  from the captured body rather than rereading caller input.
- After envelope validation, the receipt is cloned for the readers and separately
  for the returned outcome. Both copies are prepared before success is remembered.
  A post-dispatch cloning failure produces `UNKNOWN` / `INVALID_RECEIPT` and fences
  all later writes. No success state is committed in that path.
- Halt storage owns a copied identity and body. UNKNOWN/REJECTED outcomes,
  `state().halted`, and `FENCED.blockedBy.identity` have separate bodies, with trace
  fields preserved. Changing a snapshot cannot clear a halt or affect another instance.
- Every state snapshot has a fresh `notComposed` array and fresh explanation entries.
  Organizer also retains its existing copied `sent` array.

## Preserved bodies and receipt links

| Composer | Approved composition and retained evidence |
| --- | --- |
| Booking | `create_event → prepare_trade → accept_trade`; original inventory IDs and price feed prepare, original buyer, trade ID and terms hash feed accept. |
| Gift | `offer_gift → accept_gift` or `cancel_gift`; original gift ID, ticket, recipient, donor and terms hash remain linked to the offer. |
| Organizer | Six existing independently requested lifecycle/invitation commands; invitation deduplication uses the original inventory ID. Optional-field omission is unchanged. |
| Consent | `set_consent → authorize_marketing`; original allowed flag and expected version are used. Further consent updates remain permitted under the existing guards. |

Domain remains `kix:fixture:lifecycle:0.3`. The existing HTTP transport remains
`POST /x-kix-contract-only/local-call`, loopback `http://127.0.0.1` only. Each step
sends once. No dependent command follows UNKNOWN, REJECTED or NOT_SENT; no retry,
fallback, replacement operation ID, redirect following or Idempotency-Key is added.
`capture` and `settle_capture` remain unsent, and booking stops at `accept_trade`.
`commit_trade`, `open_admission` and `admit` stay uncomposed by booking. `placeHold`
stays not-bound with `consideredAction: reserve_listing` in the byte-identical
locked bindings file.

## Acceptance matrix

All new tests use manually released promises with no sleeps or real network calls.
Expected envelopes are copied before any mutation and fixture receipts are built
from those originals.

| Acceptance | Evidence in `packages/protocol-adapter/test/composer-isolation.test.ts` |
| --- | --- |
| Caller and invoker cannot alter command evidence | All four composers mutate caller fields, nested policy/seats and received envelopes synchronously and while pending; original receipts still succeed and in-flight calls send nothing. |
| Receipt ownership is separate | All four compare outcome/result object references, mutate the invoker-owned receipt then the returned receipt, and verify successful subsequent commands. Booking separately verifies prepare/accept links; gift separately verifies recipient/ticket and terms links. |
| Gift preserves donor | Deferred offer with changed caller donor followed by cancellation uses the original donor. A separate transfer verifies acceptance uses the original recipient. |
| Consent preserves expected version | Original-version authorization succeeds after input and invoker mutation; a receipt matching only the changed caller version becomes UNKNOWN. |
| Organizer preserves invitation inventory | Mutated input/dispatch cannot change the already-sent fence for the original inventory; a distinct inventory remains eligible. |
| Halt evidence and fences are detached | Each composer exercises UNKNOWN, REJECTED, invoker NOT_SENT, invalid result, uncloneable result, and pre-dispatch validation failure. Mutated outcome, trace, nested state body, halt fields and fenced identities cannot change later snapshots or allow another send. |
| Instances and explanations are independent | Mutated explanation entries, array removal, and organizer sent-array mutation affect neither a later snapshot nor another instance. |
| Receipt equality predicates remain authoritative | Each composer refuses a receipt matching only an invoker-mutated body, retains the original identity and performs zero dependent sends. |
| Existing compositions remain valid | Focused suites include all four composers, booking parity, composer loopback and replay conformance. |

## Verification results

Verification uses Node 22.23.4, installed outside the repository at
`/tmp/kixc-composer-node22` (`npm install --prefix /tmp/kixc-composer-node22
--no-package-lock --no-save node@22`, exit 0). The host default was Node 20.19.2.
All commands below use `PATH=/tmp/kixc-composer-node22/node_modules/.bin:$PATH`.
Local logs are `/tmp/kixc-composer-*.log`; results below are the durable record.

All commands ran from the repository root with the Node 22 path above and
exited 0 unless noted:

| Command | Result |
| --- | --- |
| `npm ci` | Clean install completed (esbuild install-script warning only). |
| `KIX_REQUIRE_GATE=0 npm test -w @kix/protocol-adapter -- test/composer-isolation.test.ts test/booking-journey.test.ts test/gift-transfer.test.ts test/organizer-console.test.ts test/consent-bind.test.ts test/booking-journey-parity.test.ts test/composer-loopback-conformance.test.ts test/loopback-replay-conformance.test.ts` | 8 files, 192 tests passed. |
| `npm run typecheck` | `@kix/protocol-adapter` and `@kix/web` `tsc --noEmit` clean. |
| `npm run build` | Adapter typecheck clean; web `vite build` completed. |
| `KIX_REQUIRE_GATE=0 npm test` | Adapter: 70 files, 1659 tests passed, 5 files / 23 tests skipped (live-gate only; skipped is not passed). Web: 90 files, 1269 tests passed. Cold pins: 6 tests passed. |
| `npm run budget` | `initialJsGzip=161461`, every route and total growth within limits. |
| `npm run lint` | ESLint completed with no findings. |
| `KIX_REQUIRE_GATE=0 npm run coverage:check` | All coverage floors met. |
| `npm run deps:check` | Production dependency gate passed. |
| `npm run cycle-check` | No circular imports in any workspace. |
| `npm run typecheck:e2e` | `@kix/e2e` `tsc --noEmit` clean. |
| `npm run test:e2e` | 47 files, 195 tests passed (headless Chrome, stub). |
| `npm run test:a11y` | 17 files, 363 tests passed on re-run; the first run hit one environmental 120 s timeout on `a11y.kbd.outcome.marketing-m03.SUCCESS`, which then passed in 2.1 s isolated and in the full re-run. |
| `npm run test:budget` | 3 files, 9 tests passed. |
| `npm run test:visual` | 3 files, 109 tests passed. |
| `npm run audit:warn` | `npm audit --omit=dev`: 0 vulnerabilities. |
| `git diff --check` | No whitespace errors. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249` (locked value, unchanged). |

## Limitations / STOP conditions

This is in-memory app evidence isolation, not persistent recovery, authoritative
UNKNOWN resolution, production qualification or an exactly-once guarantee. Product
policy defaults and retention remain UNDETERMINED. Stub success is not real payment,
KYC, credit disbursement, venue admission, a bank rail or a live marketplace. No
production or truth flag is promoted, and no SLO or protocol math is introduced.

No external contract or owner decision was needed. New contracts, commands, public
schemas, policy values, unmerged dependencies, secrets, money, paid services,
hardware or production runtime require a root `DECISION_REQUIRED.md` and owner
decision. Locked-binding edits or any retry/fallback/gate proxy/UI fetch would also
cross the node boundary. No kix-protocol catalogue/gate change is consumed here.
