import { readFileSync } from "node:fs";
import { Suspense } from "react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ProtocolError, RefundReturnController, createStubRefundReturn, createStubJourneyInvoker, localStubObservation } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { SCREEN_STATE_MATRIX, matrixProblems } from "../src/async-state/matrix";
import { createScreenLoader } from "../src/shell/screen-loader";
import { ScreenSlot } from "../src/shell/ScreenSlot";
import { ScreenLoading } from "../src/components/ScreenLoading";
import { ErrorPanel } from "../src/shell/RenderBoundary";
import { classifyFault } from "../src/shell/render-fault";
import { ROUTES, type RouteId } from "../src/shell/route-registry";
import * as journey from "../src/journey-desk";
import * as refund from "../src/refund-return";
import * as consent from "../src/consent-desk";
import { referenceProblems } from "./support/async-state-references";

const executed = new Set<string>();
const wrap = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
function mount(id: RouteId, ScreenApp = App) {
  const route = ROUTES.find((entry) => entry.id === id);
  return renderToStaticMarkup(<MemoryRouter initialEntries={[route?.sample ?? "/"]}><ScreenApp /></MemoryRouter>);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../src/journey-desk");
  vi.doUnmock("../src/refund-return");
  vi.doUnmock("../src/consent-desk");
});

async function inject(driver: string) {
  if (driver === "journey-unknown") {
    const shape = createStubJourneyInvoker();
    const desk = journey.createJourneyDesk({
      protocol: { describe: () => ({ environment: "stub" }), observeTransport: async () => localStubObservation() },
      source: { source: "stub-shape", invoker: { async invokeLocalCall(input) {
        if (input.action === "prepare_trade") throw new ProtocolError("Synthetic lost answer", "REQUEST_TIMEOUT", { requestId: "req-synthetic-lost" });
        return shape.invokeLocalCall(input);
      } } },
    });
    await desk.send("evt_lanterns", "create_event");
    await desk.send("evt_lanterns", "prepare_trade");
    vi.doMock("../src/journey-desk", () => ({ ...journey, useJourneyDesk: () => desk.view("evt_lanterns") }));
  }
  if (driver === "refund-stale") {
    const controller = new RefundReturnController(createStubRefundReturn({ scenario: "stale" }), { actorRef: "refund-desk", orderRef: "ord_evt-001" });
    await controller.refresh();
    const live = {
      environment: "stub" as const, scenario: "stale" as const, orderRef: "ord_evt-001", heldSupported: false, lateSupported: false,
      model: refund.buildRefundReturnModel({ controller, last: null, hasOrder: true }),
      actions: { refresh() {}, write() {}, markReturnRequired() {}, deliverHeld() {}, deliverLate() {}, switchContext() {}, newSession() {}, setScenario() {} },
    };
    vi.doMock("../src/refund-return", () => ({ ...refund, useRefundReturnDesk: () => live }));
  }
  if (driver === "consent-unknown") {
    const desk = consent.createConsentDesk({
      protocol: { describe: () => ({ environment: "stub" }), observeTransport: async () => localStubObservation() },
      source: { source: "stub-shape", invoker: { async invokeLocalCall() { throw new ProtocolError("Synthetic lost answer", "REQUEST_TIMEOUT", { requestId: "req-synthetic-lost" }); } } },
    });
    const draft = { subject: "synthetic-subject", business: "synthetic-business", channel: "synthetic-channel", purpose: "synthetic-purpose", expectedConsentVersion: "0", allowed: "true" };
    await desk.probe();
    await desk.send("evt_lanterns", "set_consent", draft);
    vi.doMock("../src/consent-desk", () => ({ ...consent, useConsentDesk: () => desk.viewWith("evt_lanterns", draft) }));
  }
  if (["journey-unknown", "refund-stale", "consent-unknown"].includes(driver)) {
    vi.resetModules();
    const app = await import("../src/App");
    await (await import("../src/screens")).screens.preload();
    return app.App;
  }
  return App;
}

describe("screen async matrix", () => {
  it("marketing fixture knowledge does not claim protocol response-loss UNKNOWN evidence", () => {
    for (const route of ["marketing-m01", "marketing-m02", "marketing-m03", "marketing-m04"]) {
      const cell = SCREEN_STATE_MATRIX.find((entry) => entry.route === route && entry.state === "unknown");
      expect(cell?.kind).not.toBe("CHECKED");
      expect(cell?.kind).not.toBe("REFERENCE");
      expect(cell?.reason).toContain("protocol response-loss UNKNOWN");
    }
  });
  for (const route of ROUTES) {
    it(`${route.id}:mount-audit`, () => {
      const markup = mount(route.id);
      expect(markup).toContain('id="desk-main"');
      expect(markup).toMatch(/<h2|data-async-state="loading"/);
      expect(markup).not.toContain("Page not found");
      const cells = SCREEN_STATE_MATRIX.filter((cell) => cell.route === route.id);
      expect(cells).toHaveLength(6);
      for (const cell of cells) {
        expect(cell.reason.length).toBeGreaterThan(30);
        expect(cell.pointer.length).toBeGreaterThan(20);
        if (cell.kind === "NOT_APPLICABLE" || cell.kind === "NOT_REACHABLE") expect(cell.owner).toBeTruthy();
      }
    });
  }
  for (const cell of SCREEN_STATE_MATRIX.filter((entry) => entry.kind === "CHECKED")) {
    it(cell.checkId, async () => {
      const route = ROUTES.find((entry) => entry.id === cell.route);
      expect(route).toBeDefined();
      const ScreenApp = await inject(cell.driver);
      if (cell.driver === "screen-import-pending") {
        const loader = createScreenLoader({ [cell.route]: () => new Promise<never>(() => {}) });
        const markup = wrap(<Suspense fallback={<ScreenLoading label={route?.label ?? ""} />}><ScreenSlot id={cell.route} read={loader.read} /></Suspense>);
        expect(markup).toContain('data-async-state="loading"');
        expect(markup).toContain('aria-busy="true"');
        expect(markup).toContain('role="status"');
        expect(markup).toContain(route?.label);
      } else if (cell.driver === "screen-render-fault") {
        const markup = wrap(<ErrorPanel fault={classifyFault(new Error("Synthetic render fault"))} scope="route" screenLabel={route?.label ?? ""} onAgain={() => {}} />);
        expect(markup).toContain('role="alert"');
        expect(markup).toContain('id="shell-error-again"');
        expect(markup).toContain(route?.label);
        expect(markup).toContain("sent nothing and cleared nothing"); // A fact of this boundary only.
      } else {
        const markup = mount(cell.route, ScreenApp);
        if (cell.driver === "journey-unknown") {
          expect(markup).toContain('data-status="unconfirmed"');
          expect(markup).toContain("Last confirmed receipt: create_event");
          expect(markup).toContain("Unconfirmed request: prepare_trade");
          expect(markup).toContain("Not a rejection");
        } else if (cell.driver === "refund-stale") {
          expect(markup).toContain('data-refund-state="stale"');
          expect(markup).toContain("Stale refund read");
        } else if (cell.driver === "consent-unknown") {
          expect(markup).toContain('data-status="unconfirmed"');
          expect(markup).toContain("Unconfirmed");
        } else if (cell.state === "empty") {
          if (cell.route === "credit" || cell.route === "admission") expect(markup).toContain("Not opened");
          else expect(markup).toMatch(/class="empty"|data-async-state="empty"/);
        } else if (cell.state === "not-bound") {
          expect(markup).toMatch(/not-bound|NOT_BOUND/);
          expect(markup).toContain(cell.route === "organizer-workspace" ? "Desk methods not bound" : "reserve_listing");
        } else throw new Error(`Unsupported driver ${cell.driver}`);
      }
      executed.add(cell.checkId);
    });
  }

  it("keeps the bind table equal to the executable screen matrix", () => {
    const doc = readFileSync(new URL("../../../docs/c-async-state-patterns-stub-apps-bind.md", import.meta.url), "utf8");
    const words = { CHECKED: "C", REFERENCE: "R", NOT_APPLICABLE: "A", NOT_REACHABLE: "N" };
    const table = doc.split("## Screen × state snapshot")[1]?.split("## Limits and deviations")[0] ?? "";
    const rows = table.split("\n").filter((line) => line.startsWith("| `"));
    expect(rows).toHaveLength(ROUTES.length);
    for (const route of ROUTES) {
      const cells = SCREEN_STATE_MATRIX.filter((cell) => cell.route === route.id);
      expect(rows).toContain(`| \`${route.id}\` | ${cells.map((cell) => words[cell.kind]).join(" | ")} |`);
    }
  });

  it("rejects missing, duplicate, unsupported and unexecuted cells and references", () => {
    const all = new Set(SCREEN_STATE_MATRIX.filter((cell) => cell.kind === "CHECKED").map((cell) => cell.checkId));
    expect(matrixProblems(SCREEN_STATE_MATRIX, all)).toEqual([]);
    expect(matrixProblems(SCREEN_STATE_MATRIX.slice(1), all).join(" ")).toMatch(/missing cell/);
    expect(matrixProblems([...SCREEN_STATE_MATRIX, SCREEN_STATE_MATRIX[0]!], all).join(" ")).toMatch(/duplicate cell/);
    expect(matrixProblems(SCREEN_STATE_MATRIX, new Set()).join(" ")).toMatch(/unexecuted check/);
    expect(matrixProblems(SCREEN_STATE_MATRIX, new Set([...all, "invented"])).join(" ")).toMatch(/unsupported executed/);
    expect(matrixProblems([{ ...SCREEN_STATE_MATRIX[0]!, checkId: "invented" }, ...SCREEN_STATE_MATRIX.slice(1)], all).join(" ")).toMatch(/unsupported check id/);
    const cell = SCREEN_STATE_MATRIX.find((entry) => entry.kind === "REFERENCE" && entry.check && "file" in entry.check)!;
    expect(referenceProblems([cell], []).join(" ")).toMatch(/did not pass/);
    if (cell.check && "file" in cell.check) {
      const result = { ...cell.check, state: "passed" };
      expect(referenceProblems([cell], [result])).toEqual([]);
      expect(referenceProblems([cell], [result, result]).join(" ")).toMatch(/ambiguous/);
      expect(referenceProblems([cell], [{ ...result, state: "skipped" }]).join(" ")).toMatch(/did not pass/);
    }
  });
  afterAll(() => expect(matrixProblems(SCREEN_STATE_MATRIX, executed)).toEqual([]));
});
