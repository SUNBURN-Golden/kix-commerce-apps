# Local evidence matrix (stub) apps bind

This bind records one evidence matrix over every local, stub-scope surface and journey, and one final denominator table. It is the stub-scoped reduction of pending node `commerce-integration-closeout`, which stays in `docs/aiops/PENDING_NODES.json`. A real connection waits on its producer prerequisites and becomes a separate follow-up node. The matrix is a document plus a test. There is no new screen, because a screen would invite a reading that the surface is integrated.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request, and maps no desk method onto a different body.

## What did not change

- Base main is `f570c84c6a969bb88642eecf534e68c60ffee853`. This document is a snapshot at that base. Node merge status was typed from `git log --first-parent --merges` there, and the test reads repo files, not git history. A node merged later shows `NOT_STARTED` until the table is regenerated at a newer base. `audit-5-fix` is not a program node and has no row. The exact PR head is stated in the PR body.
- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and a test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` do not move. `packages/protocol-adapter/src`, `apps/web/src`, `apps/e2e`, `.github/`, `.aiops/`, and `docs/aiops/` are untouched. The base refresh edits only the README, this document, and the two evidence-matrix test files. Nothing changes in kix-protocol.
- `contract_change=NO`. The row ids, the facet words, and the record format here are app-internal. They are not a public schema, operation, capability, or identifier.

Count note: the node brief says the program file has 18 nodes. At this base `.aiops/program.json` holds 51 program nodes and `docs/aiops/PENDING_NODES.json` holds 42. The tests count from the files and never hardcode a number.

## Facets

Four facets stay in four columns. None folds into another, and there is no aggregate status.

| Facet | Words this matrix writes | Words it never writes |
| --- | --- | --- |
| `node_state` | `MERGED_RECORDED(PR #N)`, `WAITING`, `NOT_STARTED` for nodes; `REPO_PRESENT` for surfaces and journeys | a completion word |
| `qualification_state` | `UNQUALIFIED` | a qualified word |
| `acceptance_state` | `PENDING`; `NOT_REQUIRED` for a row with no page | an accepted or a refused word |
| `release_state` | `NOT_AUTHORIZED` | a released word, or a not-released word that reads like a decision |

`MERGED_RECORDED(PR #N)` is a fact read from the merge history of this repo. It is not an approval. The central completion test needs protected receipts and a runtime attestation that this repo does not hold, so every node row states `NOT_EVALUATED` for it and no node is counted as done here. The accessibility target standard, the acceptance decider, and the release criteria are UNDETERMINED and are not decided here.

Coverage cells (Success, Reject, UNKNOWN) use `RECORDED` (a fixture or a table row of that class exists and is cited), `NOT_REACHABLE`, `NOT_APPLICABLE` (no published command to send), or `UNVERIFIED`. `RECORDED` is a pointer to synthetic stub material. It is not a pass, and a stub-only surface is never qualified, accepted, or released by it.

## Shared contract tuple

Every row points at this one block. A test checks it against the live pins, the handoff packet, and the CI gate sha.

| Field | Value |
| --- | --- |
| contractOpenApiSha256 | fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e |
| gateOpenApiSha256 | 2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f |
| protocolMergeSha | 52a9b5cbf7777df55d2d2062cb8d99d862b423bb |
| ciGateSha | 52a9b5cbf7777df55d2d2062cb8d99d862b423bb |
| sdkDigest | null |
| manifestDigest | null |
| vectorDigest | null |
| consumedProducerChange | false |

The SDK, manifest, and vector digests stay null. No producer change is consumed.

## Surface matrix

One row per workspace surface. Mode is `stub (default)` plus the outcome in `integration-http`. A surface whose binding is not `published-bound` is NOT_BOUND in HTTP mode. A published-bound surface sends only its published bodies through the local-call path, on Node loopback only. No browser runs HTTP mode. Rows that share a route (`/`, `/booking/:eventId`, `/discovery`) share that route's browser evidence.

### Coverage

| Row | Route | Binding | Mode | Success | Reject | UNKNOWN | NOT_BOUND fixtures |
| --- | --- | --- | --- | --- | --- | --- | --- |
| box-office-catalog | / | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 1 |
| box-office-journey-view | / | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | RECORDED (1 fixture, first box-office-journey-view.unknown) | 0 |
| box-office-settlement | / | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 8 |
| booking-journey | /booking/:eventId | published-bound | stub (default); integration-http: local-command, Node loopback only | RECORDED (3 fixtures, first booking-journey.create_event.success) | RECORDED (1 fixture, first booking-journey.create_event.reject) | RECORDED (1 fixture, first booking-journey.create_event.unknown) | 3 |
| reservation-case | /booking/:eventId | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 14 |
| admission-credential | /admission | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 6 |
| resale-desk | /resale | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 17 |
| gift-transfer | /gift | published-bound | stub (default); integration-http: local-command, Node loopback only | RECORDED (1 fixture, first gift-transfer.offer_gift.success) | RECORDED (1 fixture, first gift-transfer.offer_gift.reject) | RECORDED (1 fixture, first gift-transfer.offer_gift.unknown) | 0 |
| credit-desk | /credit | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 12 |
| organizer-console | /organizer | published-bound | stub (default); integration-http: local-command, Node loopback only | RECORDED (1 fixture, first organizer-console.create_event.success) | RECORDED (1 fixture, first organizer-console.create_event.reject) | UNVERIFIED (no fixture of this class) | 0 |
| operator-transport | / | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | RECORDED (1 fixture, first operator-transport.unavailable) | 0 |
| operator-unshown-desk | / | not-bound | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 7 |
| marketing-hub | /marketing | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |
| marketing-m01 | /marketing/m01 | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |
| marketing-m02 | /marketing/m02 | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |
| marketing-m03 | /marketing/m03 | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |
| marketing-m04 | /marketing/m04 | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |
| marketing-m05 | /marketing/m05 | published-bound | stub (default); integration-http: local-command, Node loopback only | RECORDED (1 fixture, first marketing-m05.set_consent.success) | RECORDED (1 fixture, first marketing-m05.authorize_marketing.reject) | RECORDED (1 fixture, first marketing-m05.set_consent.unknown) | 0 |
| marketing-journey | /marketing/journey | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (7 fixtures, first marketing-journey.consent-withdrawn) | RECORDED (3 fixtures, first marketing-journey.apply-lost) | 0 |
| discovery-prototype | /discovery | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 0 |
| discovery-live-read | /discovery | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (3 fixtures, first discovery-live-read.stream-gap) | UNVERIFIED (no fixture of this class) | 0 |
| inventory-venue-select | /inventory | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (4 fixtures, first inventory-venue-select.generation-changed) | UNVERIFIED (no fixture of this class) | 0 |
| platform-journey-trade | /platform | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (4 fixtures, first platform-journey-trade.version-stale) | RECORDED (2 fixtures, first platform-journey-trade.response-lost) | 0 |
| merchant-operations | /merchant | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (5 fixtures, first merchant-operations.cut-mismatch) | RECORDED (1 fixture, first merchant-operations.read-lost) | 0 |
| credit-origination | /credit/origination | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (5 fixtures, first credit-origination.consent-withdrawn) | RECORDED (2 fixtures, first credit-origination.write-lost) | 0 |
| credit-servicing | /credit/servicing | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (2 fixtures, first credit-servicing.scope-denied) | RECORDED (4 fixtures, first credit-servicing.partial-repayment) | 0 |
| finance-operations | /finance | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (5 fixtures, first finance-operations.scope-denied) | RECORDED (4 fixtures, first finance-operations.balance-mismatch) | 0 |
| delegated-assistant | /assistant | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (8 fixtures, first delegated-assistant.grant-revoked) | RECORDED (3 fixtures, first delegated-assistant.draft-lost) | 0 |
| provider-connected-journey | /provider | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (6 fixtures, first provider-connected-journey.provider-error) | RECORDED (2 fixtures, first provider-connected-journey.write-lost) | 0 |
| tenant-permissions | /permissions | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (6 fixtures, first tenant-permissions.tenant-mix) | RECORDED (2 fixtures, first tenant-permissions.write-lost) | 0 |
| notification-inbox | /notifications | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (7 fixtures, first notification-inbox.tenant-mix) | RECORDED (2 fixtures, first notification-inbox.write-lost) | 0 |
| marketplace-performance-bench | /marketplace-performance | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (7 fixtures, first marketplace-performance-bench.queue-blocked) | RECORDED (1 fixture, first marketplace-performance-bench.read-lost) | 0 |
| installable-mobile-shell | /mobile | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (7 fixtures, first installable-mobile-shell.offline-presentation) | RECORDED (5 fixtures, first installable-mobile-shell.offline-write-unknown) | 0 |
| platform-operational-qualification | /qualification | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (3 fixtures, first platform-operational-qualification.per-call-not-e2e) | RECORDED (3 fixtures, first platform-operational-qualification.run-lost) | 0 |
| platform-release | /release | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (2 fixtures, first platform-release.untrusted-packet) | RECORDED (3 fixtures, first platform-release.decision-pending) | 0 |
| refund-return-desk | /booking/:eventId | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (4 fixtures, first refund-return-desk.cancel-after-payment) | RECORDED (1 fixture, first refund-return-desk.write-lost) | 0 |
| journey-identity | /identity | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (3 fixtures, first journey-identity.foreign-context) | RECORDED (1 fixture, first journey-identity.attach-lost) | 0 |
| session-recovery | /session | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (2 fixtures, first session-recovery.journal-full) | RECORDED (3 fixtures, first session-recovery.recovered-unknown) | 0 |
| cross-surface-journeys | /journeys | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | RECORDED (2 fixtures, first cross-surface-journeys.explicit-reject) | RECORDED (3 fixtures, first cross-surface-journeys.response-lost) | 0 |
| buyer-workspace | /buyer | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | RECORDED (1 fixture, first buyer-workspace.unknown) | 0 |
| organizer-workspace | /organizer/workspace | published-bound | stub (default); integration-http: local-command, Node loopback only | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | 0 |
| receipt-explorer | /receipts | stub-only | stub (default); integration-http: NOT_BOUND | UNVERIFIED (no fixture of this class) | UNVERIFIED (no fixture of this class) | RECORDED (1 fixture, first receipt-explorer.unknown) | 0 |
| accessibility-baseline | (none) | no-published-command | stub (default); integration-http: NOT_BOUND | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | NOT_APPLICABLE (no published command to send) | 0 |

### Evidence and facets

| Row | Node evidence | Browser evidence | Skipped / unbound reason | node_state | qualification_state | acceptance_state | release_state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| box-office-catalog | web workspace-registry.test.ts; adapter stub-edge-cases.test.ts | a11y box-office; e2e box-office | binding stub-only; waits on bind-list-read; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| box-office-journey-view | web journey-panel.test.tsx; adapter booking-journey.test.ts | a11y box-office; e2e box-office | binding stub-only; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| box-office-settlement | web settlement-panel.test.tsx; adapter settlement-fsm.test.ts | a11y box-office; e2e box-office | binding stub-only; waits on bind-settlement-fsm; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| booking-journey | web journey-panel.test.tsx; adapter booking-journey.test.ts | a11y booking; e2e booking | waits on bind-wave4-pointers, primary-price-fee-ui; status local-command | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| reservation-case | web reservation-panel.test.tsx; adapter reservation-fsm.test.ts | a11y booking; e2e booking | binding stub-only; waits on bind-reservation-fsm; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| admission-credential | web admission-panel.test.tsx; adapter admission-fsm.test.ts | a11y admission; e2e admission | binding stub-only; waits on bind-admission-fsm; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| resale-desk | web resale-panel.test.tsx; adapter resale-fsm.test.ts | a11y resale; e2e resale | binding stub-only; waits on bind-resale-fsm; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| gift-transfer | web gift-panel.test.tsx; adapter gift-transfer.test.ts | a11y gift; e2e gift | status local-command | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| credit-desk | web credit-panel.test.tsx; adapter credit-fsm.test.ts | a11y credit; e2e credit | binding stub-only; waits on bind-credit-fsm; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| organizer-console | web organizer-panel.test.tsx; adapter organizer-console.test.ts | a11y organizer; e2e organizer | status local-command | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| operator-transport | web transport-status.test.tsx; adapter http-transport-hardening.test.ts | a11y box-office; e2e box-office | binding stub-only; waits on browser-gate-path; status unsupported | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| operator-unshown-desk | web workspace-registry.test.ts; adapter no-bypass.test.ts | none (no page) | binding not-bound; no page; status unsupported | REPO_PRESENT | UNQUALIFIED | NOT_REQUIRED | NOT_AUTHORIZED |
| marketing-hub | web marketing-routes.test.tsx; adapter none | a11y marketing; e2e none | binding no-published-command; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-m01 | web marketing-contracts.test.ts; adapter none | a11y marketing-m01; e2e none | binding no-published-command; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-m02 | web marketing-contracts.test.ts; adapter none | a11y marketing-m02; e2e none | binding no-published-command; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-m03 | web marketing-contracts.test.ts; adapter none | a11y marketing-m03; e2e none | binding no-published-command; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-m04 | web marketing-contracts.test.ts; adapter none | a11y marketing-m04; e2e none | binding no-published-command; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-m05 | web consent-desk.test.ts; adapter consent-bind.test.ts | a11y marketing-m05; e2e none | status local-command | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-journey | web marketing-journey.test.tsx; adapter marketing-journey.test.ts | a11y marketing-journey; e2e none | binding stub-only; waits on c-marketing-journey; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| discovery-prototype | web discovery-page.test.tsx; adapter discovery-read.test.ts | a11y discovery; e2e none | binding stub-only; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| discovery-live-read | web discovery-live.test.tsx; adapter discovery-read.test.ts | a11y discovery; e2e none | binding stub-only; waits on c-discovery-live; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| inventory-venue-select | web inventory-venue.test.tsx; adapter inventory-read.test.ts | a11y inventory; e2e none | binding stub-only; waits on c-inventory-venue; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| platform-journey-trade | web platform-journey.test.tsx; adapter platform-journey.test.ts | a11y platform; e2e none | binding stub-only; waits on c-platform-journey, c-async-session-fence; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| merchant-operations | web merchant-operations.test.tsx; adapter merchant-operations.test.ts | a11y merchant; e2e none | binding stub-only; waits on c-merchant-operations; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| credit-origination | web credit-origination.test.tsx; adapter credit-origination.test.ts | a11y credit-origination; e2e none | binding stub-only; waits on c-credit-origination; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| credit-servicing | web credit-servicing.test.tsx; adapter credit-servicing.test.ts | a11y credit-servicing; e2e none | binding stub-only; waits on c-credit-servicing-journey; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| finance-operations | web finance-operations.test.tsx; adapter finance-operations.test.ts | a11y finance; e2e none | binding stub-only; waits on c-finance-operations; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| delegated-assistant | web delegated-assistant.test.tsx; adapter delegated-assistant.test.ts | a11y assistant; e2e none | binding stub-only; waits on c-delegated-assistant, delegation-surface; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| provider-connected-journey | web provider-journey.test.tsx; adapter provider-journey.test.ts | a11y provider; e2e none | binding stub-only; waits on c-provider-connected-journey; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| tenant-permissions | web tenant-permissions.test.tsx; adapter tenant-permissions.test.ts | a11y permissions; e2e none | binding stub-only; waits on c-tenant-permissions; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| notification-inbox | web notification-inbox.test.tsx; adapter notification-inbox.test.ts | a11y notifications; e2e none | binding stub-only; waits on c-notification-inbox; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketplace-performance-bench | web marketplace-performance.test.tsx; adapter marketplace-performance.test.ts | a11y marketplace-performance; e2e none | binding stub-only; waits on c-marketplace-performance; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| installable-mobile-shell | web installable-mobile.test.tsx; adapter installable-mobile.test.ts | a11y mobile; e2e none | binding stub-only; waits on c-installable-mobile; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| platform-operational-qualification | web operational-qualification.test.tsx; adapter operational-qualification.test.ts | a11y qualification; e2e none | binding stub-only; waits on c-platform-operational-qualification; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| platform-release | web platform-release.test.tsx; adapter platform-release.test.ts | a11y release; e2e none | binding stub-only; waits on c-platform-release; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| refund-return-desk | web refund-return.test.tsx; adapter refund-return.test.ts | a11y booking; e2e booking | binding stub-only; waits on api-state-distinction, refund-surface; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| journey-identity | web journey-identity.test.tsx; adapter journey-identity.test.ts | a11y identity; e2e none | binding stub-only; waits on c-journey-identity; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| session-recovery | web session-recovery.test.tsx; adapter session-journal.test.ts | a11y session; e2e none | binding stub-only; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| cross-surface-journeys | web cross-surface-journeys.test.tsx; adapter cross-surface-journeys.test.ts | a11y journeys; e2e none | binding stub-only; waits on c-cross-surface-journeys; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| buyer-workspace | web buyer-workspace.test.tsx; adapter none | a11y buyer; e2e none | binding stub-only; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| organizer-workspace | web organizer-workspace.test.tsx; adapter none | a11y organizer-workspace; e2e none | status local-command | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| receipt-explorer | web receipt-explorer.test.tsx; adapter none | a11y receipts; e2e receipts | binding stub-only; status synthetic | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| accessibility-baseline | web a11y-baseline.test.tsx; adapter none | none (no page) | binding no-published-command; no page; status unsupported | REPO_PRESENT | UNQUALIFIED | NOT_REQUIRED | NOT_AUTHORIZED |

## Journey matrix

One row per cross-surface journey. Success, Reject, and UNKNOWN point at the synthetic Journeys table row for the `normal`, `explicit-reject`, and `response-lost` branches. A `reused` or `no-source-branch` row is stated as such. A table row is a recorded stub row, not a run on a real source.

### Coverage

| Row | Route | Binding | Mode | Success | Reject | UNKNOWN | NOT_BOUND cells |
| --- | --- | --- | --- | --- | --- | --- | --- |
| purchase-booking | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.purchase-booking.normal reused, status reference) | RECORDED (xs.purchase-booking.explicit-reject reused, status reference) | RECORDED (xs.purchase-booking.response-lost reused, status reference) | 1 |
| purchase-provider | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.purchase-provider.normal reused, status closed) | RECORDED (xs.purchase-provider.explicit-reject reused, status partial) | RECORDED (xs.purchase-provider.response-lost executed, status partial) | 0 |
| resale-platform | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.resale-platform.normal reused, status closed) | RECORDED (xs.resale-platform.explicit-reject reused, status partial) | RECORDED (xs.resale-platform.response-lost reused, status partial) | 1 |
| gift | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.gift.normal reused, status reference) | NOT_REACHABLE (xs.gift.explicit-reject no-source-branch, status reference) | RECORDED (xs.gift.response-lost reused, status reference) | 1 |
| refund | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.refund.normal executed, status closed) | RECORDED (xs.refund.explicit-reject executed, status rejected) | RECORDED (xs.refund.response-lost executed, status unknown) | 0 |
| marketing-benefit | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.marketing-benefit.normal executed, status closed) | RECORDED (xs.marketing-benefit.explicit-reject executed, status rejected) | RECORDED (xs.marketing-benefit.response-lost executed, status unknown) | 0 |
| delegation | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.delegation.normal executed, status closed) | RECORDED (xs.delegation.explicit-reject executed, status rejected) | RECORDED (xs.delegation.response-lost executed, status unknown) | 0 |
| credit-servicing | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.credit-servicing.normal executed, status closed) | RECORDED (xs.credit-servicing.explicit-reject executed, status rejected) | RECORDED (xs.credit-servicing.response-lost executed, status unknown) | 1 |
| organizer | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.organizer.normal reused, status reference) | RECORDED (xs.organizer.explicit-reject reused, status reference) | RECORDED (xs.organizer.response-lost reused, status reference) | 1 |
| session-recovery | /journeys | stub-only | stub (default); integration-http: NOT_BOUND for the table | RECORDED (xs.session-recovery.normal reused, status reference) | RECORDED (xs.session-recovery.explicit-reject reused, status reference) | RECORDED (xs.session-recovery.response-lost reused, status reference) | 0 |

### Evidence and facets

| Row | Node evidence | Browser evidence | Skipped / unbound reason | node_state | qualification_state | acceptance_state | release_state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| purchase-booking | adapter booking-journey.test.ts; adapter cross-surface-journeys.test.ts | e2e booking: SUCCESS BROWSER, REJECT BROWSER, UNKNOWN REFERENCE, NOT_BOUND BROWSER; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| purchase-provider | adapter provider-journey.test.ts; adapter cross-surface-journeys.test.ts | e2e none; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| resale-platform | adapter platform-journey.test.ts; adapter cross-surface-journeys.test.ts | e2e resale: SUCCESS BROWSER, REJECT BROWSER, UNKNOWN REFERENCE, NOT_BOUND BROWSER; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| gift | adapter gift-transfer.test.ts; adapter cross-surface-journeys.test.ts | e2e gift: SUCCESS BROWSER, REJECT BROWSER, UNKNOWN REFERENCE, NOT_BOUND BROWSER; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| refund | adapter refund-return.test.ts; adapter cross-surface-journeys.test.ts | e2e none; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| marketing-benefit | adapter marketing-journey.test.ts; adapter cross-surface-journeys.test.ts | e2e none; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| delegation | adapter delegated-assistant.test.ts; adapter cross-surface-journeys.test.ts | e2e none; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| credit-servicing | adapter credit-servicing.test.ts; adapter cross-surface-journeys.test.ts | e2e credit: SUCCESS BROWSER, REJECT BROWSER, UNKNOWN NOT_REACHABLE, NOT_BOUND BROWSER; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| organizer | adapter organizer-console.test.ts; adapter cross-surface-journeys.test.ts | e2e organizer: SUCCESS BROWSER, REJECT BROWSER, UNKNOWN REFERENCE, NOT_BOUND BROWSER; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |
| session-recovery | adapter session-recovery-controller.test.ts; adapter cross-surface-journeys.test.ts | e2e none; a11y journeys | synthetic table; capture and settle_capture never composed; placeHold not-bound | REPO_PRESENT | UNQUALIFIED | PENDING | NOT_AUTHORIZED |

## Node matrix

One row per node in `.aiops/program.json` and one per node in `docs/aiops/PENDING_NODES.json`. A pending catalogue node is never implemented from this file and never counted as done. A node that names an external prerequisite is `WAITING`, and the prerequisite's completion is not verified here.

| Node | Catalogue | node_state | Central DONE | qualification_state | acceptance_state | release_state | Waits on (external) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| w6a-journey-map | program | MERGED_RECORDED(PR #23) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w6a-journey-adapter | program | MERGED_RECORDED(PR #27) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w6a-journey-test | program | MERGED_RECORDED(PR #28) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w6a-ui-skeleton | program | MERGED_RECORDED(PR #29) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w6a-evidence | program | MERGED_RECORDED(PR #31) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| organizer-admin-console | program | MERGED_RECORDED(PR #32) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| gift-surface | program | MERGED_RECORDED(PR #30) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| doc-m05-label | program | MERGED_RECORDED(PR #24) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w7-marketing-align | program | MERGED_RECORDED(PR #33) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| w7-m05-consent-bind | program | MERGED_RECORDED(PR #34) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-workspace-design | program | MERGED_RECORDED(PR #35) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-buyer-workspace | program | MERGED_RECORDED(PR #36) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-organizer-workspace | program | MERGED_RECORDED(PR #37) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-receipt-explorer | program | MERGED_RECORDED(PR #42) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-discovery-prototype | program | MERGED_RECORDED(PR #38) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-accessibility-baseline | program | MERGED_RECORDED(PR #43) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-contract-fixture-library | program | MERGED_RECORDED(PR #44) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-local-workspace-closeout | program | MERGED_RECORDED(PR #45) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-discovery-live-stub | program | MERGED_RECORDED(PR #47) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-inventory-venue-stub | program | MERGED_RECORDED(PR #48) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-platform-journey-stub | program | MERGED_RECORDED(PR #49) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-merchant-operations-stub | program | MERGED_RECORDED(PR #50) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-credit-origination-stub | program | MERGED_RECORDED(PR #52) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-credit-servicing-journey-stub | program | MERGED_RECORDED(PR #53) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-finance-operations-stub | program | MERGED_RECORDED(PR #54) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-marketing-journey-stub | program | MERGED_RECORDED(PR #55) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-delegated-assistant-stub | program | MERGED_RECORDED(PR #56) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-tenant-permissions-stub | program | MERGED_RECORDED(PR #57) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-notification-inbox-stub | program | MERGED_RECORDED(PR #58) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-marketplace-performance-stub | program | MERGED_RECORDED(PR #61) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-provider-connected-journey-stub | program | MERGED_RECORDED(PR #59) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-installable-mobile-stub | program | MERGED_RECORDED(PR #63) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-platform-operational-qualification-stub | program | MERGED_RECORDED(PR #64) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-platform-release-stub | program | MERGED_RECORDED(PR #65) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-refund-return-states-stub | program | MERGED_RECORDED(PR #68) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-journey-identity-stub | program | MERGED_RECORDED(PR #69) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-session-recovery-stub | program | MERGED_RECORDED(PR #70) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-cross-surface-journeys-stub | program | MERGED_RECORDED(PR #72) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-browser-e2e-stub | program | MERGED_RECORDED(PR #73) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-a11y-acceptance-stub | program | MERGED_RECORDED(PR #74) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-fault-injection-stub | program | MERGED_RECORDED(PR #75) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-local-evidence-matrix-stub | program | MERGED_RECORDED(PR #76) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-app-shell-resilience-stub | program | MERGED_RECORDED(PR #78) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-route-registry-navigation-stub | program | MERGED_RECORDED(PR #79) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-bundle-performance-budget-stub | program | MERGED_RECORDED(PR #80) | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-locale-ko-en-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-display-preferences-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-untrusted-render-csp-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-quality-gates-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-user-guides-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| consume-p-sdk-0 | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-i18n-coverage-completion-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-async-state-patterns-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-form-validation-ux-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-offline-connectivity-ux-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-sdk0-mock-scenario-kit-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-component-gallery-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-web-coverage-uplift-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-visual-regression-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| c-first-run-onboarding-stub | program | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | none |
| consume-p-sdk-0 | pending | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | promoted to program (plan revision 20261017) |
| bind-settlement-fsm | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:openapi-catalogue-promotion, kix:contract-compatibility-profile |
| bind-reservation-fsm | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:openapi-catalogue-promotion, kix:contract-compatibility-profile |
| bind-admission-fsm | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:openapi-catalogue-promotion, kix:contract-compatibility-profile |
| bind-resale-fsm | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:openapi-catalogue-promotion, kix:contract-compatibility-profile |
| bind-credit-fsm | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:openapi-catalogue-promotion, kix:contract-compatibility-profile |
| bind-wave4-pointers | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| bind-list-read | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:read-model-reference, kix:p-sdk-1, kix:contract-compatibility-profile |
| browser-gate-path | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:gate-browser-access, kix:contract-compatibility-profile |
| primary-price-fee-ui | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:move-primary-price-fee, kix:contract-compatibility-profile |
| api-state-distinction | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| refund-surface | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| delegation-surface | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ai-delegation-contract-mock, kix:contract-compatibility-profile |
| w7-m01-membership | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:wave7-marketing-contracts, kix:contract-compatibility-profile |
| w7-m02-presale | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:wave7-marketing-contracts, kix:contract-compatibility-profile |
| w7-m03-coupon | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:wave7-marketing-contracts, kix:contract-compatibility-profile |
| w7-m04-referral | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:wave7-marketing-contracts, kix:contract-compatibility-profile |
| e2e-browser-journeys | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| consume-p-sdk-1 | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:p-sdk-1, kix:contract-compatibility-profile |
| c-journey-identity | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:protocol-runtime-boundary-register, kix:protocol-canonical-identity-conformance, kix:protocol-read-projection-evidence, kix:contract-compatibility-profile |
| c-async-session-fence | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:protocol-local-recovery-conformance, kix:protocol-read-projection-evidence, kix:contract-compatibility-profile |
| c-cross-surface-journeys | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| c-finance-projection | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:fin-catalogue-read-model, kix:contract-compatibility-profile |
| c-accessibility-acceptance | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| c-integrated-chaos-qualification | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:protocol-local-recovery-conformance, kix:contract-compatibility-profile |
| commerce-integration-closeout | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:contract-compatibility-profile |
| c-discovery-live | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ps-05-query-projections |
| c-inventory-venue | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ps-05-query-projections, kix:ps-06-admission-load |
| c-platform-journey | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ps-03-resale-contract, kix:ps-04-execution-partitions, kix:ps-05-query-projections |
| c-merchant-operations | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:fin-catalogue-read-model, kix:ps-05-query-projections |
| c-credit-origination | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:cr-08-producer-sdk |
| c-credit-servicing-journey | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:cr-08-producer-sdk |
| c-finance-operations | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:fin-catalogue-read-model, kix:cr-08-producer-sdk |
| c-marketing-journey | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:wave7-marketing-contracts |
| c-delegated-assistant | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ai-delegation-execution-decision, kix:k-authority-qualification |
| c-tenant-permissions | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:k-operator-contract |
| c-notification-inbox | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:k-operator-contract |
| c-marketplace-performance | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ps-07-scale-qualification |
| c-provider-connected-journey | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:k-provider-sandbox, kix:k-authority-qualification |
| c-installable-mobile | pending | NOT_STARTED | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | pending nodes only |
| c-platform-operational-qualification | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:ps-07-scale-qualification, kix:cr-10-credit-qualification |
| c-platform-release | pending | WAITING | NOT_EVALUATED | UNQUALIFIED | PENDING | NOT_AUTHORIZED | kix:k-platform-release |

## Final denominator

Each line has its own count. Nothing is summed, nothing is subtracted, and there is no percentage.

- D01 live-gate skipped under KIX_REQUIRE_GATE=0: 8 adapter test files import support/reviewed-gate
- D02 NOT_BOUND desk methods: 68 of 68
- D03 NOT_BOUND surfaces (binding is not published-bound): 38 of 43
- D04 NOT_BOUND fixtures: 68 of 265
- D05 stub-only surfaces: 31 of 43
- D06 no-published-command surfaces: 6
- D07 not-bound surfaces: 1
- D08 published-bound surfaces (local-command, Node loopback only): 5
- D09 user acceptance PENDING surfaces: 41 of 43; ACCEPTED 0
- D10 user acceptance PENDING journeys: 10 of 10; ACCEPTED 0
- D11 user acceptance PENDING a11y screens: 37 of 37; ACCEPTED 0
- D12 release page user acceptance: PENDING_USER_DECISION, 1 packet; realUserAcceptance false
- D13 release decisions: install awaiting-user-decision, publish not-open, operate not-open; taken 0
- D14 release NOT_AUTHORIZED rows: surfaces 43 of 43, journeys 10 of 10, nodes 102 of 102; RELEASED 0
- D15 active program nodes: 60; MERGED_RECORDED 45, NOT_STARTED 15; central DONE not evaluated
- D16 pending catalogue nodes: 42; WAITING 40, NOT_STARTED 2; counted as done 0
- D17 distinct external prerequisites named by pending nodes: 26; completion not verified here; subtracted 0
- D18 release page area denominators: scope 29 of 29, acceptance 3 of 3, environment 3 of 3, operations 4 of 4, gate 3 of 3 (own denominators, not merged)
- D19 pending producers on the handoff packet: 32; connected 0

### Adapter test files behind D01

These files import `support/reviewed-gate`. Under `KIX_REQUIRE_GATE=0` their gate suites are skipped, and the CI `live-gate` job shows as skipped, not passed, when the read token is absent. A skipped suite is not a pass.

- `booking-journey-gate.test.ts`
- `booking-journey-live.test.ts`
- `consent-bind-gate.test.ts`
- `gate-requirement.test.ts`
- `gift-transfer-gate.test.ts`
- `http-integration-gate.test.ts`
- `organizer-console-gate.test.ts`
- `prod-readiness.test.ts`

### External prerequisites behind D17

Named by pending nodes. None is subtracted from the denominator, and none is shown complete.

- `kix:ai-delegation-contract-mock`
- `kix:ai-delegation-execution-decision`
- `kix:contract-compatibility-profile`
- `kix:cr-08-producer-sdk`
- `kix:cr-10-credit-qualification`
- `kix:fin-catalogue-read-model`
- `kix:gate-browser-access`
- `kix:k-authority-qualification`
- `kix:k-operator-contract`
- `kix:k-platform-release`
- `kix:k-provider-sandbox`
- `kix:move-primary-price-fee`
- `kix:openapi-catalogue-promotion`
- `kix:p-sdk-0`
- `kix:p-sdk-1`
- `kix:protocol-canonical-identity-conformance`
- `kix:protocol-local-recovery-conformance`
- `kix:protocol-read-projection-evidence`
- `kix:protocol-runtime-boundary-register`
- `kix:ps-03-resale-contract`
- `kix:ps-04-execution-partitions`
- `kix:ps-05-query-projections`
- `kix:ps-06-admission-load`
- `kix:ps-07-scale-qualification`
- `kix:read-model-reference`
- `kix:wave7-marketing-contracts`

## Existing records this links to

This matrix does not replace the `/handoff` or `/release` records and does not approve what they leave open.

- `/handoff` (`apps/web/src/handoff/packet.ts`) keeps `HANDOFF_NON_CLAIMS` (`releaseState` `NOT_AUTHORIZED`, `qualificationState` `UNQUALIFIED`, every completion claim false) and the `PENDING_PRODUCERS` list. D19 repeats its count.
- `/release` (`packages/protocol-adapter/src/platform-release.ts`) keeps `RELEASE_DECISIONS` (install awaiting the user decision, publish and operate not open) and its five area denominators. D13 and D18 repeat them as they are, on their own denominators.
- The a11y screen list (`apps/e2e/src/a11y-matrix.ts`) and the browser journeys matrix (`apps/e2e/src/journey-matrix.ts`) are read for browser evidence. Their records stay in `docs/c-a11y-acceptance-stub-apps-bind.md` and `docs/c-browser-e2e-stub-apps-bind.md`. The fault results stay in `docs/c-fault-injection-stub-apps-bind.md`.

## Local runs observed

Run on 2026-10-18 at base main `f570c84c6a969bb88642eecf534e68c60ffee853` plus the base refresh, in a local worktree. These are local results, not CI results, and the exact PR head is in the PR body.

| Run | Result |
| --- | --- |
| `npm ci`, `npm run typecheck`, `npm run build` | exit 0 |
| `KIX_REQUIRE_GATE=0 npm test`, adapter | 62 files passed, 5 files skipped (1293 tests passed, 23 skipped) |
| `KIX_REQUIRE_GATE=0 npm test`, web | 54 files passed (695 tests passed), including `local-evidence-matrix.test.ts` |

The pinned-checkout live-gate run and the browser suites (`browser-e2e`, `a11y-observation`, `bundle-budget`) were not re-run locally at this base.

## App-wide connectivity evidence (local stub)

The route/screen and outcome denominators above are unchanged. [c-offline-connectivity-ux-stub](c-offline-connectivity-ux-stub-apps-bind.md) adds app-wide offline/cached-read observations and blocked-write checks on all 37 independent screens plus 404. `apps/web/test/offline-connectivity.test.tsx`, `apps/web/test/connectivity-write-guard.test.ts`, `apps/e2e/tests/offline-connectivity.e2e.test.ts`, and `apps/e2e/tests/a11y/connectivity.a11y.test.ts` keep this separate from protocol integration, qualification, acceptance and release. Reconnect does not replay; service-worker registration attempts remain zero. No existing table cell is promoted by these observations.
