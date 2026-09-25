# kix-commerce-apps

Wave 6 commerce desk for KIX: box office, booking, admission, and resale.
This repository is the BeautifulMind-JT app host JunTae selected for product frontends.
Protocol, Move, and settlement contracts stay in [BeautifulMind-JT/kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol).

The UI is an operator desk over a protocol adapter. The default adapter is an in-memory stub so the desk can run without a chain. An HTTP adapter is included for a later bind to the kix-protocol API. Neither adapter moves funds or disburses credit.

## Non-goals

- Product frontend trees do not belong in `kix-protocol`. This repo does not copy Move, the kernel, or settlement math.
- Wave 7 marketing (M01–M05) is not started. `WAIT_FOR_WAVE6` still applies.
- No real money, no card capture, and no credit disbursement. F04 stays a mock/sim boundary in kix-protocol. This app has no disburse action (`CREDIT_BOUNDARY.action` is `none`).
- No product TPS, p99, or fail-rate SLOs.
- ZARI, film-unit, maeum-gyeol, SOULBOUND, ai-ops-control-plane, and beautiful-mind are out of this wave.
- Stub policies (single admission, hold expiry, resale lock) are desk behavior for tests and the demo. They are not protocol law.

## How the UI maps to kix-protocol

Charter labels are from Task 005. The app names those surfaces and calls an adapter. It does not redefine them.

| Desk | Route | ORIGINAL_32 / wave | Adapter call |
| --- | --- | --- | --- |
| Box office | `/` | E04 client over the catalog; settlement pointer F01–F03 (Wave 3, mock, read-only) | `listPerformances`, `settlementPreview` |
| Booking | `/booking/:eventId` | B01–B05 (Wave 4) and a rights reference from Wave 2 `rights` | `placeHold`, `releaseHold`, `confirmBooking` |
| Admission | `/admission` | P03 admission gate, referencing Wave 2 `zk_gate` | `checkAdmission` |
| Resale | `/resale` | R01–R05 (Wave 4) | `openResale`, `listResale`, `acceptResale` |

`confirmBooking` and `acceptResale` record `payment: "simulated-no-funds"`. The settlement panel lists the charter codes F01, F02, and F03 and does not compute shares.

`packages/protocol-adapter` is the only seam:

- `StubProtocolAdapter` — default. In-memory fixtures. `proofMode` is `stub` because `zk_gate` is not evaluated here.
- `HttpProtocolAdapter` — used when `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE` is set. Paths live in `PROVISIONAL_HTTP_PATHS`. Those paths are an app-side placeholder, not the OpenAPI spec. Replace that table when the published contract is bound. The client rejects booking payloads that are not marked `simulated-no-funds`, and it rejects settlement payloads that are not `mode: "mock"` with references `F01`, `F02`, `F03`.

View-model field names (`eventId`, `rightsRef`, and the rest) are local until that OpenAPI bind. They are not Move struct layouts.

## Protocol tip

The Wave 6 gate cited kix-protocol `main` near `b61e48d`. This workspace’s GitHub token cannot read `BeautifulMind-JT/kix-protocol` (`gh api` returns 404, `git ls-remote` returns repository not found), so that tip was **not** re-verified from here. Do not treat the stub or the provisional paths as the merged contract.

## Run locally

```bash
npm install
npm test
npm run dev
```

The desk listens on port 5173. Booking state is in the browser stub for that page load. A reload clears it.

To point the desk at an HTTP base after the contract bind:

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=https://your-protocol-host.example npm run dev
```

`npm run build` typechecks the adapter and builds the web app. `npm run typecheck` checks both packages.

## Tests

`npm test` runs the adapter suite:

- hold, confirm, and one-time admission
- resale lock, simulated transfer, and admission of only the new right
- hold release and unknown-right denial
- settlement preview stays a mock code pointer
- HTTP confirm posts to the provisional booking path and does not call a credit route
