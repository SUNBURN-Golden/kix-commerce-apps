# Untrusted render, CSP, and storage audit (stub) apps bind

This node adds local-only evidence for text rendering, browser policy, and storage use. It adds no route, screen, protocol command, binding, producer connection, or public schema. The source and base-main SHA at implementation start was `eedcfaeca256b297cd3472786e3ff09102ab52ce`; the exact delivery HEAD belongs in the supervisor's PR record.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce. The booking journey still ends at `accept_trade`; `capture`, `settle_capture`, `commit_trade`, `open_admission`, and `admit` remain uncomposed. `placeHold.consideredAction` remains `reserve_listing` and `placeHold` remains not-bound.

## Boundaries unchanged

- `packages/protocol-adapter/src/commerce-bindings.ts` remains byte-identical (sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`).
- The OpenAPI pins, `PINNED_ACTIONS`, CI gate SHA, and `protocolMergeSha` do not move. Nothing changes in kix-protocol.
- Session retention is still `UNDETERMINED`. No TTL, expiry, eviction, or retention value is introduced.
- Stub remains the default. No browser fetch, retry, fallback, proxy, redirect, public host, secret, payment, KYC, disbursement, equipment, or production runtime is added.
- Tests are local evidence only. They do not claim integration, qualification, acceptance, or release.

## Render safety

A static test scans all web runtime TypeScript and TSX files and rejects React executable-HTML injection, `innerHTML` assignment, `eval`, the `Function` constructor, literal `javascript:` URLs, and `document.write`. React text nodes remain the rendering mechanism.

The hostile fixture set covers HTML/event-handler text, a JavaScript-looking URL, 500 characters, bidi and C0/C1 control characters, and emoji. `SafeText` is used for the route-derived booking event id, the `rightsRef` search parameter echoed on the admission page, and the admission credential title (user input on the admission page, adapter data on the booking page): display text replaces bidi/control characters with a visible replacement glyph and truncates long values, while a `<details><pre>` text node retains the complete original for selection and copying. It never interprets the original as markup.

## Browser policy

`apps/web/index.html` declares this policy:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

The e2e static server sends the same CSP as a response header, plus `Referrer-Policy: same-origin` and `X-Content-Type-Options: nosniff`. The production bundle uses an external module script. The only inline-style exception is the pre-existing no-script boot note, so `style-src` retains `'unsafe-inline'`; the React inline scale height moved to the stylesheet.

The browser test installs a `securitypolicyviolation` listener before navigation, opens a hostile booking URL, verifies the original remains text, and requires zero CSP violations, zero non-loopback requests, zero non-GET requests, and zero application fetch/XHR/beacon/WebSocket calls.

The Vite development server is not this evidence path: HMR development behavior can require a different policy. The strict browser assertion serves the production stub bundle through the loopback-only e2e server.

## Storage allow-list

The runtime audit found no web-app `localStorage`, IndexedDB, or cookie writes. The only browser persistence is tab-scoped `sessionStorage`:

| Key or prefix | Purpose | Value format |
| --- | --- | --- |
| `kix-session-journal` | unresolved/confirmed synthetic session journal | bounded versioned JSON written by `SessionJournal` |
| `kix-session-journal-quarantine` | corrupt/lost journal evidence | bounded versioned JSON quarantine record |
| `kix-locale` | display-language preference | the literal `en` or `ko` |
| `kix-onboarding` | first-run guide dismissal preference | the literal `dismissed` |
| `kix-reservation-attempt:` | reservation attempt counter | non-negative integer text |
| `kix-resale-attempt:` | resale attempt counter | non-negative integer text |
| `kix-organizer-attempt:` | organizer attempt counter | non-negative integer text |
| `kix-journey-attempt:` | journey attempt counter | non-negative integer text |
| `kix-gift-attempt:` | gift attempt counter | non-negative integer text |
| `kix-credit-attempt:` | credit attempt counter | non-negative integer text |
| `kix-consent-attempt:` | consent attempt counter | non-negative integer text |
| `kix-admission-attempt:` | admission attempt counter | non-negative integer text |
| `kix-settlement-attempt:` | settlement attempt counter | non-negative integer text |

Exact keys and non-empty suffixes on attempt prefixes are required. Journal access is wrapped and attempt writes validate before touching storage. Tests enumerate a storage object and fail unknown keys. Stored-value tests directly reuse `findSensitive` from `apps/e2e/src/redact.ts`, covering email, bearer/token strings, JWTs, and long digit runs; a secret-like fixture must be detected.

## Acceptance evidence

- Static sink scan and hostile SSR tests: `apps/web/test/untrusted-render-static.test.ts`, `apps/web/test/untrusted-render-safe-text.test.tsx`.
- Policy shell test: `apps/web/test/index-csp.test.ts`.
- Allow-list, secret-pattern, and unchanged-retention tests: `apps/web/test/storage-allow-list.test.ts`.
- Response-header and real-browser checks: `apps/e2e/tests/harness.e2e.test.ts`, `apps/e2e/tests/untrusted-render.e2e.test.ts`.
- Existing e2e run-record redaction remains active. No new unredacted trace or record format is introduced.

No real environment or public deployment is verified. Browser results apply only to the local production stub bundle and loopback static server.
