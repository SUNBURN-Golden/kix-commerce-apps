import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { TransportObservation } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { preferFresh, transportBannerText } from "../src/transport-status";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function observation(overrides: Partial<TransportObservation>): TransportObservation {
  return {
    environment: "integration-http",
    state: "unavailable",
    productionReadiness: false,
    productionConformance: false,
    protocolTruth: false,
    publicDeploy: false,
    durable: false,
    localFileJournal: null,
    fallbackToStub: false,
    retry: false,
    requestId: "req-1",
    correlationId: "corr-1",
    code: "GATE_UNAVAILABLE",
    detail: "Loopback gate is unavailable (GATE_UNAVAILABLE). The client does not retry and does not fall back to the stub.",
    ...overrides,
  };
}

describe("transport status", () => {
  it("keeps the stub desk off integration HTTP", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain("Environment");
    expect(html).toContain("stub");
    expect(html).toContain("Integration HTTP is not selected");
    expect(html).toContain("does not fall back to the stub");
    expect(html).toContain("Public production deployment is not selected");
    expect(html).toContain("No live chain");
    expect(html).not.toMatch(/production-ready/i);
    expect(html).not.toContain("127.0.0.1");
  });

  it("prints unavailable and degraded copy without a production claim", () => {
    const unavailable = transportBannerText("integration-http", observation({}));
    const degraded = transportBannerText(
      "integration-http",
      observation({
        state: "degraded",
        code: "NOT_READY",
        detail: "Loopback gate is degraded (NOT_READY). The client does not retry and does not fall back to the stub.",
      }),
    );
    const checking = transportBannerText("integration-http", null);
    expect(unavailable.state).toBe("unavailable");
    expect(unavailable.text).toContain("does not fall back to the stub");
    expect(unavailable.text).toContain("Request req-1");
    expect(degraded.state).toBe("degraded");
    expect(degraded.text).toContain("NOT_READY");
    expect(checking.text).toContain("Not production readiness");
    expect(unavailable.text).not.toMatch(/production-ready/i);
    expect(degraded.text).not.toMatch(/production-ready/i);
  });

  it("drops a stale probe response", () => {
    const newer = { generation: 2, observation: observation({ code: "NOT_READY", state: "degraded" }) };
    const older = { generation: 1, observation: observation({ code: "GATE_UNAVAILABLE", state: "unavailable" }) };
    expect(preferFresh(newer, older)).toBe(newer);
    expect(preferFresh(older, newer).observation.code).toBe("NOT_READY");
  });

  it("does not catch protocol startup into the stub", () => {
    const source = readFileSync(path.join(webRoot, "src/protocol.ts"), "utf8");
    expect(source).toContain("createProtocol");
    expect(source).not.toContain("StubProtocolAdapter");
    expect(source).not.toContain("catch");
    expect(source).not.toContain("fallback");
  });
});
