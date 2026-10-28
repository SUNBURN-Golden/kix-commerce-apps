import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  JOURNEY_IDENTITY_DESK_ACTOR,
  JourneyIdentityController,
  SESSION_JOURNAL_KEY,
  SessionRecoveryController,
  createNotBoundJourneyIdentity,
  createStubJourneyIdentity,
  identitySender,
  openSessionJournal,
  type JourneyIdentityScenario,
  type SessionStorePort,
} from "@kix/protocol-adapter";
import { fixturesForScreen } from "../../../packages/protocol-adapter/src/contract-fixtures";
import { App } from "../src/App";
import { LOCAL_SURFACE_EVIDENCE } from "../src/handoff/packet";
import { SessionRecoveryPanel } from "../src/pages/SessionRecoveryPanels";
import {
  SESSION_STANDING_NOTICE,
  buildSessionModel,
  sessionFenceLine,
  sessionRunResultLine,
  type SessionLastAction,
  type SessionScenario,
} from "../src/session-recovery";
import { WORKSPACE_RULING, WORKSPACE_SURFACES } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED = /[$₩]|KRW|USD|still open|in stock/i;

class MemoryStore implements SessionStorePort {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

async function load(store: SessionStorePort | null, scenario: JourneyIdentityScenario = "attach-lost", budget?: { maxRecords: number; maxBytes: number }) {
  const port = createStubJourneyIdentity({ scenario });
  const identity = new JourneyIdentityController(port, { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
  await identity.refresh();
  const journal = openSessionJournal(store, budget ? { budget } : {});
  const recovery = new SessionRecoveryController(journal, identitySender(identity, { bound: true }), identity.state().context.key);
  return { port, identity, journal, recovery };
}

function live(args: {
  environment?: "stub" | "integration-http";
  scenario?: SessionScenario;
  recovery: SessionRecoveryController | null;
  identity: JourneyIdentityController | null;
  last?: SessionLastAction | null;
}) {
  const environment = args.environment ?? "stub";
  const scenario = args.scenario ?? "clean";
  return {
    environment,
    scenario,
    model: buildSessionModel({ environment, recovery: args.recovery, identity: args.identity, last: args.last ?? null }),
    heldSupported: scenario === "held-response",
    actions: { attach() {}, refresh() {}, deliverHeld() {}, setScenario() {}, reloadPage() {} },
  };
}

function markup(value: ReturnType<typeof live>) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SessionRecoveryPanel live={value} />
    </MemoryRouter>,
  );
}

describe("session recovery screen", () => {
  it("shows an empty journal with the standing notice and the retention note", async () => {
    const { recovery, identity } = await load(new MemoryStore(), "clean");
    const html = markup(live({ recovery, identity }));
    expect(html).toContain('data-session-state="empty"');
    expect(html).toContain('data-source="synthetic-session"');
    expect(html).toContain("No writes recorded in this tab session");
    expect(html).toContain("Retention is UNDETERMINED");
    expect(html).toContain("not an exactly-once guarantee");
    expect(html).toContain("A cleared tab looks the same as a new session");
    expect(html).not.toMatch(BANNED);
  });

  it("shows a settled write as ready, and the standing notice stays", async () => {
    const store = new MemoryStore();
    const { recovery, identity } = await load(store, "clean");
    const result = await recovery.run("obs-0001");
    const html = markup(live({ recovery, identity, last: { seq: 1, kind: "step", result } }));
    expect(html).toContain('data-session-state="ready"');
    expect(html).toContain('data-kind="this-load"');
    expect(html).toContain("It is not an exactly-once guarantee and it does not survive losing");
    expect(SESSION_STANDING_NOTICE).toContain("exactly-once");
    expect(html).not.toMatch(BANNED);
  });

  it("renders a fenced activation as one focusable refusal status without sending or changing the journal", async () => {
    const store = new MemoryStore();
    const { recovery, identity } = await load(store, "attach-lost");
    expect((await recovery.run("obs-0001")).kind).toBe("UNKNOWN");
    const before = [...store.data.entries()];
    const result = await recovery.run("obs-0001");
    expect(result.kind).toBe("FENCED");
    expect([...store.data.entries()]).toEqual(before);
    const value = live({ recovery, identity, scenario: "attach-lost", last: { seq: 2, kind: "step", result } });
    expect(value.model.lastNeedsFocus).toBe(true);
    const html = markup(value);
    expect(html).toContain('id="session-status" tabindex="-1" aria-live="polite" aria-busy="false"');
    expect(html.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(html).toContain('<p data-field="last">Attach not sent. An earlier write on this subject has an unknown result');
    expect(html).toContain("Sent 1 in this load. Blocked before sending 1.");
    const off = html.match(/id="session-attach-obs-0001"[^>]*>/)?.[0] ?? "";
    expect(off).toContain('aria-disabled="true"');
    expect(off).toContain('aria-describedby="session-attach-obs-0001-reason"');
    expect(html).toContain('<span id="session-attach-obs-0001-reason" class="muted">An earlier write');
    expect(html).not.toContain("onDomainRefused");
    expect(html.match(/data-kind="unknown"/g)).toHaveLength(1);
    expect(html).not.toMatch(BANNED);
  });

  it("shows an in-flight write as in progress", async () => {
    const { recovery, identity, port } = await load(new MemoryStore(), "held-response");
    const pending = recovery.run("obs-0001");
    await Promise.resolve();
    const html = markup(live({ recovery, identity, scenario: "held-response" }));
    expect(html).toContain('data-session-state="in-progress"');
    expect(html).toContain('data-kind="in-flight"');
    expect(html).toContain("Deliver held response");
    port.deliverHeld();
    await pending;
  });

  it("shows a recovered write as UNKNOWN, keeps its attach off with a reason, and leaves another subject usable", async () => {
    const store = new MemoryStore();
    const first = await load(store);
    await first.recovery.run("obs-0001");
    const second = await load(store);
    const html = markup(live({ recovery: second.recovery, identity: second.identity, scenario: "attach-lost" }));
    expect(html).toContain('data-session-state="recovered"');
    expect(html).toContain('data-kind="unknown"');
    expect(html).toContain("1 unresolved write came back as UNKNOWN");
    const off = html.match(/id="session-attach-obs-0001"[^>]*>/)?.[0] ?? "";
    expect(off).toContain('aria-disabled="true"');
    expect(off).toContain("aria-describedby");
    expect(html).toContain("This page does not send it again");
    expect(html).toContain("It was sent in an earlier page load");
    const on = html.match(/id="session-attach-obs-0002"[^>]*>/)?.[0] ?? "";
    expect(on).not.toContain("aria-disabled");
    expect(html).not.toMatch(BANNED);
  });

  it("shows an intent that was in flight at reload as recovered UNKNOWN that is not sent again", async () => {
    const store = new MemoryStore();
    const first = await load(store, "held-response");
    const pending = first.recovery.run("obs-0001");
    await Promise.resolve();
    const second = await load(store, "held-response");
    const html = markup(live({ recovery: second.recovery, identity: second.identity, scenario: "held-response" }));
    expect(html).toContain('data-session-state="recovered"');
    expect(html).toContain('data-kind="recovered-unknown"');
    expect(html).toContain("Its answer never reached the journal");
    expect(html).toContain("Recovered as unknown 1");
    expect(html).toContain("Sent 0 in this load");
    expect(html).not.toMatch(BANNED);
    first.port.deliverHeld();
    await pending;
  });

  it("shows a confirmed record from an earlier load as history", async () => {
    const store = new MemoryStore();
    const first = await load(store, "clean");
    await first.recovery.run("obs-0001");
    const second = await load(store, "clean");
    const html = markup(live({ recovery: second.recovery, identity: second.identity }));
    expect(html).toContain('data-kind="history"');
    expect(html).toContain("It is not a current fact and it lifts no fence");
    expect(html).toContain("This is page load 2");
  });

  it("shows each evidence-lost cause and holds every attach", async () => {
    const cases: [string, (store: MemoryStore) => void, string][] = [
      ["corrupt", (store) => store.data.set(SESSION_JOURNAL_KEY, "{broken"), "was damaged"],
      ["unsupported", (store) => store.data.set(SESSION_JOURNAL_KEY, JSON.stringify({ v: 9 })), "a version this page does not read"],
    ];
    for (const [name, damage, phrase] of cases) {
      const store = new MemoryStore();
      damage(store);
      const { recovery, identity } = await load(store, "clean");
      const html = markup(live({ recovery, identity }));
      expect(html, name).toContain('data-session-state="evidence-lost"');
      expect(html, name).toContain("SESSION_EVIDENCE_LOST");
      expect(html, name).toContain(phrase);
      expect(html.match(/aria-disabled="true"/g)?.length, name).toBe(2);
      expect(html, name).toContain("no new reference is issued");
      expect(html, name).not.toMatch(BANNED);
    }
    const store = new MemoryStore();
    const { recovery, identity } = await load(store, "clean");
    store.data.clear();
    recovery.verify();
    const html = markup(live({ recovery, identity }));
    expect(html).toContain("LOST_DURING_SESSION");
    expect(html).toContain("cannot be told from a new tab");
  });

  it("shows an unusable store and a full journal", async () => {
    const none = await load(null, "clean");
    const noneHtml = markup(live({ recovery: none.recovery, identity: none.identity }));
    expect(noneHtml).toContain('data-session-state="unavailable"');
    expect(noneHtml).toContain("session storage is not usable");
    const full = await load(new MemoryStore(), "clean", { maxRecords: 1, maxBytes: 12288 });
    await full.recovery.run("obs-0001");
    const fullHtml = markup(live({ recovery: full.recovery, identity: full.identity }));
    expect(fullHtml).toContain('data-session-state="full"');
    expect(fullHtml).toContain("Nothing is evicted");
  });

  it("stays not-bound on integration-http and records nothing", async () => {
    const store = new MemoryStore();
    const identity = new JourneyIdentityController(createNotBoundJourneyIdentity(), { actorRef: JOURNEY_IDENTITY_DESK_ACTOR, role: "operator" });
    await identity.refresh();
    const recovery = new SessionRecoveryController(openSessionJournal(store), identitySender(identity, { bound: false }), identity.state().context.key);
    const html = markup(live({ environment: "integration-http", recovery, identity }));
    expect(html).toContain('data-session-state="not-bound"');
    expect(html).toContain('data-source="none"');
    expect(html).toContain("No subject to attach");
  });

  it("says every fence and result with a word", () => {
    for (const fence of [
      { reason: "not-bound" },
      { reason: "evidence-lost", cause: "CORRUPT" },
      { reason: "unavailable", cause: "NO_STORE" },
      { reason: "unresolved", intentRef: "intent-1", scope: "s", code: "RESPONSE_LOST", recovered: false, earlierLoad: false, inFlight: false },
      { reason: "unresolved", intentRef: "intent-1", scope: "s", code: "TAB_RESUMED", recovered: true, earlierLoad: true, inFlight: false },
      { reason: "unresolved", intentRef: "intent-1", scope: "s", code: null, recovered: false, earlierLoad: false, inFlight: true },
      { reason: "underlying", identity: { reason: "no-snapshot" } },
    ] as const) {
      expect(sessionFenceLine(fence)).toBeTruthy();
    }
    expect(sessionRunResultLine({ kind: "NOT_SENT", reason: "write-refused", detail: "The browser refused the write-ahead record. Nothing was sent." })).toContain("Nothing was sent");
  });

  it("mounts at /session and falls to the unavailable state where the page has no session storage", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/session"]}>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Session recovery (synthetic)"');
    expect(html).toContain('data-session-state="unavailable"');
  });
});

describe("session recovery registration and boundaries", () => {
  it("registers one stub-only surface and one evidence row, and no fixture passes", () => {
    const surface = WORKSPACE_SURFACES.find((row) => row.id === "session-recovery");
    expect(surface).toMatchObject({ route: "/session", binding: "stub-only", taskId: "c-session-recovery-stub", role: "operator" });
    expect(surface?.deskMethods).toEqual([]);
    const evidence = LOCAL_SURFACE_EVIDENCE.find((row) => row.id === "c-session-recovery-stub");
    expect(evidence?.doc).toBe("docs/c-session-recovery-stub-apps-bind.md");
    const rows = fixturesForScreen("session-recovery");
    expect(rows.map((row) => row.id).sort()).toEqual([
      "session-recovery.evidence-lost",
      "session-recovery.history-not-current",
      "session-recovery.journal-full",
      "session-recovery.recovered-unknown",
      "session-recovery.settle-write-failed",
      "session-recovery.write-refused",
    ]);
    for (const row of rows) {
      expect(row.ownsPass).toBe(false);
      expect(row.klass).not.toBe("SUCCESS");
      expect(row.substituteStub).toBe(false);
    }
  });

  it("keeps the new screen free of sends, clocks, timers, and other storage; only one file names session storage", () => {
    const files = ["src/session-recovery.ts", "src/pages/SessionRecovery.tsx", "src/pages/SessionRecoveryPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    for (const token of [
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "sendBeacon",
      "invokeLocalCall",
      ".send(",
      "/health",
      "127.0.0.1",
      "capture",
      "settle_capture",
      "commit_trade",
      "fallback",
      "Date.now(",
      "new Date(",
      "Math.random(",
      "setInterval",
      "setTimeout",
      "placeHold",
      "Idempotency-Key",
      "retry",
      "contract-fixtures",
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
    ]) {
      expect(combined, token).not.toContain(token);
    }
    const store = readFileSync(path.join(webRoot, "src/session-store.ts"), "utf8");
    expect(store).toContain("sessionStorage");
    expect(store).not.toContain("localStorage");
    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });

  it("names the surface, the ruling, and the limits in the docs and the README", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-session-recovery-stub-apps-bind.md"), "utf8");
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
    const closeout = readFileSync(path.join(repoRoot, "docs/c-local-workspace-closeout-apps-bind.md"), "utf8");
    expect(doc).toContain(WORKSPACE_RULING);
    expect(doc).toContain("session-recovery");
    expect(doc).toContain("SESSION_EVIDENCE_LOST");
    expect(doc).toContain("UNDETERMINED");
    expect(doc).toContain("contract_change=NO");
    expect(doc).toContain("Browser pass");
    expect(readme).toContain("docs/c-session-recovery-stub-apps-bind.md");
    expect(readme).toContain("/session");
    expect(closeout).toContain("docs/c-session-recovery-stub-apps-bind.md");
  });
});
