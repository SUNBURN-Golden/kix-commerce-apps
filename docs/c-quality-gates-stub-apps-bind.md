# Static quality gates (stub) apps bind

This bind adds the static quality gates the repo did not have: an ESLint flat config with TypeScript, react-hooks and jsx-a11y rules; v8 coverage measurement with recorded floors; an offline production-dependency lock and license gate plus a warning-only `npm audit`; an import-cycle check; and an unused-export report. The existing CI jobs are untouched; `lint`, `coverage`, `deps-check`, `audit-warning` and `cycle-check` are new additive jobs that run the same commands as the local scripts. This is local tooling only. Nothing about it is a qualification, an acceptance, or a release signal.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.

M2: the adapter composes nothing past `accept_trade`. `capture` and `settle_capture` stay out of every journey and are never sent. `commit_trade`, `open_admission`, and `admit` stay uncomposed with their not-bound reasons recorded. H1: `placeHold` stays not-bound with `consideredAction` `reserve_listing`, and `prepare_trade` is never given a `placeHold` body. This node composes no write, sends no request, and maps no desk method onto a different body.

## What did not change

- `packages/protocol-adapter/src/commerce-bindings.ts` is byte-identical. Its sha256 is `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`, and a test checks it.
- Both vendored OpenAPI pins, `PINNED_ACTIONS`, the CI `KIX_PROTOCOL_GATE_SHA`, and `protocolMergeSha` do not move. `.aiops/` and `docs/aiops/` are untouched. Nothing changes in kix-protocol.
- The existing CI jobs (`desk`, `gate-token`, `live-gate`, `browser-e2e`, `a11y-observation`, `bundle-budget`) keep their names and steps. No existing test was skipped, deleted, or weakened to pass a gate.
- `contract_change=NO`. The floor numbers, the allowlist, the knip config and the check scripts are app-internal tooling. They are not a public schema, operation, capability, or identifier.
- No runtime behavior changed. Source edits are lint fixes only: they rename nothing, move no logic, and change no output. The only code edits are enumerated below.

## What was added

| Piece | Path | Blocks |
| --- | --- | --- |
| ESLint flat config | `eslint.config.mjs` (`@eslint/js`, `typescript-eslint` recommended + strict, `eslint-plugin-react-hooks` classic rules, `eslint-plugin-jsx-a11y` recommended on `*.tsx`) | yes, via `npm run lint` (`eslint --max-warnings=0`) |
| Coverage floors | `coverage-floors.json` + `packages/protocol-adapter/vitest.config.ts` + `apps/web/vitest.config.ts` (v8) | yes, via `npm run coverage:check` |
| Dependency lock + license gate | `scripts/deps-check.mjs` + `scripts/license-allowlist.json` | yes, via `npm run deps:check` |
| npm audit (production) | `scripts/audit-warn.mjs` | no, warning only |
| Import-cycle check | `scripts/cycle-check.mjs` (madge 8.0.0, `--extensions ts,tsx`) | yes, via `npm run cycle-check` |
| Unused-export report | `scripts/unused-exports-report.mjs` + `knip.json` (knip 6.40.0) | no, report only |
| Lint runner | `scripts/lint.mjs` | yes |
| CI jobs | `.github/workflows/ci.yml`: `lint`, `coverage`, `deps-check`, `audit-warning`, `cycle-check` | the warning-only job never fails |

Every new devDependency is pinned to an exact version published at least 7 days before this change: `eslint`/`@eslint/js` 9.39.5 (2026-07-10), `typescript-eslint` 8.71.2 (2026-10-12), `eslint-plugin-react-hooks` 7.1.1 (2026-04-17), `eslint-plugin-jsx-a11y` 6.10.2 (2024-10-26), `@vitest/coverage-v8` 3.2.7 (2026-07-06), `knip` 6.40.0 (2026-10-06), `madge` 8.0.0 (2024-08-05), `globals` 14.0.0 (2024-02-10). `package-lock.json` is updated in the same change. No new tool needs network at check time except `npm run audit:warn`, which is the warning-only job.

## Rule and exception decisions

- `react-hooks` rules are scoped to `apps/web/**`. The e2e harness names its Playwright-fixture helper `useBrowser`; it is not a React hook and the plugin would false-positive on 23 test files.
- The classic hook rules (`rules-of-hooks` error, `exhaustive-deps` warn) are enabled. The React-Compiler-era rules shipped by `eslint-plugin-react-hooks` 7.x are not enabled; this codebase predates them and `--max-warnings=0` already makes the two kept rules effective.
- `jsx-a11y/no-noninteractive-tabindex` allows `role="region"`: the scrollable panels are intentional focus targets so keyboard users can reach overflowing tables.
- `@typescript-eslint/no-unused-vars` ignores a leading underscore, the codebase's "intentionally unused" convention for not-bound desk methods.
- Test files and test support relax `no-explicit-any` and `no-non-null-assertion`; they assert on untyped stubs and edge cases on purpose.
- `scripts/*.mjs` get Node globals; they are Node runners, not browser code.

18 inline `eslint-disable` comments remain. Each carries a one-line justification at the site. They are not blanket suppressions:

| Rule | Files | Reason |
| --- | --- | --- |
| `@typescript-eslint/no-non-null-assertion` | `credit-servicing.ts` (4), `sha256.ts` (1 block), `tenant-permissions.ts`, `notification-inbox.ts`, `route-registry.ts` | indexes/types bounded by construction; each site says why |
| `no-control-regex` | `finance-operations.ts`, `tenant-permissions.ts`, `receipt-explorer.ts`, `safe-text.tsx` | the regex's purpose is to reject or strip control characters |
| `jsx-a11y/no-noninteractive-element-interactions` | `Receipts.tsx` (2), `SurfaceNav.tsx` | arrow-key navigation lives on the list whose items are buttons; Escape closes the open nav menu while focus is inside it |
| `jsx-a11y/label-has-associated-control` | `M05Consent.tsx` (2) | the input is nested inside the label; an `htmlFor`/`id` pair was also added |
| `@typescript-eslint/no-dynamic-delete` | `apps/e2e/src/build.ts` | the harness scrubs every `VITE_*` env var on purpose |

Code edits that are not disables: `credit-case.ts` writes `JournalOp` as a union type instead of a `typeof`-indexed const; `refund-return.ts` replaces two `!` with a null check and an unreachable-throw; `tenant-permissions.ts` changes `let` to `const`; `receipt-explorer.ts` removes useless regex escapes; `translate.ts` filters `matchAll` groups instead of asserting; `budget-record.ts` reads `sorted[index] ?? Number.NaN` (identical behavior for an out-of-range index); `App.tsx` throws a named error if a route alias points nowhere; `M05Consent.tsx` adds `htmlFor`/`id` pairs. No test file was edited to satisfy lint.

## Coverage floors

Floors are measured, not guessed. `npm run coverage:check` runs each suite with v8 coverage and compares the summary against `coverage-floors.json`. Policy, recorded in that file: lowering any floor requires an explicit decision; raising is auto-allowed. Measured on this base:

| Workspace | lines | functions | branches | statements |
| --- | --- | --- | --- | --- |
| `@kix/protocol-adapter` | 91.14 (floor 91.1) | 97.41 (97.4) | 84.52 (84.5) | 91.14 (91.1) |
| `@kix/web` | 83.65 (floor 83.6) | 60.49 (60.4) | 84.63 (84.6) | 83.65 (83.6) |
| `@kix/e2e` | null | null | null | null |

`@kix/e2e` carries no floor: its suites drive the built stub bundle through Playwright in headless Chrome, so v8 instrumentation of that code path would need build-time transforms that are out of scope for a static-gate node. The `null` entry plus its note is the documented exception.

## Dependency checks

`npm run deps:check` is fully offline over `package-lock.json` plus the four `package.json` files. It fails when: a direct production dependency spec is not an exact version (`apps/web` therefore pins `react` 19.3.0, `react-dom` 19.3.0, `react-router-dom` 7.18.4 — the resolved versions are unchanged, only the specs moved from ranges to pins), a non-dev lockfile entry lacks a resolved version or an integrity hash, or a non-dev lockfile entry's SPDX license is outside `scripts/license-allowlist.json`. Workspace `link: true` entries are local source trees and are skipped. The allowlist is `["MIT"]`, bootstrapped from every production dependency currently in the lockfile; adding or removing an entry needs legal/product approval, not a code decision.

`npm run audit:warn` runs `npm audit --omit=dev`, prints the report, and always exits 0. It needs the registry, so it must not block CI; the offline gate above is the blocking one. The observed run found 0 production vulnerabilities (the 4 advisories `npm ci` prints are dev dependencies).

`npm run cycle-check` runs `madge --circular --extensions ts,tsx` in each workspace source tree. It processed 146 / 291 / 74 files across the three trees and found no cycle. Known skip: madge does not follow the `@kix/protocol-adapter` package boundary or `?raw` vendored-OpenAPI imports, so a cycle that crosses a package boundary is out of this check's reach.

`npm run unused-exports` runs `knip --no-progress` and prints unused files, exports and types plus one duplicate-export note. It is report-only: much of the flagged surface is intentional public API of the adapter and the desk modules, and deleting it is a product decision, not a lint one.

## Local runs observed

Run on 2026-10-20 at base main `b9717b404a2ca60c11316d713c901dde23519d37` plus this change, in a local worktree. These are local results, not CI results; the exact PR head is in the PR body.

| Run | Result |
| --- | --- |
| `npm ci` | exit 0 (493 packages; 4 dev-dependency advisories noted, none production) |
| `npm run lint` | exit 0 after the fixes above; earlier run reported 9 errors on newly merged files, all fixed or justified |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `KIX_REQUIRE_GATE=0 npm test`, adapter | 62 files passed, 5 skipped (1293 tests, 23 skipped — the live-gate skips are by design without a kix-protocol checkout) |
| `KIX_REQUIRE_GATE=0 npm test`, web | 60 files passed (737 tests) |
| `npm run coverage:check` | exit 0; measured values in the table above |
| `npm run deps:check` | exit 0 (589 lockfile entries, 4 package.json files); an earlier draft failed on workspace `link: true` entries until they were skipped |
| `npm run cycle-check` | exit 0, no cycles |
| `npm run audit:warn` | exit 0, `npm audit --omit=dev` found 0 vulnerabilities |
| `npm run unused-exports` | exit 0, report printed |

Not run locally: the browser e2e, a11y and budget suites (they need the runner's Chrome); the `live-gate` job (needs the kix-protocol read token). No UI changed, so no browser pass is claimed.

## Not verified

- No real producer, SDK, provider, payment, credit disbursement, venue scan, bank rail, or marketplace was connected or checked. These gates are static.
- The gates catch what they are written to catch; they are not proof of product correctness, qualification, acceptance, or release.
- `npm audit` output depends on the advisory feed at run time; the observed 0 is a point-in-time reading, which is why it is warning-only.
- madge's two boundary skips (above) mean a cross-package cycle would go unseen.

## Acceptance mapping

| Item | Evidence |
| --- | --- |
| lint, coverage and deps jobs reproducible locally and in CI with the same commands | root `package.json` scripts are the exact CI step commands; the local-runs table above |
| Existing tests not skipped or deleted for coverage | floors were measured on the unmodified suite; `git diff` touches no test file's skip status; every test count matches the base |
| No secret- or token-requiring step | new jobs declare `permissions: contents: read` or nothing; scripts read only the repo; `audit:warn` hits the public registry anonymously and cannot fail the job |

## Hold

Nothing here decides completion, acceptance, or release. A green gate is a static property of the repo, not a product claim.
