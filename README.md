# kix-commerce-apps

Wave 6 commerce desk for KIX: box office, booking, admission, and resale.
This repository is the BeautifulMind-JT app host JunTae selected for product frontends.
Protocol, Move, and settlement contracts stay in [BeautifulMind-JT/kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol).

The UI is an operator desk over a protocol adapter. The default adapter is an in-memory stub so the desk can run without a chain. An HTTP adapter is included for a later bind to the kix-protocol API. Neither adapter moves funds or disburses credit.

## Non-goals

- Product frontend trees do not belong in `kix-protocol`. This repo does not copy Move, the kernel, or settlement math.
- Wave 7 marketing in this repo is a demo. It is not protocol conformance. See below.
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

## Wave 7 marketing demo

Wave 7 is a marketing demo only. It is not protocol conformance. The OpenAPI bind is still required before any production integration claim.

M01–M05 are Task 005 charter labels, used here as this app’s information architecture. This workspace still cannot read `kix-protocol` `docs/status/ORIGINAL_32_STATUS.md`, so these rows are not a reading of unpublished protocol definitions and they are not a contract. Do not treat the demo copy, the landing tags, or the tracking log as protocol truth.

| Code | Demo surface | Where |
| --- | --- | --- |
| M01 | Campaign pages | `/marketing` and `/marketing/:campaignId` |
| M02 | Landing shells | Document title, description, Open Graph tags, and a path-only canonical on each campaign. `robots` is `noindex, nofollow`. No production host is set. |
| M03 | Content slots | Hero, detail, and FAQ can be edited in the page session. The disclaimer slot is fixed. Nothing is saved as content management. |
| M04 | Creative variants | Two local copy variants per campaign. Switching them does not report a result. |
| M05 | Tracking stub | `/marketing/tracking`. An in-memory session log. Transport is `none`. Each row is `stub-not-transmitted`. This is not live analytics. |

Marketing does not add methods to `CommerceProtocol` and does not extend `PROVISIONAL_HTTP_PATHS`. Campaign copy lives in `apps/web/src/marketing/`. A desk fixture key is compared with the adapter catalog only so the page can open the existing booking desk when that stub row is present. The key is not a protocol identifier. View-model fields stay local until the OpenAPI bind.

`apps/web/public/robots.txt` disallows crawling of this demo. It is not a production crawl policy.

The Wave 6 desk routes are unchanged. Marketing is a separate layout linked from the desk nav.

## Run locally

```bash
npm install
npm test
npm run dev
```

The app listens on port 5173.

- Desk: `/`, `/booking/:eventId`, `/admission`, `/resale`
- Marketing demo: `/marketing`

Booking state and the marketing tracking log stay in the browser for that page load. A reload clears both.

To point the desk at an HTTP base after the contract bind:

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=https://your-protocol-host.example npm run dev
```

`npm run build` typechecks the adapter and builds the web app. `npm run typecheck` checks both packages.

## Tests

`npm test` runs the adapter suite and the marketing suite.

Adapter:

- hold, confirm, and one-time admission
- resale lock, simulated transfer, and admission of only the new right
- hold release and unknown-right denial
- settlement preview stays a mock code pointer
- HTTP confirm posts to the provisional booking path and does not call a credit route

Marketing:

- landing shells stay `noindex`, path-only, with no host
- campaign fixture keys join the default stub catalog
- variant edits stay local and the disclaimer cannot be cleared
- tracking rows stay `stub-not-transmitted` and expose no send path
- marketing sources do not contain provisional HTTP paths
