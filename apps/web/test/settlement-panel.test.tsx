import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SettlementCaseView } from "@kix/protocol-adapter";
import { SettlementPanel } from "../src/pages/SettlementPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED_COPY = [/charged/i, /paid out/i, /bank settled/i, /live capture/i, /toss/i, /portone/i, /live payment/i];

function sampleView(overrides: Partial<SettlementCaseView> = {}): SettlementCaseView {
  return {
    mode: "mock",
    surface: "wave3.settlement.F01-F03.fsm",
    references: ["F01", "F02", "F03"],
    provenance: "MOCK_SETTLEMENT_ONLY",
    lifecycleAuthority: "IN_MEMORY_FSM",
    settlementId: "stl_evt_lanterns",
    eventId: "evt_lanterns",
    phase: "AUTHORIZED",
    terminal: false,
    idempotencyKey: "desk-authorize:stl_evt_lanterns",
    failureReason: null,
    cancelReason: null,
    lastRejectCode: "ILLEGAL_TRANSITION",
    reconcileMatched: null,
    fundsExecuted: false,
    externalPayment: "UNSUPPORTED",
    providerAuthorizationExecuted: false,
    note: "Simulated mock phase on the adapter stub. Not live funds.",
    ...overrides,
  };
}

describe("settlement panel copy", () => {
  it("renders the mock phase, terminal flag, reject label, and process-local match", () => {
    const html = renderToStaticMarkup(
      <SettlementPanel
        eventTitle="North Station Lanterns"
        view={sampleView({
          phase: "FAILED",
          terminal: true,
          failureReason: "FIXTURE_DECLINE",
          lastRejectCode: "TERMINAL_IMMUTABLE",
          reconcileMatched: true,
        })}
        error="TERMINAL_IMMUTABLE: mock settlement command rejected."
        pending={false}
        onCommand={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain("Mock settlement case");
    expect(html).toContain("Not live funds");
    expect(html).toContain("설계중");
    expect(html).toContain("wave3.settlement.F01-F03.fsm");
    expect(html).toContain("MOCK_SETTLEMENT_ONLY");
    expect(html).toContain("FAILED");
    expect(html).toContain("Terminal");
    expect(html).toContain("Yes");
    expect(html).toContain("TERMINAL_IMMUTABLE");
    expect(html).toContain("FIXTURE_DECLINE");
    expect(html).toContain("Matched (process-local)");
    expect(html).toContain("Initiate mock case");
    expect(html).toContain("Simulate CAPTURED phase");
    expect(html).toContain("Reconcile process-local");
    expect(html).toContain("adapter stub only");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("renders an unopened case without a match", () => {
    const html = renderToStaticMarkup(
      <SettlementPanel
        eventTitle="Paper Orchestra"
        view={null}
        error={null}
        pending={false}
        onCommand={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("Not opened");
    expect(html).toContain("Not run");
    expect(html).toContain("Not live funds");
    expect(html).toContain("MOCK_SETTLEMENT_ONLY");
  });

  it("keeps settlement UI copy free of production-payment wording and on the adapter", () => {
    const panel = readFileSync(path.join(webRoot, "src/pages/SettlementPanel.tsx"), "utf8");
    const boxOffice = readFileSync(path.join(webRoot, "src/pages/BoxOffice.tsx"), "utf8");
    const desk = readFileSync(path.join(webRoot, "src/settlement-desk.ts"), "utf8");
    const combined = `${panel}\n${boxOffice}\n${desk}`;
    for (const pattern of BANNED_COPY) {
      expect(combined).not.toMatch(pattern);
    }
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("settlement_fsm");
    expect(combined).not.toContain("fetch(");
    for (const method of [
      "initiateSettlement",
      "authorizeSettlement",
      "captureSettlement",
      "commitSettlement",
      "failSettlement",
      "cancelSettlement",
      "reconcileSettlement",
      "viewSettlement",
    ]) {
      expect(`${boxOffice}\n${desk}`).toContain(`protocol.${method}`);
    }
  });
});
