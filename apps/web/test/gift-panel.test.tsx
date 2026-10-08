import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GIFT_NOT_COMPOSED, JOURNEY_RULING, GateRejectedError, ProtocolError, createStubGiftInvoker } from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  GIFT_DEFAULT_RECIPIENT,
  createGiftDesk,
  type GiftDraft,
  type GiftPanelModel,
  type GiftRow,
} from "../src/gift-desk";
import { GiftPanel } from "../src/pages/GiftPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED_COPY = [/charged/i, /paid/i, /\btoss\b/i, /portone/i, /live capture/i, /venue admitted/i, /production-ready/i];

const DRAFT: GiftDraft = {
  ticketId: "ticket-9",
  expectedVersion: "1",
  expiresAt: "600",
  recipient: GIFT_DEFAULT_RECIPIENT,
};

describe("gift panel", () => {
  it("renders the gift route with the ruling and no default expiry", () => {
    const html = renderAt("/gift");
    expect(html).toContain("Gift");
    expect(html).toContain("P02 transfer");
    expect(html).toContain(JOURNEY_RULING);
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("Gift offer is not a credit draw.");
    expect(html).toContain("No funds.");
    expect(html).toContain("The right must already be held.");
    expect(html).toContain("does not produce a giftable right");
    expect(html).toContain("caller-supplied");
    expect(html).toContain("not an authentication result");
    expect(html).toContain("desk-donor");
    expect(html).toContain(GIFT_DEFAULT_RECIPIENT);
    expect(html).toContain("Last confirmed receipt: none");
    expect(html).toContain("Unconfirmed request: none");
    expect(buttonTag(html, "Send offer_gift")).toContain("disabled");
    expect(buttonTag(html, "Send accept_gift")).toContain("disabled");
    expect(buttonTag(html, "Send cancel_gift")).toContain("disabled");
    expect(html).not.toContain('value="600"');
    expect(html).not.toContain('value="1"');
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("shows an accepted gift and blocks cancel", async () => {
    const giftId = "gift_panel_accept";
    const desk = createGiftDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: { source: "stub-shape", invoker: createStubGiftInvoker() },
    });
    await desk.send(giftId, "offer_gift", DRAFT);
    await desk.send(giftId, "accept_gift", DRAFT);
    const html = renderPanel(desk.view(giftId));
    expect(html).toContain("termsHash");
    expect(html).toContain("financialEntries");
    expect(html).toContain(">0<");
    expect(html).toContain("Last confirmed receipt: accept_gift");
    expect(html).toContain("Unconfirmed request: none");
    expect(buttonTag(html, "Send cancel_gift")).toContain("disabled");
    expect(buttonTag(html, "Send offer_gift")).toContain("disabled");
    for (const entry of GIFT_NOT_COMPOSED) {
      expect(html).toContain(entry.action);
      expect(html).toContain("Not composed");
    }
    expect(html).toContain("offerCredit");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("shows an unconfirmed offer apart from the last confirmed receipt and blocks cancel", async () => {
    const desk = createGiftDesk({
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
            throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
              requestId: "req-timeout",
              correlationId: "corr-timeout",
            });
          },
        },
      },
    });
    await desk.send("gift_panel_unknown", "offer_gift", DRAFT);
    const html = renderPanel(desk.view("gift_panel_unknown"));
    expect(html).toContain("Last confirmed receipt: none");
    expect(html).toContain("Unconfirmed request: offer_gift");
    expect(html).toContain("Not a rejection");
    expect(html).toContain("req-timeout");
    expect(buttonTag(html, "Send cancel_gift")).toContain("disabled");
    expect(buttonTag(html, "Send accept_gift")).toContain("disabled");
    expect(buttonTag(html, "Send offer_gift")).toContain("disabled");
  });

  it("shows a gate rejection and blocks the later sends", async () => {
    const desk = createGiftDesk({
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
            throw new GateRejectedError("refused", "GIFT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
          },
        },
      },
    });
    await desk.send("gift_panel_reject", "offer_gift", DRAFT);
    const html = renderPanel(desk.view("gift_panel_reject"));
    expect(html).toContain("Rejected by the gate (GIFT_EXISTS).");
    expect(buttonTag(html, "Send accept_gift")).toContain("disabled");
    expect(buttonTag(html, "Send cancel_gift")).toContain("disabled");
  });

  it("shows browser HTTP as unavailable, with sends disabled and no stub-shape label", () => {
    const html = renderPanel(unavailableModel());
    expect(html).toContain("integration-http · unavailable");
    expect(html).toContain("Gift path unavailable.");
    expect(html).toContain("does not fall back to the stub");
    expect(html).toContain("Code GATE_UNAVAILABLE.");
    expect(html).not.toContain("stub-shape");
    expect(html).not.toContain("127.0.0.1");
    expect(buttonTag(html, "Send offer_gift")).toContain("disabled");
    expect(buttonTag(html, "Send accept_gift")).toContain("disabled");
    expect(buttonTag(html, "Send cancel_gift")).toContain("disabled");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("keeps the gift UI off the gate client and off a dev-server proxy", () => {
    const giftFiles = ["src/gift-desk.ts", "src/gift-source.ts", "src/pages/GiftPanel.tsx", "src/pages/Gift.tsx"];
    const combined = giftFiles.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("StubProtocolAdapter");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("fallback");
    expect(combined).not.toContain("127.0.0.1");
    expect(combined).not.toContain("/health");
    expect(combined).not.toContain("/x-kix-contract-only");
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

function renderPanel(model: GiftPanelModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <GiftPanel model={model} />
    </MemoryRouter>,
  );
}

function buttonTag(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(match?.[0], label).toBeTruthy();
  return match?.[0] ?? "";
}

function unavailableModel(): GiftPanelModel {
  const row = (step: GiftRow["step"], label: string): GiftRow => ({
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
    rows: [row("offer_gift", "Offer gift"), row("accept_gift", "Accept gift"), row("cancel_gift", "Cancel gift")],
    lastConfirmed: "Last confirmed receipt: none",
    unconfirmed: "Unconfirmed request: none",
    pending: false,
    opened: [],
    send: () => undefined,
  };
}
