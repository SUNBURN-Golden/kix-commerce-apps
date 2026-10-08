import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  JOURNEY_RULING,
  ORGANIZER_NOT_COMPOSED,
  GateRejectedError,
  ProtocolError,
  createStubOrganizerInvoker,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  createOrganizerDesk,
  type OrganizerDraft,
  type OrganizerPanelModel,
  type OrganizerRow,
} from "../src/organizer-desk";
import { OrganizerPanel } from "../src/pages/OrganizerPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const BANNED_COPY = [/charged/i, /paid/i, /\btoss\b/i, /portone/i, /live capture/i, /venue admitted/i, /production-ready/i];

const DRAFT: OrganizerDraft = {
  seats: "A1",
  invitationQuota: "1",
  inventoryId: "inv-0",
  expectedInventoryVersion: "0",
  recipient: "guest-a",
};

describe("organizer panel", () => {
  it("renders the organizer route with the ruling and no policy numbers", () => {
    const html = renderAt("/organizer");
    expect(html).toContain("Organizer");
    expect(html).toContain("event lifecycle");
    expect(html).toContain(JOURNEY_RULING);
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("Operator is a local-call actor string, not an authentication result.");
    expect(html).toContain("No funds.");
    expect(html).toContain("Reload clears page-load state.");
    expect(html).toContain("desk-organizer");
    expect(html).toContain("not a policy");
    expect(html).toContain("Last confirmed receipt: none");
    expect(html).toContain("Unconfirmed request: none");
    expect(html).toContain("Not composed");
    expect(html).toContain("Desk methods not bound");
    for (const step of ["create_event", "close_sales", "open_admission", "complete_event", "cancel_event", "issue_invitation"]) {
      expect(buttonTag(html, `Send ${step}`)).toContain("disabled");
    }
    expect(html).not.toContain("100000");
    expect(html).not.toContain("FULL_CHAIN_UNWIND");
    expect(html).not.toContain('value="1"');
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("shows a confirmed create and the not-composed list", async () => {
    const eventId = "show_panel_ok";
    const desk = createOrganizerDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: { source: "stub-shape", invoker: createStubOrganizerInvoker() },
    });
    await desk.send(eventId, "create_event", DRAFT);
    await desk.send(eventId, "issue_invitation", DRAFT);
    const html = renderPanel(desk.view(eventId, DRAFT));
    expect(html).toContain("policyHash");
    expect(html).toContain("financialEntries");
    expect(html).toContain(">0<");
    expect(html).toContain("Last confirmed receipt: issue_invitation");
    expect(html).toContain("Unconfirmed request: none");
    expect(buttonTag(html, "Send create_event")).toContain("disabled");
    for (const entry of ORGANIZER_NOT_COMPOSED) {
      expect(html).toContain(entry.action);
      expect(html).toContain("Not composed");
    }
    expect(html).toContain("cancelSettlement");
    expect(html).toContain("checkAdmission");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("shows an unconfirmed create apart from the last confirmed receipt", async () => {
    const desk = createOrganizerDesk({
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
    await desk.send("show_panel_unknown", "create_event", DRAFT);
    const html = renderPanel(desk.view("show_panel_unknown"));
    expect(html).toContain("Last confirmed receipt: none");
    expect(html).toContain("Unconfirmed request: create_event");
    expect(html).toContain("Not a rejection");
    expect(html).toContain("req-timeout");
    expect(buttonTag(html, "Send close_sales")).toContain("disabled");
    expect(buttonTag(html, "Send create_event")).toContain("disabled");
  });

  it("shows a gate rejection and blocks the later sends", async () => {
    const desk = createOrganizerDesk({
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
    await desk.send("show_panel_reject", "create_event", DRAFT);
    const html = renderPanel(desk.view("show_panel_reject"));
    expect(html).toContain("Rejected by the gate (EVENT_EXISTS).");
    expect(buttonTag(html, "Send close_sales")).toContain("disabled");
    expect(buttonTag(html, "Send issue_invitation")).toContain("disabled");
  });

  it("shows a not-sent bad integer", async () => {
    const desk = createOrganizerDesk({
      protocol: {
        describe: () => ({ environment: "stub" }),
        observeTransport: async () => {
          throw new Error("unused");
        },
      },
      source: { source: "stub-shape", invoker: createStubOrganizerInvoker() },
    });
    await desk.send("show_panel_nan", "create_event", { ...DRAFT, invitationQuota: "1.5" });
    const html = renderPanel(desk.view("show_panel_nan"));
    expect(html).toContain("Not sent");
    expect(html).toContain("integer");
    expect(buttonTag(html, "Send close_sales")).toContain("disabled");
  });

  it("shows browser HTTP as unavailable, with sends disabled and no stub-shape label", () => {
    const html = renderPanel(unavailableModel());
    expect(html).toContain("integration-http · unavailable");
    expect(html).toContain("Organizer path unavailable.");
    expect(html).toContain("does not fall back to the stub");
    expect(html).toContain("Code GATE_UNAVAILABLE.");
    expect(html).not.toContain("stub-shape");
    expect(html).not.toContain("127.0.0.1");
    expect(buttonTag(html, "Send create_event")).toContain("disabled");
    expect(buttonTag(html, "Send issue_invitation")).toContain("disabled");
    for (const pattern of BANNED_COPY) {
      expect(html).not.toMatch(pattern);
    }
  });

  it("keeps the organizer UI off the gate client and off a dev-server proxy", () => {
    const organizerFiles = [
      "src/organizer-desk.ts",
      "src/organizer-source.ts",
      "src/pages/OrganizerPanel.tsx",
      "src/pages/Organizer.tsx",
    ];
    const combined = organizerFiles.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
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

function renderPanel(model: OrganizerPanelModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OrganizerPanel model={model} />
    </MemoryRouter>,
  );
}

function buttonTag(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  expect(match?.[0], label).toBeTruthy();
  return match?.[0] ?? "";
}

function unavailableModel(): OrganizerPanelModel {
  const row = (step: OrganizerRow["step"], label: string): OrganizerRow => ({
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
    rows: [
      row("create_event", "Create event"),
      row("close_sales", "Close sales"),
      row("open_admission", "Open admission"),
      row("complete_event", "Complete event"),
      row("cancel_event", "Cancel event"),
      row("issue_invitation", "Issue invitation"),
    ],
    lastConfirmed: "Last confirmed receipt: none",
    unconfirmed: "Unconfirmed request: none",
    pending: false,
    opened: [],
    send: () => undefined,
  };
}
