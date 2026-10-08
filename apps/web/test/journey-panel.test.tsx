import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { JOURNEY_NOT_COMPOSED, JOURNEY_RULING, GateRejectedError, ProtocolError, createStubJourneyInvoker } from "@kix/protocol-adapter";
import { App } from "../src/App";
import { createJourneyDesk, type JourneyPanelModel, type JourneyRow } from "../src/journey-desk";
import { JourneyPanel } from "../src/pages/JourneyPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED_COPY = [/charged/i, /paid/i, /\btoss\b/i, /portone/i, /live capture/i, /venue admitted/i, /production-ready/i];

describe("journey panel", () => {
  it("renders the stub journey on the booking route and the box office", () => {
    const booking = renderAt("/booking/evt_lanterns");
    expect(booking).toContain("Loading the performance.");
    expect(booking).toContain("wave6a.journey · stub-shape receipts");
    expect(booking).toContain(JOURNEY_RULING);
    expect(booking).toContain("Stub-shape receipts are not from the gate.");
    expect(booking).toContain("placeHold stays not-bound (reserve_listing).");
    expect(booking).toContain("Mock: no funds, no admission.");
    expect(booking).toContain("Send create_event");
    expect(booking).toContain("Last confirmed receipt: none");
    expect(booking).toContain("Unconfirmed request: none");
    expect(buttonTag(booking, "Send create_event")).not.toContain("disabled");
    expect(buttonTag(booking, "Send prepare_trade")).toContain("disabled");

    const box = renderAt("/");
    expect(box).toContain("Catalogue journey");
    expect(box).toContain("wave6a.journey · stub-shape receipts");
    expect(box).toContain("Writes happen on the booking screen.");
    expect(box).toContain("No journey opened on this page load.");
    expect(box).toContain("create_event · planned");
    expect(box).not.toContain("Send create_event");
    for (const pattern of BANNED_COPY) {
      expect(booking).not.toMatch(pattern);
      expect(box).not.toMatch(pattern);
    }
  });

  it("shows confirmed receipts without a price and lists the steps that stay uncomposed", async () => {
    const eventId = "evt_panel_receipts";
    const shape = createStubJourneyInvoker();
    const desk = createJourneyDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: {
        source: "stub-shape",
        invoker: shape,
      },
    });
    await desk.send(eventId, "create_event");
    await desk.send(eventId, "prepare_trade");
    await desk.send(eventId, "accept_trade");
    const html = renderPanel("booking", desk.view(eventId));
    expect(html).toContain("eventId");
    expect(html).toContain("policyHash");
    expect(html).toContain("inventoryIds");
    expect(html).toContain("reservationSeconds");
    expect(html).toContain("termsHash");
    expect(html).toContain("accepted");
    expect(html).toContain("true");
    expect(html).not.toContain("100000");
    expect(html).not.toContain("primaryFeeBps");
    expect(html).not.toContain("FULL_CHAIN");
    expect(html).toContain("Last confirmed receipt: accept_trade");
    expect(html).toContain("Unconfirmed request: none");
    for (const entry of JOURNEY_NOT_COMPOSED) {
      expect(html).toContain(entry.action);
      expect(html).toContain("Not composed");
    }
    expect(html).toContain("reserve_listing");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("shows an unconfirmed request apart from the last confirmed receipt", async () => {
    const shape = createStubJourneyInvoker();
    const desk = createJourneyDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: {
        source: "stub-shape",
        invoker: {
          async invokeLocalCall(input) {
            if (input.action === "prepare_trade") {
              throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
                requestId: "req-timeout",
                correlationId: "corr-timeout",
              });
            }
            return shape.invokeLocalCall(input);
          },
        },
      },
    });
    await desk.send("evt_panel_unknown", "create_event");
    await desk.send("evt_panel_unknown", "prepare_trade");
    const html = renderPanel("booking", desk.view("evt_panel_unknown"));
    expect(html).toContain("Last confirmed receipt: create_event");
    expect(html).toContain("Unconfirmed request: prepare_trade");
    expect(html).toContain("Unconfirmed");
    expect(html).toContain("Not a rejection");
    expect(html).not.toContain("Rejected");
    expect(html).toContain("req-timeout");
    expect(buttonTag(html, "Send accept_trade")).toContain("disabled");
    expect(buttonTag(html, "Send prepare_trade")).toContain("disabled");
  });

  it("shows a gate rejection and blocks the later sends", async () => {
    const desk = createJourneyDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: {
        source: "stub-shape",
        invoker: {
          async invokeLocalCall() {
            throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
          },
        },
      },
    });
    await desk.send("evt_panel_reject", "create_event");
    const html = renderPanel("booking", desk.view("evt_panel_reject"));
    expect(html).toContain("Rejected by the gate (EVENT_EXISTS).");
    expect(html).toContain("EVENT_EXISTS");
    expect(buttonTag(html, "Send prepare_trade")).toContain("disabled");
    expect(buttonTag(html, "Send accept_trade")).toContain("disabled");
  });

  it("shows browser HTTP as unavailable, with sends disabled and no stub-shape label", () => {
    const html = renderPanel("booking", unavailableModel());
    expect(html).toContain("integration-http · unavailable");
    expect(html).toContain("Journey path unavailable.");
    expect(html).toContain("does not fall back to the stub");
    expect(html).toContain("Code GATE_UNAVAILABLE.");
    expect(html).not.toContain("stub-shape");
    expect(html).not.toContain("127.0.0.1");
    expect(buttonTag(html, "Send create_event")).toContain("disabled");
    expect(buttonTag(html, "Send prepare_trade")).toContain("disabled");
    expect(buttonTag(html, "Send accept_trade")).toContain("disabled");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("keeps the journey UI off the gate client and off a dev-server proxy", () => {
    const journeyFiles = ["src/journey-desk.ts", "src/journey-source.ts", "src/pages/JourneyPanel.tsx"];
    const combined = journeyFiles.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("StubProtocolAdapter");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("fallback");
    expect(combined).not.toContain("127.0.0.1");
    expect(readFileSync(path.join(webRoot, "src/pages/Booking.tsx"), "utf8").match(/<JourneyPanel /g)).toHaveLength(3);
    expect(readFileSync(path.join(webRoot, "src/pages/BoxOffice.tsx"), "utf8")).toContain("<JourneyPanel ");
    const vite = readFileSync(path.join(webRoot, "vite.config.ts"), "utf8");
    expect(vite).not.toContain("proxy");
    expect(readFileSync(path.join(repoRoot, "packages/protocol-adapter/src/commerce-bindings.ts"), "utf8")).toContain(
      "placeHold({ eventId, quantity })",
    );
  });
});

function renderAt(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

function renderPanel(variant: "booking" | "box-office", model: JourneyPanelModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <JourneyPanel variant={variant} model={model} />
    </MemoryRouter>,
  );
}

function buttonTag(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(match?.[0], label).toBeTruthy();
  return match?.[0] ?? "";
}

function unavailableModel(): JourneyPanelModel {
  const row = (step: JourneyRow["step"], label: string): JourneyRow => ({
    step,
    label,
    status: "unavailable",
    operationId: null,
    actor: null,
    code: null,
    requestId: null,
    correlationId: null,
    receipt: null,
    note: "Unavailable. No write is sent.",
    canSend: false,
  });
  return {
    source: "integration-gate",
    path: {
      kind: "unavailable",
      code: "GATE_UNAVAILABLE",
      detail: "hidden http://127.0.0.1:8765 must stay off the page",
    },
    rows: [row("create_event", "Create event"), row("prepare_trade", "Prepare trade"), row("accept_trade", "Accept trade")],
    lastConfirmed: "Last confirmed receipt: none",
    unconfirmed: "Unconfirmed request: none",
    pending: false,
    opened: [],
    send: () => undefined,
  };
}
