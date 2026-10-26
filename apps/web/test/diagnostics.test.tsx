import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SESSION_JOURNAL_KEY, SESSION_JOURNAL_QUARANTINE_KEY, openSessionJournal, peekSessionJournal, createProtocol, type SessionControllerState } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { createConnectivityStore } from "../src/connectivity/store";
import { buildDiagnostics, journalView, type DiagnosticsInput } from "../src/diagnostics/model";
import { createOutcomeRecord, type OutcomeFlow } from "../src/diagnostics/outcomes";
import { DiagnosticsView } from "../src/pages/Diagnostics";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { ROLE_STARTS } from "../src/onboarding/roles";

function input(extra: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return { mode: "stub", locale: "en", display: { colorScheme: "not-read", forcedColors: "not-read", reducedMotion: "not-read" },
    connectivity: createConnectivityStore("stub", true).getSnapshot(), journal: { kind: "empty" }, liveJournal: null, outcomes: [], omittedOutcomeCount: 0, ...extra };
}
function html(value = input(), locale: "en" | "ko" = "en") {
  return renderToStaticMarkup(<LocaleProvider initial={locale}><DiagnosticsView model={buildDiagnostics(value)} /></LocaleProvider>);
}
function flow(id: string, status = "confirmed", actor = "alice"): OutcomeFlow[] {
  return [{ refId: id, rows: [{ step: "create_event", status, actor, operationId: `op:${id}`, requestId: `req:${actor}`, correlationId: `corr:${actor}`, code: null, note: "unsafe reason" }] }];
}
function live(status: SessionControllerState["status"]): SessionControllerState {
  return { status, load: 1, records: [], counters: { sent: 0, fenced: 0, notSent: 0, recoveredUnknown: 0 }, observations: [],
    budget: { maxRecords: 32, maxBytes: 12288, usedRecords: 0, usedBytes: 0 }, retention: "UNDETERMINED", exactlyOnceClaimed: false, durableAcrossStorageLoss: false };
}
describe("diagnostics read-only view", () => {
  it("renders empty page-load outcomes", () => {
    expect(html()).toContain("No outcome on this page load.");
    expect(html()).toContain("not-read");
    const preferences = input({ display: { colorScheme: "light", forcedColors: "no", reducedMotion: "yes" } });
    expect(html(preferences, "ko")).toContain("아니요"); expect(html(preferences, "ko")).toContain("예");
    expect(buildDiagnostics(preferences).view.display).toEqual(preferences.display);
    expect(html()).toContain("Not evidence, approval or production readiness.");
  });
  it("renders UNKNOWN without resolving it", () => {
    const record = createOutcomeRecord(); record.observe("journey", [], flow("lost", "unconfirmed"));
    const value = input(record.getSnapshot());
    expect(html(value)).toContain('data-outcome="UNKNOWN"');
    expect(buildDiagnostics(value).view.outcomes[0]?.outcome).toBe("UNKNOWN");
  });
  it("renders stub, loopback-only HTTP classification, offline, journal loss, quota, and both locales", () => {
    const connection = createConnectivityStore("integration-http", false);
    const fetchImpl = vi.fn();
    const configured = createProtocol({ mode: "integration-http", baseUrl: "http://127.0.0.1:8765", fetchImpl });
    const value = input({ mode: configured.describe().environment, connectivity: connection.getSnapshot(), journal: { kind: "evidence-lost", cause: "CORRUPT" } });
    for (const locale of ["ko", "en"] as const) {
      const rendered = html(value, locale);
      expect(rendered).toContain("loopback"); expect(rendered).toContain("offline"); expect(rendered).toContain("EVIDENCE_LOST"); expect(rendered).toContain("CORRUPT");
      expect(rendered).not.toMatch(/http:\/\/|127\.0\.0\.1|:8765|currency|\$|\bKRW\b|\bUSD\b|in stock|still open|capture/i);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(html(input({ journal: { kind: "ready", full: true, maxRecords: 32, usedRecords: 32, usedBytes: 8000, maxBytes: 12288 } }))).toContain("QUOTA");
    expect(html(input({ liveJournal: live({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" }) }))).toContain("LOST_DURING_SESSION");
  });
  it("registers the real page and intentionally excludes it from role onboarding", () => {
    const markup = renderToStaticMarkup(<MemoryRouter initialEntries={["/diagnostics"]}><App /></MemoryRouter>);
    expect(markup).toContain('data-page="diagnostics"'); expect(markup).toContain('href="/help"');
    expect(ROLE_STARTS.some((row) => row.path === "/diagnostics")).toBe(false);
  });
  it("redacts actors, tokens, emails, accounts, phones and unsafe words in copied JSON and rendered locales with exact keys", () => {
    const hostile = ["alice", "Bearer abcdefghijklmnop", "tok_abcdefghijklmnop", "person@example.com", "DE89370400440532013000", "1234567890123456", "+821012345678", "currency", "$", "in stock", "still open", "capture"];
    const record = createOutcomeRecord();
    for (const item of hostile) {
      const rows = flow(`alice:prefix_${item}_suffix`); rows[0]!.rows[0]!.note = item;
      rows[0]!.rows[0]!.code = item;
      record.observe("gift", [], rows);
      const seeded = input(record.getSnapshot());
      for (const text of [buildDiagnostics(seeded).exportText, html(seeded, "ko"), html(seeded, "en")]) {
        expect(text).not.toContain(item); expect(text).not.toContain("alice");
      }
    }
    const value = input(record.getSnapshot());
    const model = buildDiagnostics(value); const json = JSON.parse(model.exportText);
    for (const text of [model.exportText, html(value, "ko"), html(value, "en")]) for (const item of hostile) expect(text).not.toContain(item);
    const keys = (obj: object, expected: string[]) => expect(Object.keys(obj).sort()).toEqual(expected.sort());
    keys(json, ["kind", "buildIdentity", "mode", "origin", "locale", "display", "connectivity", "sessionJournal", "outcomes", "outcomeLimit", "omittedOutcomeCount", "sent", "notEvidence", "notApproval", "productionReadiness"]);
    keys(json.buildIdentity, ["appVersion", "pinDigestAlgorithm", "pinDigest", "pins"]);
    keys(json.buildIdentity.pins, ["contractOnlyOpenApiSha256", "integrationGateOpenApiSha256", "sdk0ManifestSha256", "sdk0CatalogueSha256"]);
    keys(json.display, ["colorScheme", "forcedColors", "reducedMotion"]); keys(json.connectivity, ["state", "writesBlocked", "epoch"]);
    keys(json.sessionJournal, ["state", "cause", "usedRecords", "maxRecords"]);
    for (const row of json.outcomes) keys(row, ["ordinal", "context", "journeyRef", "action", "operationId", "requestId", "correlationId", "outcome", "code", "reason"]);
  });
  it("has no send, probe, storage mutation or runtime URL configuration", () => {
    for (const file of ["pages/Diagnostics.tsx", "diagnostics/model.ts", "diagnostics/outcomes.ts", "diagnostics/display-prefs.ts", "diagnostics/build-identity.ts"]) {
      const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/fetch\s*\(|\.probe\s*\(|invokeLocalCall|placeHold|Date\.now\(|Math\.random\(|127\.0\.0\.1|\/health|localStorage|sessionStorage|baseUrl|VITE_KIX_PROTOCOL_API_BASE|http:\/\/|setItem\(|removeItem\(/);
    }
  });
});
describe("bounded chronological outcomes", () => {
  it("redacts actors across retained desks, including actors learned after an earlier outcome", () => {
    const record = createOutcomeRecord();
    record.observe("organizer", [], flow("event:alice", "confirmed", "operator"));
    record.observe("gift", [], flow("gift", "confirmed", "alice"));
    expect(JSON.stringify(record.getSnapshot())).not.toContain("alice");
    record.observe("consent", [], flow("later:alice", "confirmed", "marketing-adapter"));
    expect(JSON.stringify(record.getSnapshot())).not.toContain("alice");
    expect(record.getSnapshot().outcomes.map((row) => row.ordinal)).toEqual([1, 2, 3]);
    const long = flow("alice".repeat(200)); record.observe("journey", [], long);
    expect(JSON.stringify(record.getSnapshot())).not.toContain("alice");
  });
  it("orders interleaved desks, preserves repeated attempts, truncates and resets on a fresh page record", () => {
    const record = createOutcomeRecord(); const listener = vi.fn(); const unsub = record.subscribe(listener);
    record.observe("journey", [], flow("first")); record.observe("gift", [], flow("second"));
    record.observe("journey", flow("first"), flow("first")); // unchanged publish
    record.observe("consent", [], flow("third", "rejected")); record.observe("organizer", [], flow("fourth"));
    expect(record.getSnapshot().outcomes.map((row) => row.context)).toEqual(["journey", "gift", "consent", "organizer"]);
    record.observe("journey", flow("first", "in-flight"), flow("first"));
    expect(record.getSnapshot().outcomes).toHaveLength(5);
    for (let i = 0; i < 20; i++) record.observe("gift", [], flow(`repeat:${i}`));
    expect(record.getSnapshot().outcomes.map((row) => row.ordinal)).toEqual([16,17,18,19,20,21,22,23,24,25]);
    expect(record.getSnapshot().omittedOutcomeCount).toBe(15); expect(listener).toHaveBeenCalledTimes(25); unsub();
    expect(createOutcomeRecord().getSnapshot()).toEqual({ outcomes: [], omittedOutcomeCount: 0 });
  });
});
describe("read-only session journal observation", () => {
  function store() {
    const data = new Map<string, string>();
    return { data, getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }), removeItem: vi.fn((key: string) => { data.delete(key); }) };
  }
  it("peeks empty, ready, full, unsupported, corrupt and quarantined journals using getItem only", () => {
    const s = store(); expect(peekSessionJournal(s)).toEqual({ kind: "empty" });
    const journal = openSessionJournal(s); journal.begin({ intentRef: "intent:1", scope: "scope:1", contextTag: "0123456789abcdef" });
    s.setItem.mockClear(); s.removeItem.mockClear();
    expect(peekSessionJournal(s)).toMatchObject({ kind: "ready", usedRecords: 1, full: false });
    expect(peekSessionJournal(s, { maxRecords: 1, maxBytes: 12288 })).toMatchObject({ kind: "ready", full: true });
    s.data.set(SESSION_JOURNAL_KEY, '{"v":99}'); expect(peekSessionJournal(s)).toEqual({ kind: "evidence-lost", cause: "UNSUPPORTED_VERSION" });
    s.data.set(SESSION_JOURNAL_KEY, "damaged"); expect(peekSessionJournal(s)).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
    for (const marker of ["bad marker", "{}", '{"v":1,"cause":"CORRUPT"}']) {
      s.data.set(SESSION_JOURNAL_QUARANTINE_KEY, marker); expect(peekSessionJournal(s)).toEqual({ kind: "evidence-lost", cause: "CORRUPT" });
    }
    s.data.set(SESSION_JOURNAL_QUARANTINE_KEY, '{"v":1,"cause":"LOST_DURING_SESSION"}');
    expect(peekSessionJournal(s)).toEqual({ kind: "evidence-lost", cause: "LOST_DURING_SESSION" });
    expect(s.setItem).not.toHaveBeenCalled(); expect(s.removeItem).not.toHaveBeenCalled();
    expect(peekSessionJournal(null)).toEqual({ kind: "unavailable", cause: "NO_STORE" });
    expect(peekSessionJournal({ getItem() { throw Error("blocked"); } })).toEqual({ kind: "unavailable", cause: "NO_STORE" });
  });
  it("reconciles deletion and damage after leaving the session desk, preserves loss, and never calls WRITE_REFUSED quota", () => {
    const s = store(); openSessionJournal(s); s.setItem.mockClear();
    const cached = live({ kind: "ready" });
    expect(journalView(peekSessionJournal(s), cached).state).toBe("OK");
    s.data.delete(SESSION_JOURNAL_KEY);
    expect(journalView(peekSessionJournal(s), cached)).toMatchObject({ state: "EVIDENCE_LOST", cause: "LOST_DURING_SESSION" });
    s.data.set(SESSION_JOURNAL_KEY, "bad"); expect(journalView(peekSessionJournal(s), cached)).toMatchObject({ state: "EVIDENCE_LOST", cause: "CORRUPT" });
    expect(journalView({ kind: "empty" }, live({ kind: "unavailable", cause: "WRITE_REFUSED" }))).toMatchObject({ state: "UNAVAILABLE", cause: "WRITE_REFUSED" });
    expect(journalView({ kind: "empty" }, live({ kind: "evidence-lost", cause: "CORRUPT" }))).toMatchObject({ state: "EVIDENCE_LOST", cause: "CORRUPT" });
    expect(s.setItem).not.toHaveBeenCalled(); expect(s.removeItem).not.toHaveBeenCalled();
  });
});
