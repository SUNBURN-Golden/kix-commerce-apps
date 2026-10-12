import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CONSENT_NOT_COMPOSED,
  GIFT_NOT_COMPOSED,
  GateRejectedError,
  JOURNEY_NOT_COMPOSED,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  ORGANIZER_NOT_COMPOSED,
  PINNED_PROTOCOL_DOMAIN,
  ProtocolError,
  createStubConsentInvoker,
  createStubGiftInvoker,
  createStubJourneyInvoker,
  createStubOrganizerInvoker,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import { createConsentDesk } from "../src/consent-desk";
import { createGiftDesk } from "../src/gift-desk";
import { createJourneyDesk, type JourneyDeskSnapshot } from "../src/journey-desk";
import { createOrganizerDesk, type OrganizerDeskSnapshot, type OrganizerDraft } from "../src/organizer-desk";
import { ReceiptScreen } from "../src/pages/Receipts";
import {
  buildReceiptExplorer,
  explainReceipt,
  profileFor,
  type KeptReceipt,
  type ReceiptEntry,
  type ReceiptExplorerInput,
  type ReceiptExplorerModel,
  type ReceiptSource,
} from "../src/receipt-explorer";
import type { WorkspaceRole } from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SECRETS = [
  "user@example.com",
  "sk_live_abc123xyz",
  "DE89370400440532013000",
  "4111111111111111",
  "Ada Lovelace",
  "+821012345678",
];

const UNCONFIRMED_NOTE = "Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.";

const DRAFT: OrganizerDraft = {
  seats: "A1, A2",
  invitationQuota: "1",
  inventoryId: "inv-0",
  expectedInventoryVersion: "0",
  recipient: "guest-a",
};

describe("receipt explorer", () => {
  it("links the receipt explorer and shows an empty stub page", () => {
    const home = renderAt("/");
    expect(home).toContain('href="/receipts"');
    expect(home).toContain(">Receipts<");

    const html = renderAt("/receipts");
    expect(html).toContain("No receipt on this page load.");
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("This read does not turn an unknown outcome into a confirmed receipt.");
    expect(html).toContain("A receipt from another session is not shown on this screen.");
    expect(html).toContain('data-adapter-environment="stub"');
    expect(html).toContain('data-profile="contract-only"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Receipt role"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain(">Buyer<");
    expect(html).toContain(">Organizer<");
    expect(html).toContain(">Operator<");
    expect(html.match(/role="tab"/g)?.length).toBe(3);
    expect(html).toContain('id="receipt-diagnostic"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain("Copy diagnostic");
    expect(html).not.toContain("sessionDropped");
  });

  it("shows stub journey receipts with the pinned profile and the not-bound hold", async () => {
    const eventId = "evt_receipt_ok";
    const journey = await runJourney(eventId);
    const model = build({
      screenSessionId: "sess-ok",
      evidenceSessionId: "sess-ok",
      role: "buyer",
      journey,
    });
    const html = renderModel(model, "buyer");
    const rows = journey.journeys[0]?.rows.filter((row) => row.status === "confirmed") ?? [];
    expect(rows.map((row) => row.step)).toEqual(["create_event", "prepare_trade", "accept_trade"]);
    for (const row of rows) {
      const entry = entryHtml(html, row.step);
      expect(entry).toContain('data-state="confirmed"');
      expect(entry).toContain('data-confirmed="true"');
      expect(entry).toContain('data-source="stub-shape"');
      expect(entry).toContain('data-profile="contract-only"');
      expect(entry).toContain(row.operationId ?? "");
    }
    expect(html).toContain(OPENAPI_CONTRACT_PIN.infoVersion);
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("placeHold stays not-bound. consideredAction reserve_listing.");
    expect(html).toContain("mappedOntoPrepareTrade false.");
    expect(model.exportText).toContain(OPENAPI_CONTRACT_PIN.infoVersion);
    expect(model.diagnostic.readConfirmsUnknown).toBe(false);
    expect(model.diagnostic.profile).toBe("contract-only");
    expect(model.profileVersion).toBe(OPENAPI_CONTRACT_PIN.infoVersion);
  });

  it("keeps an unknown prepare outcome unknown and fences the next step", async () => {
    const eventId = "evt_receipt_unknown";
    const shape = createStubJourneyInvoker();
    const journey = await runJourney(
      eventId,
      async (input) => {
        if (input.action === "prepare_trade") {
          throw new ProtocolError("timed out", "REQUEST_TIMEOUT", {
            requestId: "req-timeout",
            correlationId: "corr-timeout",
          });
        }
        return shape.invokeLocalCall(input);
      },
      ["create_event", "prepare_trade"],
    );
    const model = build({
      screenSessionId: "sess-unknown",
      evidenceSessionId: "sess-unknown",
      role: "buyer",
      journey,
    });
    const html = renderModel(model, "buyer");
    const prepare = entryHtml(html, "prepare_trade");
    expect(prepare).toContain('data-state="unknown"');
    expect(prepare).toContain('data-confirmed="false"');
    expect(prepare).not.toContain('data-state="rejected"');
    expect(prepare).toContain("prepare_trade");
    expect(prepare).toContain("REQUEST_TIMEOUT");
    expect(prepare).toContain("Not a rejection");
    expect(prepare).toContain("does not confirm");
    expect(prepare).toContain("does not retry");
    expect(entryHtml(html, "create_event")).toContain('data-confirmed="true"');
    expect(entryHtml(html, "accept_trade")).toContain('data-state="fenced"');
    expect(entryHtml(html, "accept_trade")).toContain('data-confirmed="false"');
    const createOp = journey.journeys[0]?.rows.find((row) => row.step === "create_event")?.operationId;
    expect(html).toContain(`Last confirmed receipt: create_event · ${createOp}`);
    expect(html).not.toContain("Last confirmed receipt: prepare_trade");

    const explained = explainReceipt(asKept(kept(model, "prepare_trade")));
    expect(explained.status).toBe("unknown");
    expect(explained.confirmed).toBe(false);
    expect(explained.meaning).toContain("prepare_trade");
    expect(explained.meaning).toContain("REQUEST_TIMEOUT");
    expect(explained.unconfirmedReason).toContain("does not confirm");
    expect(explained.nextAction).toContain("does not retry");
    expect(kept(model, "prepare_trade").codeClass).toBe("unavailable");
  });

  it("shows an in-flight row without a confirmed receipt", async () => {
    const eventId = "evt_receipt_flight";
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
      const model = build({
        screenSessionId: "sess-flight",
        evidenceSessionId: "sess-flight",
        role: "buyer",
        journey: desk.getSnapshot(),
      });
      const html = renderModel(model, "buyer");
      const row = entryHtml(html, "create_event");
      expect(row).toContain('data-state="in-flight"');
      expect(row).toContain('data-confirmed="false"');
      expect(row).toContain("One attempt. This page does not retry.");
      expect(html).not.toContain('data-confirmed="true"');
      expect(html).not.toContain(">Retry<");
    } finally {
      release?.();
      await pending;
    }
  });

  it("rejects a malformed receipt and keeps secrets out of the diagnostic", () => {
    const junk = [
      null,
      "nope",
      [],
      { action: "prepare_trade", operationId: "op-missing" },
      {
        ...candidate({ operationId: "op-extra" }),
        token: "sk_live_abc123xyz",
        email: "user@example.com",
        account: "DE89370400440532013000",
        note: SECRETS.join(" "),
      },
    ];
    const model = build({
      screenSessionId: "sess-bad",
      evidenceSessionId: "sess-bad",
      role: "buyer",
      extra: junk,
    });
    const html = renderModel(model, "buyer");
    expect(model.quarantine.length).toBe(junk.length);
    expect(model.quarantine.every((item) => item.reason === "MALFORMED")).toBe(true);
    expect(model.groups).toEqual([]);
    expect(html).toContain("MALFORMED");
    expect(html).toContain("This record was not applied. It does not confirm an outcome.");
    for (const secret of SECRETS) {
      expect(html).not.toContain(secret);
      expect(model.exportText).not.toContain(secret);
    }
  });

  it("redacts secrets on an admitted unknown receipt and does not confirm it", () => {
    const model = build({
      screenSessionId: "sess-secret",
      evidenceSessionId: "sess-secret",
      role: "buyer",
      extra: [
        candidate({
          sessionId: "sess-secret",
          status: "unknown",
          operationId: "op-secret-case",
          code: "REQUEST_TIMEOUT",
          note: SECRETS.join(" "),
          fields: [
            { key: "email", value: "user@example.com" },
            { key: "card", value: "4111111111111111" },
            { key: "account", value: "DE89370400440532013000" },
            { key: "token", value: "sk_live_abc123xyz" },
            { key: "name", value: "Ada Lovelace" },
            { key: "phone", value: "+821012345678" },
            { key: "comment", value: SECRETS.join(" ") },
            { key: "label", value: "confirmed" },
          ],
        }),
      ],
    });
    const html = renderModel(model, "buyer");
    const row = entryHtml(html, "prepare_trade");
    expect(row).toContain("op-secret-case");
    expect(row).toContain('data-state="unknown"');
    expect(row).toContain('data-confirmed="false"');
    expect(html).toContain("[redacted-note]");
    expect(html).toContain("comment [redacted]");
    expect(html).not.toContain(">email<");
    expect(model.groups[0]?.entries[0]?.fields.map((field) => field.key)).toEqual(["comment", "label"]);
    expect(model.groups[0]?.entries[0]?.omittedFieldCount).toBe(6);
    expect(model.diagnostic.readConfirmsUnknown).toBe(false);
    for (const secret of SECRETS) {
      expect(html).not.toContain(secret);
      expect(model.exportText).not.toContain(secret);
    }
  });

  it("quarantines a different actor without printing the actor", () => {
    const model = build({
      screenSessionId: "sess-actor",
      evidenceSessionId: "sess-actor",
      role: "buyer",
      extra: [
        candidate({ sessionId: "sess-actor", actor: "intruder", operationId: "op-other-actor", status: "unknown" }),
        candidate({
          sessionId: "sess-actor",
          actor: "ada@example.com",
          operationId: "op-email-actor",
          action: "accept_trade",
          status: "confirmed",
        }),
      ],
    });
    const html = renderModel(model, "buyer");
    expect(model.groups).toEqual([]);
    expect(model.quarantine.map((item) => item.reason)).toEqual(["DIFFERENT_ACTOR", "DIFFERENT_ACTOR"]);
    expect(html).toContain("DIFFERENT_ACTOR");
    expect(html).toContain("op-other-actor");
    expect(html).not.toContain("intruder");
    expect(html).not.toContain("ada@example.com");
    expect(model.exportText).not.toContain("intruder");
    expect(model.exportText).not.toContain("ada@example.com");
    expect(html).not.toContain('data-confirmed="true"');
  });

  it("quarantines a different context and a different domain", async () => {
    const journey = await runJourney("evt_ctx_buyer");
    const model = build({
      screenSessionId: "sess-ctx",
      evidenceSessionId: "sess-ctx",
      role: "buyer",
      journey,
      extra: [
        candidate({
          sessionId: "sess-ctx",
          context: "organizer",
          role: "organizer",
          actor: "desk-organizer",
          action: "close_sales",
          operationId: "op-org-ctx",
          refId: "evt_org_ctx",
        }),
        candidate({
          sessionId: "sess-ctx",
          domain: "kix:other",
          operationId: "op-domain",
          refId: "evt_domain",
        }),
      ],
    });
    const html = renderModel(model, "buyer");
    expect(model.quarantine.map((item) => item.reason)).toEqual(["DIFFERENT_CONTEXT", "DIFFERENT_CONTEXT"]);
    expect(model.groups.every((group) => group.context !== "organizer")).toBe(true);
    expect(model.groups.some((group) => group.refId === "evt_ctx_buyer")).toBe(true);
    expect(html).not.toContain("evt_org_ctx");
    expect(html).not.toContain("evt_domain");
    expect(model.exportText).not.toContain("kix:other");
  });

  it("drops another session and does not list it", async () => {
    const eventId = "evt_sess_only";
    const journey = await runJourney(eventId);
    const operationId = journey.journeys[0]?.rows.find((row) => row.step === "accept_trade")?.operationId ?? "";
    expect(operationId.length).toBeGreaterThan(0);
    const shown = build({
      screenSessionId: "sess-a",
      evidenceSessionId: "sess-a",
      role: "buyer",
      journey,
    });
    expect(shown.exportText).toContain(operationId);
    expect(shown.exportText).toContain(eventId);

    const hidden = build({
      screenSessionId: "sess-b",
      evidenceSessionId: "sess-a",
      role: "buyer",
      journey,
    });
    const html = renderModel(hidden, "buyer");
    expect(hidden.groups).toEqual([]);
    expect(hidden.sessionDropped).toBeGreaterThan(0);
    expect(html).not.toContain("sessionDropped");
    expect(html).not.toContain(operationId);
    expect(html).not.toContain(eventId);
    expect(html).not.toContain("sess-a");
    expect(hidden.exportText).not.toContain(operationId);
    expect(hidden.exportText).not.toContain(eventId);
    expect(hidden.exportText).not.toContain("sess-a");
    expect(hidden.quarantine).toEqual([]);
  });

  it("keeps one role's receipts off the other role's screen", async () => {
    const buyerEvent = "evt_role_buyer";
    const organizerEvent = "evt_role_org";
    const journey = await runJourney(buyerEvent);
    const organizer = await runOrganizer(organizerEvent);
    const buyerOp = journey.journeys[0]?.rows.find((row) => row.step === "accept_trade")?.operationId ?? "";
    const organizerOp = organizer.events[0]?.rows.find((row) => row.step === "create_event")?.operationId ?? "";
    expect(buyerOp).not.toBe(organizerOp);

    const buyer = build({
      screenSessionId: "sess-role",
      evidenceSessionId: "sess-role",
      role: "buyer",
      journey,
      organizer,
    });
    const organizerModel = build({
      screenSessionId: "sess-role",
      evidenceSessionId: "sess-role",
      role: "organizer",
      journey,
      organizer,
    });
    const operator = build({
      screenSessionId: "sess-role",
      evidenceSessionId: "sess-role",
      role: "operator",
      journey,
      organizer,
    });
    expect(buyer.exportText).toContain(buyerOp);
    expect(buyer.exportText).not.toContain(organizerOp);
    expect(buyer.quarantine.some((item) => item.operationId === organizerOp)).toBe(false);
    expect(organizerModel.exportText).toContain(organizerOp);
    expect(organizerModel.exportText).not.toContain(buyerOp);
    expect(operator.exportText).toContain(buyerOp);
    expect(operator.exportText).toContain(organizerOp);
  });

  it("keeps stale separate from unknown and from confirmed", () => {
    const stale = build({
      screenSessionId: "sess-stale",
      evidenceSessionId: "sess-stale",
      role: "buyer",
      extra: [
        candidate({
          sessionId: "sess-stale",
          status: "stale",
          code: "STALE_RESPONSE",
          operationId: "op-stale",
          action: "accept_trade",
          note: "",
        }),
      ],
    });
    const staleHtml = renderModel(stale, "buyer");
    const staleRow = entryHtml(staleHtml, "accept_trade");
    expect(staleRow).toContain('data-state="stale"');
    expect(staleRow).toContain('data-confirmed="false"');
    expect(staleRow).not.toContain(UNCONFIRMED_NOTE);
    expect(staleRow).toContain("A stale response does not update this track.");

    const unknown = build({
      screenSessionId: "sess-stale-unknown",
      evidenceSessionId: "sess-stale-unknown",
      role: "buyer",
      extra: [
        candidate({
          sessionId: "sess-stale-unknown",
          status: "unknown",
          code: "STALE_RESPONSE",
          operationId: "op-stale-unknown",
          note: UNCONFIRMED_NOTE,
        }),
      ],
    });
    const unknownRow = entryHtml(renderModel(unknown, "buyer"), "prepare_trade");
    expect(unknownRow).toContain('data-state="unknown"');
    expect(unknownRow).toContain('data-confirmed="false"');
    expect(unknownRow).toContain("stale");
    expect(unknownRow).toContain("does not confirm");
    expect(kept(unknown, "prepare_trade").status).toBe("unknown");
  });

  it("rejects a confirmed label whose profile does not match the source", () => {
    const model = build({
      screenSessionId: "sess-profile",
      evidenceSessionId: "sess-profile",
      role: "buyer",
      extra: [
        candidate({
          sessionId: "sess-profile",
          status: "confirmed",
          source: "stub-shape",
          profile: "integration-gate",
          operationId: "op-bad-profile",
        }),
      ],
    });
    const html = renderModel(model, "buyer");
    expect(model.quarantine).toEqual([{ reason: "MALFORMED", action: "prepare_trade", operationId: "op-bad-profile" }]);
    expect(model.groups).toEqual([]);
    expect(html).not.toContain('data-confirmed="true"');
    expect(html).toContain("MALFORMED");
  });

  it("builds the same export twice and does not mutate the input", async () => {
    const journey = await runJourney("evt_pure");
    const input: ReceiptExplorerInput = {
      ...emptyDesks(),
      screenSessionId: "sess-pure",
      evidenceSessionId: "sess-pure",
      role: "buyer",
      environment: "stub",
      journey,
      extra: [candidate({ sessionId: "sess-pure", operationId: "op-pure", status: "unknown", note: UNCONFIRMED_NOTE })],
    };
    const before = JSON.stringify(input);
    const first = buildReceiptExplorer(input);
    const second = buildReceiptExplorer(input);
    expect(second.exportText).toBe(first.exportText);
    expect(JSON.stringify(input)).toBe(before);
    expect(first.diagnostic.readConfirmsUnknown).toBe(false);
  });

  it("labels a gate rejection as rejected", async () => {
    const journey = await runJourney("evt_receipt_reject", async () => {
      throw new GateRejectedError("refused", "EVENT_EXISTS", { requestId: "req-r", correlationId: "corr-r" }, 422);
    }, ["create_event"]);
    const html = renderModel(
      build({
        screenSessionId: "sess-reject",
        evidenceSessionId: "sess-reject",
        role: "buyer",
        journey,
      }),
      "buyer",
    );
    const row = entryHtml(html, "create_event");
    expect(row).toContain('data-state="rejected"');
    expect(row).toContain('data-confirmed="false"');
    expect(row).toContain("EVENT_EXISTS");
    expect(row).not.toContain('data-state="unknown"');
    expect(html).not.toContain('data-confirmed="true"');
  });

  it("lists recorded not-sent actions for the operator without confirming them", () => {
    const model = build({
      screenSessionId: "sess-recorded",
      evidenceSessionId: "sess-recorded",
      role: "operator",
    });
    const html = renderModel(model, "operator");
    for (const entry of [...JOURNEY_NOT_COMPOSED, ...ORGANIZER_NOT_COMPOSED, ...GIFT_NOT_COMPOSED, ...CONSENT_NOT_COMPOSED]) {
      expect(html).toContain(entry.action);
      expect(html).toContain(entry.reason);
      expect(model.diagnostic.recordedNotSent).toContainEqual({
        sender: model.recorded.find((row) => row.action === entry.action && row.reason === entry.reason)?.sender,
        action: entry.action,
        reason: entry.reason,
      });
    }
    expect(html).toContain('data-state="not-bound"');
    expect(html).not.toContain('data-confirmed="true"');
    expect(model.placeHold.mappedOntoPrepareTrade).toBe(false);
    expect(model.placeHold.consideredAction).toBe("reserve_listing");
  });

  it("uses the integration-gate profile for an integration-http screen and does not copy path detail", () => {
    const http = build({
      screenSessionId: "sess-http",
      evidenceSessionId: "sess-http",
      role: "buyer",
      environment: "integration-http",
    });
    expect(http.profile).toBe("integration-gate");
    expect(http.profileVersion).toBe(OPENAPI_INTEGRATION_GATE_PIN.infoVersion);
    expect(http.exportText).toContain(OPENAPI_INTEGRATION_GATE_PIN.infoVersion);
    expect(renderModel(http, "buyer")).toContain('data-profile="integration-gate"');

    const unavailable = build({
      screenSessionId: "sess-path",
      evidenceSessionId: "sess-path",
      role: "buyer",
      journey: {
        ...emptyDesks().journey,
        path: {
          kind: "unavailable",
          code: "GATE_UNAVAILABLE",
          detail: "user@example.com 127.0.0.1 sk_live_abc123xyz",
        },
      },
    });
    const unavailableHtml = renderModel(unavailable, "buyer");
    const pathRow = entryHtml(unavailableHtml, "adapter_path");
    expect(pathRow).toContain('data-state="unavailable"');
    expect(pathRow).toContain('data-confirmed="false"');
    expect(pathRow).toContain("GATE_UNAVAILABLE");
    expect(unavailableHtml).not.toContain("user@example.com");
    expect(unavailableHtml).not.toContain("127.0.0.1");
    expect(unavailableHtml).not.toContain("sk_live_abc123xyz");
    expect(unavailable.paths[0]?.confirmed).toBe(false);

    const checking = build({
      screenSessionId: "sess-check",
      evidenceSessionId: "sess-check",
      role: "buyer",
      journey: { ...emptyDesks().journey, path: { kind: "checking" } },
    });
    const checkingRow = entryHtml(renderModel(checking, "buyer"), "adapter_path");
    expect(checkingRow).toContain('data-state="loading"');
    expect(checkingRow).toContain('data-confirmed="false"');
    expect(checkingRow).toContain("not a protocol command and not a receipt");
  });

  it("keeps the receipt sources off posts and keeps the receipt layout", () => {
    const files = ["src/receipt-explorer.ts", "src/pages/Receipts.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain(".send(");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("127.0.0.1");
    expect(combined).not.toContain("/health");
    expect(combined).not.toContain("/ready");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("Idempotency-Key");

    const css = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
    expect(css).toContain(".receipt-nav");
    expect(css).toContain("focus-visible");
    expect(css).toContain("44px");
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.receipt-nav[\s\S]*position:\s*sticky/);
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

function renderModel(model: ReceiptExplorerModel, role: WorkspaceRole): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ReceiptScreen model={model} role={role} onRole={() => undefined} />
    </MemoryRouter>,
  );
}

function entryHtml(html: string, action: string): string {
  const found = html.match(new RegExp(`<li class="receipt-entry"[^>]*data-action="${action}"[\\s\\S]*?</li>`));
  expect(found, action).not.toBeNull();
  return found?.[0] ?? "";
}

function kept(model: ReceiptExplorerModel, action: string): ReceiptEntry {
  const entry = model.groups.flatMap((group) => group.entries).find((item) => item.action === action);
  if (!entry) {
    throw new Error(`missing ${action}`);
  }
  return entry;
}

function asKept(entry: ReceiptEntry): KeptReceipt {
  return {
    sessionId: "sess-test",
    role: entry.role,
    actorLabel: entry.actorLabel,
    context: entry.context,
    domain: PINNED_PROTOCOL_DOMAIN,
    action: entry.action,
    operationId: entry.operationId,
    status: entry.status,
    source: entry.source,
    profile: entry.profile,
    profileVersion: entry.profileVersion,
    code: entry.code,
    codeClass: entry.codeClass,
    requestId: entry.requestId,
    correlationId: entry.correlationId,
    refId: entry.refId,
    sequence: entry.sequence,
    note: entry.note,
    fields: entry.fields,
    omittedFieldCount: entry.omittedFieldCount,
  };
}

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const source = (typeof overrides.source === "string" ? overrides.source : "stub-shape") as ReceiptSource;
  const paired = profileFor(source);
  return {
    sessionId: "sess-a",
    role: "buyer",
    actor: "desk-buyer",
    context: "journey",
    domain: PINNED_PROTOCOL_DOMAIN,
    action: "prepare_trade",
    operationId: "op-1",
    status: "confirmed",
    source,
    profile: paired.profile,
    profileVersion: paired.profileVersion,
    code: null,
    requestId: null,
    correlationId: null,
    refId: "evt_candidate",
    sequence: 1,
    note: "Confirmed stub-shape receipt. Not from the gate.",
    fields: [],
    ...overrides,
  };
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
  return createGiftDesk({
    protocol: stubProtocol(),
    source: {
      source: "stub-shape",
      invoker: createStubGiftInvoker(),
    },
  });
}

function stubConsent() {
  return createConsentDesk({
    protocol: stubProtocol(),
    source: {
      source: "stub-shape",
      invoker: createStubConsentInvoker(),
    },
  });
}

function stubOrganizer(
  invoke: (
    input: { action: string; operationId: string; actor: string; body: unknown },
    shape: ReturnType<typeof createStubOrganizerInvoker>,
  ) => Promise<unknown> = async (input, shape) => shape.invokeLocalCall(input),
) {
  const shape = createStubOrganizerInvoker();
  return createOrganizerDesk({
    protocol: stubProtocol(),
    source: {
      source: "stub-shape",
      invoker: {
        invokeLocalCall: (input) => invoke(input, shape),
      },
    },
  });
}

function emptyDesks(): Pick<ReceiptExplorerInput, "journey" | "gift" | "organizer" | "consent"> {
  return {
    journey: stubJourney(async (input, shape) => shape.invokeLocalCall(input)).getSnapshot(),
    gift: stubGift().getSnapshot(),
    organizer: stubOrganizer().getSnapshot(),
    consent: stubConsent().getSnapshot(),
  };
}

function build(
  overrides: Partial<ReceiptExplorerInput> &
    Pick<ReceiptExplorerInput, "screenSessionId" | "evidenceSessionId" | "role">,
): ReceiptExplorerModel {
  return buildReceiptExplorer({
    environment: "stub",
    ...emptyDesks(),
    ...overrides,
  });
}

async function runJourney(
  eventId: string,
  invoke: (
    input: { action: string; operationId: string; actor: string; body: unknown },
    shape: ReturnType<typeof createStubJourneyInvoker>,
  ) => Promise<unknown> = async (input, shape) => shape.invokeLocalCall(input),
  steps: Array<"create_event" | "prepare_trade" | "accept_trade"> = ["create_event", "prepare_trade", "accept_trade"],
): Promise<JourneyDeskSnapshot> {
  const desk = stubJourney(invoke);
  for (const step of steps) {
    await desk.send(eventId, step);
  }
  return desk.getSnapshot();
}

async function runOrganizer(eventId: string): Promise<OrganizerDeskSnapshot> {
  const desk = stubOrganizer();
  await desk.send(eventId, "create_event", DRAFT);
  return desk.getSnapshot();
}
