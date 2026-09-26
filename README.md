# kix-commerce-apps

Wave 6 commerce desk for KIX: box office, booking, admission, and resale.
Wave 7 adds marketing screens for ORIGINAL_32 labels M01–M05. Those screens are stub demos and stay 설계중.
This repository is the BeautifulMind-JT app host JunTae selected for product frontends.
Protocol, Move, and settlement contracts stay in [BeautifulMind-JT/kix-protocol](https://github.com/BeautifulMind-JT/kix-protocol).

The UI is an operator desk over a protocol adapter, plus a separate marketing stub. The default adapter is an in-memory stub so the desk can run without a chain. An HTTP adapter is included for a later bind to the kix-protocol API. Neither adapter moves funds or disburses credit. The marketing stub does not call booking, resale, admission, or settlement writes.

## Non-goals

- Product frontend trees do not belong in `kix-protocol`. This repo does not copy Move, the kernel, or settlement math.
- Wave 7 marketing (M01–M05) is a browser-session stub. Labels stay 설계중. Limits are in [docs/wave7-marketing-m01-m05.md](docs/wave7-marketing-m01-m05.md). HTTP/OpenAPI binding remains a required gate before chain, payment, production, contract-conformance, or launch claims.
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

Wave 7 marketing routes use the local stub in `apps/web/src/marketing`. They are not protocol calls, except a display-only `listPerformances` read on M02.

| Marketing | Route | ORIGINAL_32 | Write target |
| --- | --- | --- | --- |
| Hub | `/marketing` | M01–M05, status 설계중 | marketing session stub |
| Fan qualification / membership | `/marketing/m01` | M01 팬 자격 / 멤버십 | marketing session stub |
| Presale | `/marketing/m02` | M02 선예매 | marketing session stub |
| Coupon / promotion | `/marketing/m03` | M03 쿠폰 / 프로모션 | marketing session stub |
| Referral / rewards | `/marketing/m04` | M04 추천 / 리워드 | marketing session stub |
| CRM / data use | `/marketing/m05` | M05 CRM / 데이터 활용 | marketing session stub |

`confirmBooking` and `acceptResale` record `payment: "simulated-no-funds"`. The settlement panel lists the charter codes F01, F02, and F03 and does not compute shares.

`packages/protocol-adapter` is the only seam:

- `StubProtocolAdapter` — default. In-memory fixtures. `proofMode` is `stub` because `zk_gate` is not evaluated here.
- `HttpProtocolAdapter` — used when `VITE_KIX_PROTOCOL_MODE=http` and `VITE_KIX_PROTOCOL_API_BASE` is set. Paths live in `PROVISIONAL_HTTP_PATHS`. Those paths are an app-side placeholder, not the OpenAPI spec. Replace that table when the published contract is bound. The client rejects booking payloads that are not marked `simulated-no-funds`, and it rejects settlement payloads that are not `mode: "mock"` with references `F01`, `F02`, `F03`.

View-model field names (`eventId`, `rightsRef`, and the rest) are local until that OpenAPI bind. They are not Move struct layouts.

Marketing fixtures are not added to `CommerceProtocol` and do not read `PROVISIONAL_HTTP_PATHS`. M02’s catalog list is display-only. A recorded presale interest does not place a hold. M05 consent flags keep `channelSend: "none"`.

## Protocol tip

The Wave 6 gate cited kix-protocol `main` near `b61e48d`. This workspace’s GitHub token cannot read `BeautifulMind-JT/kix-protocol` (`gh api` returns 404, `git ls-remote` returns repository not found), so that tip was **not** re-verified from here. Do not treat the stub or the provisional paths as the merged contract.

## Run locally

```bash
npm install
npm test
npm run dev
```

The desk listens on port 5173. Booking state and the marketing session stay in the browser for that page load. A reload clears both.

To point the desk at an HTTP base after the contract bind:

```bash
VITE_KIX_PROTOCOL_MODE=http VITE_KIX_PROTOCOL_API_BASE=https://your-protocol-host.example npm run dev
```

`npm run build` typechecks the adapter and builds the web app. `npm run typecheck` checks both packages.

## Tests

`npm test` runs the adapter suite and the web marketing stub:

- hold, confirm, and one-time admission
- resale lock, simulated transfer, and admission of only the new right
- hold release and unknown-right denial
- settlement preview stays a mock code pointer
- HTTP confirm posts to the provisional booking path and does not call a credit route
- marketing labels stay 설계중, with session-only cards, presale notes, coupon markers, referral markers, and consent flags
- marketing routes render, and the box office route still mounts
