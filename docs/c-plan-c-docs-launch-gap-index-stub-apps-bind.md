# Launch-gap index apps bind

## Scope and authority

Node `c-plan-c-docs-launch-gap-index-stub`; `contract_change=NO`. Baseline `dabd7086de556be0489ab71314a503658b126eda` on `agent/kixc-c-plan-c-docs-launch-gap-index-stub`. The manual queue instruction of 2026-10-30 authorizes this documentation scope only. Repository rules are README and the read-only delegation record; no pending/draft node is implemented.

M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce

Retain that exact citation in the supervisor’s PR summary. BookingJourney ends at accept_trade; capture and settle_capture remain unsent; commit_trade, open_admission and admit remain uncomposed by that journey. OrganizerConsole independently supports its six published commands. placeHold keeps consideredAction reserve_listing and stays not-bound. No desk method is remapped. The locked bindings SHA-256 remains `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`.

The [index](launch-gap-index.md) covers every README-table route and canonical registry route, preserving shared catalogue, settlement, journey, reservation, refund/return and discovery surfaces. It also describes the discovery alias, development gallery, not-found state and cross-cutting accessibility row. Each canonical entry records Surface, Current boundary, Integration HTTP, External dependency, Owning decision and Evidence.

Source precedence is current [route registry](../apps/web/src/shell/route-registry.ts), [workspace registry](../apps/web/src/workspace/registry.ts), [marketing paths/labels](../apps/web/src/marketing/labels.ts), [handoff consumed/pending producers and pins](../apps/web/src/handoff/packet.ts), then current route binds and explicit correction notes. [Catalogue-v2 correction](audit-6-decision-apps-bind.md) governs the SDK/manifest/vector tuple; historical null-digest statements remain history. BOOTSTRAP grants catalogue-schema binding only. Producer statuses describe this checkout; no fresh upstream availability is asserted.

Only README and the two new Markdown documents change. Runtime, dependencies, pins, CI, budgets, protected aiops paths and locked bindings stay untouched. No production deploy, real payment, chain/mainnet, KYC, credit disbursement, venue equipment or new command is needed to describe a gap. Provider, environment, credentials and unresolved policy values remain UNDETERMINED. No blocking decision or DECISION_REQUIRED.md is needed.

## Acceptance mapping

| Acceptance | Delivered evidence |
| --- | --- |
| Every README-table route appears | Offline checker extracts route cells and compares them with canonical index headings. |
| Every current route and shared surface appears | Checker derives canonical paths from ROUTES and marketing labels, rejects missing/extra/duplicate headings, checks all routed workspace IDs, alias, development gallery and not-found explanation. |
| Relative links and local fragments resolve | Checker reads only the three changed Markdown documents and their local link targets with Node built-ins; no package, script or network dependency added. |
| No production-readiness claim | Each route has current local boundaries, unavailable capabilities and authority; UNKNOWN, NOT_BOUND, STALE and COMPENSATION_UNDEFINED remain distinct; ORIGINAL_32 labels unchanged. |
| README entry point and stale evidence references | Index/bind linked beside route tables; current browser, M01–M04 and receipt pagination evidence linked while historical deliveries remain available. |
| Required stub CI and unchanged budgets | Actual local results recorded below; Markdown-only diff and locked-file hash checked. |

## Reproducible offline documentation check

Run from repository root using Node 22. This checks links in README and both new documents; it does not recursively revalidate historical documents or fetch remote links. Existing repository tests do not automatically check the new index. The inline checker is deliberately documentation, not a new runtime or CI script.

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const indexPath = 'docs/launch-gap-index.md';
const index = read(indexPath);
const registry = read('apps/web/src/shell/route-registry.ts');
const marketing = read('apps/web/src/marketing/labels.ts');
const routeBlock = registry.split('export const ROUTES = [')[1].split('] as const')[0];
const canonical = [
  ...Array.from(routeBlock.matchAll(/route\("[^"\n]+", "([^"\n]+)"/g), (m) => m[1]),
  ...Array.from(marketing.matchAll(/path: "([^"\n]+)"/g), (m) => m[1]),
];
const headings = Array.from(index.matchAll(/^## `(\/[^`\n]*)`$/gm), (m) => m[1]);
assert.equal(new Set(canonical).size, canonical.length, 'duplicate registry route');
assert.equal(new Set(headings).size, headings.length, 'duplicate index route');
assert.deepEqual([...headings].sort(), [...canonical].sort(), 'canonical route mismatch');
const readmeRoutes = new Set(Array.from(
  read('README.md').split('\n').filter((line) => line.startsWith('|')).join('\n')
    .matchAll(/`(\/[^`\s]+|\/)`/g), (m) => m[1],
));
for (const path of readmeRoutes) assert(headings.includes(path), `README route missing: ${path}`);
const sections = new Map(Array.from(index.matchAll(
  /^## `(\/[^`\n]*)`\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm,
), (m) => [m[1], m[2]]));
for (const [path, section] of sections) {
  for (const field of ['Surface', 'Current boundary', 'Integration HTTP', 'External dependency', 'Owning decision', 'Evidence']) {
    assert(section.includes(`| ${field} |`), `${path}: missing ${field}`);
  }
}
const workspace = read('apps/web/src/workspace/registry.ts').split('export const WORKSPACE_SURFACES = [')[1].split('] as const')[0];
let surfaces = 0;
for (const m of workspace.matchAll(/\{\s*id: "([^"]+)"[\s\S]*?route: "([^"]+)"/g)) {
  if (m[2] === '(none)') continue;
  assert(sections.get(m[2])?.includes(`\`${m[1]}\``), `workspace surface missing: ${m[1]}`);
  surfaces++;
}
const aliases = registry.split('export const ROUTE_ALIASES = [')[1].split('] as const')[0];
for (const m of aliases.matchAll(/path: "([^"]+)"/g)) assert(index.includes(`\`${m[1]}\``), 'alias missing');
const gallery = registry.match(/route\("component-gallery", "([^"]+)"/)[1];
assert(index.includes(`\`${gallery}\``), 'development gallery missing');
assert(index.includes('`*` is the not-found state'), 'not-found explanation missing');
const unfenced = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
function anchors(text) {
  const counts = new Map();
  return new Set(Array.from(unfenced(text).matchAll(/^#{1,6}\s+(.+)$/gm), (m) => {
    const base = m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return base + (n ? `-${n}` : '');
  }));
}
let links = 0;
for (const doc of ['README.md', indexPath, 'docs/c-plan-c-docs-launch-gap-index-stub-apps-bind.md']) {
  const text = unfenced(read(doc));
  for (const m of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const target = m[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue; // offline: remote links are not fetched
    const [file, fragment] = target.split('#');
    const path = file ? resolve(dirname(doc), decodeURIComponent(file)) : resolve(doc);
    assert(statSync(path).isFile(), `${doc}: dangling file ${target}`);
    if (fragment) assert(anchors(read(path)).has(decodeURIComponent(fragment)), `${doc}: dangling fragment ${target}`);
    links++;
  }
}
console.log(`PASS: ${readmeRoutes.size} README routes; ${headings.length} canonical routes; ${surfaces} routed workspace surfaces; alias, gallery, not-found; ${links} relative links/fragments.`);
JS
```

Observed output is recorded with the verification results below.

## Actual local verification

All verification commands below ran at repository root with the inline prefix `PATH=/tmp/kix-node22-bin:$PATH` (Node v22.23.4). Output was retained in `/tmp/kix-launch-gap-*.log`; no background shell job was used. Every listed check exited 0. Installation preceded the focused suites; focused suites preceded typecheck/build/full stub verification. No code fix or check relaxation was needed.

| Command actually run (PATH prefix as above) | Observed result |
| --- | --- |
| `npm ci` | PASS; 535 packages added, 539 audited. Existing install audit reported 24 advisories (21 moderate, 1 high, 2 critical), plus deprecation/install-script warnings. No audit fix or dependency/lockfile change. |
| `npm exec -w @kix/web -- vitest run test/route-registry.test.tsx test/user-guides.test.tsx test/local-evidence-matrix.test.ts test/workspace-registry.test.ts` | PASS; 4 files, 58 tests. |
| `KIX_REQUIRE_GATE=0 npm exec -w @kix/protocol-adapter -- vitest run test/booking-journey.test.ts test/consent-bind.test.ts test/gift-transfer.test.ts test/http-adapter.test.ts` | PASS; 3 existing files, 58 tests. The final filter named a nonexistent file and matched none; it did not exercise HTTP. The explicit HTTP suites below supply that evidence. |
| `KIX_REQUIRE_GATE=0 npm exec -w @kix/protocol-adapter -- vitest run test/http-integration-gate.test.ts test/http-transport-hardening.test.ts` | PASS; 2 files, 60 passed, 2 live-gate tests skipped. Existing binding/payload/transport guards exercised; no live gate claimed. |
| `npm run typecheck` | PASS; protocol adapter and web TypeScript checks. |
| `npm run build` | PASS; protocol adapter typecheck, web typecheck and Vite production-format stub-default build. |
| `KIX_REQUIRE_GATE=0 npm test` | PASS; adapter: 70 files passed, 5 files skipped, 1833 tests passed and 23 skipped. Web: 97 files / 1382 tests passed; cold entry: 1 file / 6 tests passed. Total 3221 passed, 23 skipped. |
| `npm run budget` | PASS; initial JS gzip 161273 bytes, initial CSS gzip 4974 bytes, total gzip 784937 bytes; all route/chunk/growth checks pass. Budget file unchanged, including initialJsGzipMaxBytes 290000. |
| `npm run lint` | PASS; existing ESLint gate. |
| `npm run deps:check` | PASS; production dependency gate, 4 manifests and 630 lockfile entries checked. |
| `npm run cycle-check` | PASS; adapter/web/e2e, no circular imports. Madge reported existing resolution warnings (15/16/16) without failing. |
| `node --input-type=module < /tmp/kix-launch-gap-check.mjs` | PASS; exact inline documentation checker above. |
| `node --input-type=module < /tmp/kix-launch-gap-documented-check.mjs` | PASS; checker extracted from this Markdown, verified byte-for-byte against the original executed checker. |
| `git diff --check` | PASS; no whitespace errors. |
| `git diff --name-only` and `git status --short` | Only README is tracked-modified; both new docs are untracked. A Python3 check of this output plus `git ls-files --others --exclude-standard` confirms exactly the three authorized Markdown paths and no others. |
| `git diff --exit-code -- .aiops docs/aiops packages/protocol-adapter/src/commerce-bindings.ts apps/web/bundle-budget.json .github/workflows/ci.yml package.json package-lock.json` | PASS; no changes to these protected/locked/configuration paths. The three-file allowlist check also excludes every runtime, pin and vendor path. |
| `sha256sum packages/protocol-adapter/src/commerce-bindings.ts` | PASS; `83816276bc2c281161ad4df78c91d5696051c276e839c6d327dc026348d45249`. |

Observed offline checker output:

```text
PASS: 32 README routes; 38 canonical routes; 42 routed workspace surfaces; alias, gallery, not-found; 150 relative links/fragments.
```

Read-only environment/source inspections also ran (`pwd`, `git rev-parse HEAD`, Node/npm version checks, file reads, `rg`, diff/status and log summaries). Temporary Python3 authoring/check extraction and the documented Node checker introduced no repository script or test dependency.

## Deviations and limitations

No scope deviation. The default shell initially reported Node v20.19.2; an existing local Node v22.23.4 binary at `/tmp/kix-node22-bin/node` is used via PATH for verification, matching the CI major version. npm is 11.21.1. No runtime was downloaded and no dependency was added. A read-only inspection attempted `python` (unavailable, exit 127), then used `python3`; this did not affect repository files.

Local checks establish documentation consistency and existing stub behavior only. Live-gate tests skipped with KIX_REQUIRE_GATE=0 are skipped, never passed. Hosted CI/browser/accessibility/visual/coverage and real qualification, user acceptance and release are not claimed. Existing historical evidence is linked as context rather than reissued. No git commit/push, issue, PR, comment or ASTRA marker is created by the builder.
