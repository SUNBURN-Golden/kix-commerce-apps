import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  COMMERCE_COMMAND_BINDINGS,
  GateRejectedError,
  ProtocolError,
  createStubGiftInvoker,
  createStubJourneyInvoker,
  type Performance,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  buildBuyerWorkspace,
  loadBuyerCatalog,
  type BuyerWorkspaceInput,
} from "../src/buyer-workspace";
import { emptyDraft, createGiftDesk, type GiftDeskSnapshot } from "../src/gift-desk";
import { createJourneyDesk, type JourneyDeskSnapshot } from "../src/journey-desk";
import { BuyerScreen } from "../src/pages/Buyer";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SHOW: Performance = {
  eventId: "evt_lanterns",
  title: "Lanterns",
  venue: "Paper hall",
  startsAt: "2099-06-01T18:00:00.000Z",
  remainingCapacity: 40,
};

describe("buyer workspace", () => {
  it("identifies the stub on the core screens and links the buyer workspace", () => {
    for (const pathname of ["/", "/booking/evt_lanterns", "/admission", "/resale", "/gift", "/buyer"]) {
      const html = renderAt(pathname);
      expect(html, pathname).toContain("Environment");
      expect(html, pathname).toContain("stub");
    }
    const buyer = renderAt("/buyer");
    expect(buyer).toContain('aria-label="Buyer sections"');
    expect(buyer).toContain("Back to box office");
    expect(buyer).toContain("Stub-shape receipts are not from the gate.");
    expect(buyer).toContain("A reload clears page-load state and re-sends nothing.");
    expect(buyer).toContain('data-adapter-environment="stub"');
    expect(buyer).toContain("source stub-shape");
    expect(renderAt("/")).toContain('href="/buyer"');
    expect(renderAt("/")).toContain(">Buyer<");
  });

  it("shows a stub success receipt only after accept_trade", async () => {
    const eventId = "evt_buyer_ok";
    const { journey } = await runJourney(eventId, async (input, shape) => shape.invokeLocalCall(input));
    const html = renderModel(modelFrom({ journey, selectedEventId: eventId }));
    expect(html).toContain("Last confirmed receipt: accept_trade");
    expect(html).toContain('data-state="confirmed"');
    expect(html).toContain("source stub-shape");
    expect(html).not.toContain("ticket-1");
  });

  it("shows a gate rejection code on the rejected row", async () => {
    const eventId = "evt_buyer_reject";
    const { journey } = await runJourney(eventId, async () => {
      throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
    });
    const html = renderModel(modelFrom({ journey, selectedEventId: eventId }));
    expect(html).toContain('data-state="rejected"');
    expect(html).toContain("EVENT_EXISTS");
    expect(html).toContain("rejected");
  });

  it("keeps an unknown outcome apart from a rejection", async () => {
    const eventId = "evt_buyer_unknown";
    const shape = createStubJourneyInvoker();
    const { journey } = await runJourney(eventId, async (input) => {
      if (input.action === "prepare_trade") {
        throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
          requestId: "req-timeout",
          correlationId: "corr-timeout",
        });
      }
      return shape.invokeLocalCall(input);
    }, ["create_event", "prepare_trade"]);
    const html = renderModel(modelFrom({ journey, selectedEventId: eventId }));
    expect(html).toContain('data-state="unknown"');
    expect(html).toContain("Not a rejection");
    expect(html).toContain("REQUEST_TIMEOUT");
    expect(html).not.toContain("Rejected");
  });

  it("shows an in-flight row without confirmed text", async () => {
    const eventId = "evt_buyer_flight";
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const shape = createStubJourneyInvoker();
    const desk = stubJourney(async (input) => {
      await gate;
      return shape.invokeLocalCall(input);
    });
    const pending = desk.send(eventId, "create_event");
    try {
      const html = renderModel(modelFrom({ journey: desk.getSnapshot(), selectedEventId: eventId }));
      expect(html).toContain('data-state="in-flight"');
      expect(html.toLowerCase()).not.toContain("confirmed");
    } finally {
      release?.();
      await pending;
    }
  });

  it("shows a reservation expiry from the adapter view", () => {
    const html = renderModel(
      modelFrom({
        reservation: {
          reservationId: "rsv_evt_exp",
          eventId: "evt_exp",
          phase: "HELD",
          expired: true,
          expiresAt: "2099-01-01T00:00:00.000Z",
          issueStatus: "unissued",
          lastRejectCode: null,
        },
        selectedEventId: "evt_exp",
      }),
    );
    expect(html).toContain("2099-01-01T00:00:00.000Z");
    expect(html).toContain("expired true");
    expect(html).toContain("phase HELD");
    expect(html).toContain("issueStatus unissued");
  });

  it("links journey and gift evidence without prefilling a gift draft", async () => {
    const eventId = "evt_buyer_evidence";
    const giftId = "gift_buyer_evidence";
    const { journey } = await runJourney(eventId, async (input, shape) => shape.invokeLocalCall(input));
    const gift = stubGift();
    await gift.send(giftId, "offer_gift", {
      ticketId: "ticket-9",
      expectedVersion: "1",
      expiresAt: "600",
      recipient: "desk-recipient",
    });
    const html = renderModel(
      modelFrom({
        journey,
        gift: gift.getSnapshot(),
        selectedEventId: eventId,
      }),
    );
    expect(html).toContain("jrn:");
    expect(html).toContain("gft:");
    expect(html).toContain(eventId);
    expect(html).toContain(giftId);
    expect(html).toContain(`href="/booking/${eventId}"`);
    expect(html).toContain('href="/gift"');
    expect(html).not.toMatch(/href="\/gift\?/);
    expect(html).not.toContain("ticket-9");
    expect(html).not.toContain("ticketId=");
    expect(html).not.toContain("<input");
    expect(emptyDraft().ticketId).toBe("");
    expect(emptyDraft().expectedVersion).toBe("");
    expect(emptyDraft().expiresAt).toBe("");
  });

  it("renders a return action for blank, error, loading, and not-bound", async () => {
    expect(renderModel(modelFrom({ catalog: { kind: "empty" } }))).toContain("Pick a show");
    expect(renderModel(modelFrom({ catalog: { kind: "loading" } }))).toContain("Back to box office");
    expect(renderModel(modelFrom({ catalog: { kind: "error", message: "list failed" } }))).toContain("Read again");
    const notBound = await loadBuyerCatalog({
      async listPerformances() {
        throw new Error("listPerformances is not-bound. catalogue has no list.");
      },
    });
    expect(notBound).toEqual({
      kind: "not-bound",
      reason: COMMERCE_COMMAND_BINDINGS.listPerformances.reason,
    });
    const html = renderModel(modelFrom({ catalog: notBound }));
    expect(html).toContain("Open box office");
    expect(html).toContain(COMMERCE_COMMAND_BINDINGS.listPerformances.reason);
    expect(html).toContain('data-catalog="not-bound"');
  });

  it("reads the catalogue once on Read again and does not post", async () => {
    let reads = 0;
    const posts: string[] = [];
    const state = await loadBuyerCatalog({
      async listPerformances() {
        reads += 1;
        throw new Error("list failed once");
      },
    });
    expect(reads).toBe(1);
    expect(posts).toEqual([]);
    expect(state).toEqual({ kind: "error", message: "list failed once" });

    const calls: string[] = [];
    const desk = stubJourney(async (input) => {
      calls.push(input.action);
      throw new Error("unexpected post");
    });
    renderModel(modelFrom({ journey: desk.getSnapshot() }));
    renderAt("/buyer");
    expect(calls).toEqual([]);
  });

  it("keeps the buyer sources off posts and off banned literals", () => {
    const files = ["src/buyer-workspace.ts", "src/pages/Buyer.tsx", "src/pages/BuyerPanels.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain(".send(");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("fallback");
    expect(combined).not.toContain("127.0.0.1");
    expect(combined).not.toContain("/health");
    expect(combined).not.toContain("/ready");
    expect(combined).not.toContain("settle_capture");
    for (const token of ["capture", "commit_trade", "admit", "refund_ticket", "settle_capture"]) {
      expect(combined, token).not.toContain(token);
    }
    const holdSource = readFileSync(path.join(webRoot, "src/buyer-workspace.ts"), "utf8")
      .replaceAll("PLACE_HOLD_RECORD", "")
      .replaceAll("COMMERCE_COMMAND_BINDINGS", "");
    expect(holdSource).not.toContain("placeHold");

    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".buyer-nav");
    expect(css).toContain("focus-visible");
    expect(css).toContain("44px");
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.buyer-nav[\s\S]*position:\s*sticky/);
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/animation\s*:/);
  });
});

function renderAt(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

function renderModel(model: ReturnType<typeof buildBuyerWorkspace>): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <BuyerScreen model={model} onReadAgain={() => undefined} onSelectEvent={() => undefined} />
    </MemoryRouter>,
  );
}

function stubProtocol() {
  return {
    describe: () => ({ environment: "stub" as const }),
    observeTransport: async () => {
      throw new Error("unused");
    },
  };
}

function stubJourney(
  invoke: (
    input: { action: string; operationId: string; actor: string; body: unknown },
    shape: ReturnType<typeof createStubJourneyInvoker>,
  ) => Promise<unknown>,
) {
  const shape = createStubJourneyInvoker();
  return createJourneyDesk({
    protocol: stubProtocol(),
    source: {
      source: "stub-shape",
      invoker: {
        invokeLocalCall: (input) => invoke(input, shape),
      },
    },
  });
}

function stubGift() {
  const shape = createStubGiftInvoker();
  return createGiftDesk({
    protocol: stubProtocol(),
    source: {
      source: "stub-shape",
      invoker: shape,
    },
  });
}

async function runJourney(
  eventId: string,
  invoke: (
    input: { action: string; operationId: string; actor: string; body: unknown },
    shape: ReturnType<typeof createStubJourneyInvoker>,
  ) => Promise<unknown>,
  steps: Array<"create_event" | "prepare_trade" | "accept_trade"> = ["create_event", "prepare_trade", "accept_trade"],
): Promise<{ journey: JourneyDeskSnapshot }> {
  const desk = stubJourney(invoke);
  for (const step of steps) {
    await desk.send(eventId, step);
  }
  return { journey: desk.getSnapshot() };
}

function modelFrom(
  overrides: Partial<BuyerWorkspaceInput> & { journey?: JourneyDeskSnapshot; gift?: GiftDeskSnapshot } = {},
): ReturnType<typeof buildBuyerWorkspace> {
  const journey = overrides.journey ?? stubJourney(async (_input, shape) => shape.invokeLocalCall(_input)).getSnapshot();
  const gift = overrides.gift ?? stubGift().getSnapshot();
  return buildBuyerWorkspace({
    environment: "stub",
    catalog: { kind: "ready", performances: [SHOW] },
    selectedEventId: null,
    journey,
    gift,
    reservation: null,
    reservationError: null,
    resaleRight: null,
    resaleError: null,
    ...overrides,
  });
}
