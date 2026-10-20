# Korean and English display (stub) apps bind

This bind records the first step of the Korean/English display layer: an app-internal message catalogue, a `t()` function, a user-chosen locale switch, and the first set of surfaces moved onto it. It is local, stub-scope product quality work. It does not claim integration, qualification, acceptance or release, and it does not claim that the app is translated: only the surfaces named below are, and the Migration table lists everything that is not.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission` and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request and maps no desk method onto a different body.

`contract_change=NO`. The catalogue, the locale values and the `kix-locale` storage key are app-internal. They are not a public schema, operation, capability or identifier.

## What did not change

- The default locale is `en`. A render with no provider is the English app, so every existing test, browser suite and the a11y matrix run as before. Flipping the default to Korean is a later owner choice and is not made here.
- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical (sha256 `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`). Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA` and `protocolMergeSha` do not move. `.github/`, `.aiops/`, `docs/aiops/` and `packages/` are untouched. Nothing changes in kix-protocol.
- No dependency was added and `package-lock.json` is unchanged; the layer uses the built-in `Intl`.
- No route or screen was added, so the route registry, the a11y screen matrix, the journey matrix and the evidence matrix are unchanged.
- The session record retention (TTL) stays `UNDETERMINED`. This node sets no value. The locale key is a display preference, not recovery evidence, and is not part of the session journal.
- Text owned by the adapter package (`CREDIT_BOUNDARY.note`, `observation.detail`, the `meta.*` values) is shown as the adapter gives it; `packages/` is locked.

## Behaviour

**Catalogue.** `apps/web/src/i18n/catalogue.ts` holds `en` (the source, `as const`) and `ko` (typed `Record<MessageKey, string>`, so a missing Korean key fails typecheck). `t(key, params)` fills `{name}` placeholders; the parameter names are typed from the English text, and an unresolved placeholder is left visible, never thrown on. `translate.ts` and `locales.ts` are pure modules; only `locale-store.ts` names `sessionStorage`.

**Locale choice.** The user chooses. The start-up order is the `?lang=ko` or `?lang=en` URL parameter (exact strings only), then the tab's `sessionStorage` value under `kix-locale`, then `en`. There is no `localStorage` and no `navigator.language` guess. A blocked store means the choice lives in memory for the page load. The switch in the header is two buttons (`aria-pressed`, a check mark on the chosen one, each carrying its own `lang`); a polite status line is written only after a user change; focus stays on the pressed button. `<html lang>` follows the locale after start-up. `index.html` keeps `lang="en"` and appends a Korean `<span lang="ko">` to each of its two boot notes, because those show before any script runs.

**Protocol words.** `UNKNOWN`, `NOT_BOUND`, `STALE`, `UNDETERMINED`, binding words (`stub-only`, `not-bound`, …), codes (`SCREEN_LOAD_FAILED`), `shell-fault-NNNN` references and field names (`expiresAt`, `expired`) are never translated. Korean may add a gloss in parentheses beside an outcome word (`UNKNOWN (결과 미확인)`); the word stays. Korean does not use 성공, 완료 or 승인, and uses 실패 only for the known screen-load fault text, which says in the same sentence that it is not an UNKNOWN outcome. UNKNOWN is never rendered as a failure.

**Time and amounts.** Clock text for the `<time>` callers listed below follows the locale (`en-GB` or `ko-KR`, zone label `UTC`). Expiry is never decided from the locale: `DeadlineLine` copies the adapter `expiresAt` and `expired` in both languages, and `present.ts` is unchanged. Amounts stay the synthetic notice and `mock units`; no currency sign, `KRW` or `USD` appears in Korean text.

**Narrow viewports.** The switch wraps, banners, definition values and breadcrumbs break long words, and `:lang(ko)` uses `word-break: keep-all`. A test bounds each Korean string against its English length.

## Moved onto the catalogue

Shell chrome (skip link, brand eyebrow and title, Menu button, switch), the Surfaces nav and group names, the breadcrumb, document titles, the screen loading note, `NotFound`, the route and app error panels (both variants), `StatusMark`, `AmountNotice`, `DeadlineLine`, the transport status word and the stub/checking banner text, and `<time>` text on the routes marked below. `common.inProgress`, `common.error` and `common.empty` and the `outcome.*.gloss` keys are defined for the next migration; no screen consumes them yet.

## Migration table

Every registry route is listed. "chrome only" means the shell around the screen is Korean-capable and the screen body is not yet moved onto the catalogue; no route is fully migrated. Where a screen draws `StatusMark`, `AmountNotice` or `DeadlineLine`, those pieces follow the locale; this table makes no per-route claim about them.

| Path | Status | Label | Note |
| --- | --- | --- | --- |
| `/` | chrome only | Box office | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/buyer` | chrome only | Buyer | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/discovery` | chrome only | Discover | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/inventory` | chrome only | Seats and GA | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/booking/:eventId` | chrome only | Booking | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/admission` | chrome only | Admission | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/resale` | chrome only | Resale | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/gift` | chrome only | Gift | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/mobile` | chrome only | Mobile shell | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/assistant` | chrome only | Assistant | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/organizer` | chrome only | Organizer | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/organizer/workspace` | chrome only | Organizer workspace | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/merchant` | chrome only | Merchant | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/finance` | chrome only | Finance | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/provider` | chrome only | Provider journey | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/credit` | chrome only | Credit | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/credit/origination` | chrome only | Credit origination | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/credit/servicing` | chrome only | Credit servicing | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketing` | chrome only | Marketing | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketing/journey` | chrome only | Benefit journey | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketing/m01` | chrome only | Marketing M01 | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketing/m02` | chrome only | Marketing M02 | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/marketing/m03` | chrome only | Marketing M03 | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/marketing/m04` | chrome only | Marketing M04 | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketing/m05` | chrome only | Marketing M05 | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English; `<time>` follows the locale |
| `/platform` | chrome only | Trading platform | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/marketplace-performance` | chrome only | Marketplace bench | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/permissions` | chrome only | Permissions | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/notifications` | chrome only | Notifications | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/identity` | chrome only | Journey context | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/session` | chrome only | Session recovery | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/receipts` | chrome only | Receipts | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/handoff` | chrome only | Local handoff | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/journeys` | chrome only | Journeys | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/qualification` | chrome only | Qualification | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/release` | chrome only | Release | chrome (nav, breadcrumb, title, loading note, error panels) in ko; screen body English |
| `/help` | chrome only | Help | chrome (nav, breadcrumb, title, loading note, error panels, help line) in ko; screen body English |

Also not migrated and left English on purpose or by lock: the view-model `.ts` files (they format clocks with `en-GB`), `ReservationPanel` and `ResalePanel` clock text, the Shell-made transport error detail, ORIGINAL_32 charter labels (설계중, 미착수), binding words, adapter-owned text, and the Latin brand `KIX Box Office`.

## Evidence

Typecheck, build, and the full stub test run are recorded in the pull request with the source SHA. The browser pass (Chrome headless: normal, empty, error, loading, keyboard, 320 px) is listed there; real devices, screen readers, HTTP mode and the live gate are unverified.
