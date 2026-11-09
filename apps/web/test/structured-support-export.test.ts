import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createConnectivityStore } from "../src/connectivity/store";
import { createConsentDesk } from "../src/consent-desk";
import { createGiftDesk } from "../src/gift-desk";
import { createJourneyDesk } from "../src/journey-desk";
import { createOrganizerDesk } from "../src/organizer-desk";
import { buildIdentity } from "../src/diagnostics/build-identity";
import { buildDiagnostics, type DiagnosticsInput } from "../src/diagnostics/model";
import type { DiagnosticOutcome } from "../src/diagnostics/outcomes";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { DiagnosticsView } from "../src/pages/Diagnostics";
import { buildReceiptExplorer } from "../src/receipt-explorer";
import { redactSupportText, sweepExport } from "../src/receipt-redaction";

// Isolate from the screen-preload setup; real build-identity tests remain unmocked.
vi.hoisted(() => vi.resetModules());
vi.mock("../src/diagnostics/build-identity", () => ({ buildIdentity: Object.freeze({
  appVersion: "0.0.1", pinDigestAlgorithm: "sha256",
  pinDigest: "1234567890123456",
  pins: Object.freeze({
    contractOnlyOpenApiSha256: "a123456789012345".repeat(4),
    integrationGateOpenApiSha256: "1234567890123456".repeat(4),
    sdk0ManifestSha256: "b123456789012345".repeat(4),
    sdk0CatalogueSha256: "0123456789abcdef".repeat(4),
  }),
}) }));

function input(extra: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return { mode: "stub", locale: "en", display: { colorScheme: "light", forcedColors: "no", reducedMotion: "no" },
    connectivity: createConnectivityStore("stub", true).getSnapshot(), journal: { kind: "empty" }, liveJournal: null,
    outcomes: [], omittedOutcomeCount: 0, ...extra };
}
function receipt(sessionId: string) {
  const protocol = { describe: () => ({ environment: "stub" as const }), observeTransport: async () => { throw Error("unused"); } };
  return buildReceiptExplorer({ screenSessionId: sessionId, evidenceSessionId: sessionId, role: "buyer", environment: "stub",
    journey: createJourneyDesk({ protocol, source: null }).getSnapshot(), gift: createGiftDesk({ protocol, source: null }).getSnapshot(),
    consent: createConsentDesk({ protocol, source: null }).getSnapshot(), organizer: createOrganizerDesk({ protocol, source: null }).getSnapshot() });
}
const escaped = 'safe\tline\nreturn\r"quote"\\path\\n literal';
const sensitive = [
  ["Bearer\t\r\nabcdefghijklmno", "[redacted-token]"],
  ["sk_live_abc123xyz", "[redacted-token]"],
  ["pk_abcdefghijk", "[redacted-token]"],
  ["rk_abcdefghijk", "[redacted-token]"],
  ["tok_abcdefghijk", "[redacted-token]"],
  ["api_abcdefghijk", "[redacted-token]"],
  ["eyJabcdefghijklmno", "[redacted-token]"],
  ["person@example.com", "[redacted-email]"],
  ["DE89370400440532013000", "[redacted-account]"],
  ["4111111111111111", "[redacted-account]"],
  ["+82101234567", "[redacted-phone]"],
  // Existing replacement order treats 12-digit phone bodies as accounts first.
  ["+821012345678", "+[redacted-account]"],
] as const;

describe("schema-aware support exports", () => {
  it("preserves decoded escaping and null in scalar text and both JSON exporters", () => {
    expect(redactSupportText(null)).toBeNull();
    expect(redactSupportText(escaped)).toBe(escaped);
    expect(sweepExport(escaped)).toBe(escaped);
    const r = receipt(escaped);
    expect(JSON.parse(r.exportText)).toEqual(r.diagnostic);
    expect(JSON.parse(r.exportText).sessionId).toBe(escaped);
    expect(r.sessionId).toBe(escaped);
    const d = buildDiagnostics(input({ display: { colorScheme: escaped, forcedColors: escaped, reducedMotion: escaped } }));
    expect(JSON.parse(d.exportText)).toEqual(d.view);
    expect(JSON.parse(d.exportText).display).toEqual({ colorScheme: escaped, forcedColors: escaped, reducedMotion: escaped });
  });
  it.each(sensitive)("suppresses %s before JSON escaping", (secret, marker) => {
    const text = `${escaped}\\"${secret}\nend`;
    const expected = `${escaped}\\"${marker}\nend`;
    expect(redactSupportText(text)).toBe(expected);
    expect(sweepExport(text)).toBe(expected);
    expect(JSON.parse(receipt(text).exportText).sessionId).toBe(expected);
    const d = buildDiagnostics(input({ display: { colorScheme: text, forcedColors: text, reducedMotion: text } }));
    expect(JSON.parse(d.exportText).display).toEqual({ colorScheme: expected, forcedColors: expected, reducedMotion: expected });
    expect(d.exportText).not.toContain(secret);
  });
  it("copies only trusted build fields unchanged, matching the rendered identity", () => {
    // This trusted synthetic digest deliberately triggers the scalar account pattern.
    expect(redactSupportText(buildIdentity.pinDigest)).toBe("[redacted-account]");
    const value = { ...input(), buildIdentity: { pinDigest: "untrusted-pin" }, pinDigest: "untrusted-pin" };
    const model = buildDiagnostics(value);
    const parsed = JSON.parse(model.exportText);
    expect(parsed.buildIdentity).toEqual(buildIdentity);
    expect(parsed.buildIdentity).toEqual(model.view.buildIdentity);
    expect(model.view.buildIdentity).not.toBe(buildIdentity);
    expect(model.view.buildIdentity.pins).not.toBe(buildIdentity.pins);
    expect(model.exportText).not.toContain("untrusted-pin");
    const html = renderToStaticMarkup(createElement(LocaleProvider, { initial: "en", children: createElement(DiagnosticsView, { model }) }));
    for (const text of [buildIdentity.appVersion, buildIdentity.pinDigest, ...Object.values(buildIdentity.pins)]) expect(html).toContain(text);
    expect(Object.keys(parsed.buildIdentity)).toEqual(["appVersion", "pinDigestAlgorithm", "pinDigest", "pins"]);
    expect(Object.keys(parsed.buildIdentity.pins)).toEqual(["contractOnlyOpenApiSha256", "integrationGateOpenApiSha256", "sdk0ManifestSha256", "sdk0CatalogueSha256"]);
  });
  it("redacts every outcome text leaf and locale without granting input digest exemptions or mutating evidence", () => {
    const secret = 'Bearer\tabcdefghijklmnop';
    const row: DiagnosticOutcome = { ordinal: 1, context: "journey", journeyRef: secret, action: secret,
      operationId: secret, requestId: secret, correlationId: secret, outcome: secret, code: secret, reason: secret };
    const value = input({ outcomes: [Object.freeze(row)], locale: secret as DiagnosticsInput["locale"] });
    Object.freeze(value.display); Object.freeze(value.outcomes); Object.freeze(value);
    const before = JSON.stringify(value);
    const model = buildDiagnostics(value);
    const parsed = JSON.parse(model.exportText);
    expect(parsed.locale).toBe("[redacted-token]");
    expect(parsed.outcomes).toEqual([{ ordinal: 1, context: "journey", journeyRef: "[redacted-token]", action: "[redacted-token]",
      operationId: "[redacted-token]", requestId: "[redacted-token]", correlationId: "[redacted-token]", outcome: "[redacted-token]", code: "[redacted-token]", reason: "[redacted-token]" }]);
    expect(JSON.stringify(value)).toBe(before);
    expect(model.view.outcomes[0]).not.toBe(row);
  });
});
