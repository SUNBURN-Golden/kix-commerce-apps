import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  GateRejectedError,
  ProtocolError,
  createStubOrganizerInvoker,
  localStubObservation,
  type LocalCallInput,
} from "@kix/protocol-adapter";
import { App } from "../src/App";
import {
  BATCH_NOT_ATOMIC,
  OrganizerBatchRun,
  copyOrganizerDraft,
  emptyOrganizerEditor,
  organizerChangeRow,
  pathWritesOpen,
  planOrganizerBatch,
  submissionAllowed,
  type OrganizerBatchResult,
  type OrganizerChangeRow,
  type OrganizerWorkspaceModel,
} from "../src/organizer-workspace";
import {
  createOrganizerDesk,
  type OrganizerDesk,
  type OrganizerDraft,
  type OrganizerPathStatus,
} from "../src/organizer-desk";
import { OrganizerWorkspaceScreen } from "../src/pages/OrganizerWorkspace";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DRAFT: OrganizerDraft = {
  seats: "A1, A2",
  invitationQuota: "",
  inventoryId: "inv-0",
  expectedInventoryVersion: "4",
  recipient: "guest-a",
  organizer: "",
  reservationSeconds: "",
};

describe("organizer workspace", () => {
  it("renders the workspace route with per-command copy and a disabled submit", () => {
    const html = renderAt("/organizer/workspace");
    expect(html).toContain("Organizer workspace");
    expect(html).toContain(BATCH_NOT_ATOMIC);
    expect(html).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(html).toContain("Stub-shape receipts are not from the gate.");
    expect(html).toContain("Operator is a local-call actor string, not an authentication result.");
    expect(html).toContain("No funds.");
    expect(html).toContain("No commands in the change list.");
    expect(html).toContain('href="/organizer/workspace"');
    expect(buttonTag(html, "Submit")).toContain("disabled");
    expect(html).not.toMatch(/\ball or nothing\b/i);
    expect(html).not.toMatch(/\brolled back\b/i);
    expect(html).not.toMatch(/\bundo\b/i);
    expect(html).not.toMatch(/\bcompleted\b/i);
    expect(html).not.toMatch(/\bremaining\b/i);
    expect(html).not.toMatch(/\bavailable\b/i);
    expect(html).not.toMatch(/\bsold\b/i);
    expect(html).not.toContain("permission denied");
    expect(html).not.toContain("unauthorized");
  });

  it("shows a receipt, a gate rejection, and a not-attempted command side by side", async () => {
    const eventId = "show_partial";
    const { desk, calls } = stubDesk(async (input, shape) => {
      if (input.action === "close_sales") {
        throw new GateRejectedError("refused", "FIXTURE_REJECT", { requestId: "req-p", correlationId: "corr-p" }, 422);
      }
      return shape.invokeLocalCall(input);
    });
    const rows = [
      organizerChangeRow("a", eventId, "create_event", DRAFT),
      organizerChangeRow("b", eventId, "close_sales", DRAFT),
      organizerChangeRow("c", eventId, "open_admission", DRAFT),
    ];
    const result = await runPlan(desk, rows);
    expect(result.items.map((item) => item.status)).toEqual(["RECEIPT", "REJECTED", "NOT_ATTEMPTED"]);
    expect(result.items[1]?.code).toBe("FIXTURE_REJECT");
    expect(result.summary).toBe("1 receipt, 1 rejected, 1 not attempted");
    expect(calls.map((call) => call.action)).toEqual(["create_event", "close_sales"]);
    const html = renderModel(screenModel({ results: result, planCurrent: false }));
    expect(html).toContain('data-result="RECEIPT"');
    expect(html).toContain('data-result="REJECTED"');
    expect(html).toContain('data-result="NOT_ATTEMPTED"');
    expect(html).toContain("Rejected by the gate (FIXTURE_REJECT).");
    expect(html).toContain("Not attempted.");
    expect(html).toContain(BATCH_NOT_ATOMIC);
    expect(html).not.toMatch(/\ball or nothing\b/i);
    expect(html).not.toMatch(/\brolled back\b/i);
    expect(html).not.toMatch(/\bundo\b/i);
    expect(html).not.toMatch(/\bcompleted\b/i);
    expect(html).not.toContain("permission denied");
    expect(html).not.toContain("unauthorized");
  });

  it("keeps an unknown outcome apart from a rejection and stops the list", async () => {
    const eventId = "show_unknown";
    const { desk, calls } = stubDesk(async () => {
      throw new ProtocolError("The exchange timed out.", "REQUEST_TIMEOUT", {
        requestId: "req-timeout",
        correlationId: "corr-timeout",
      });
    });
    const rows = [
      organizerChangeRow("a", eventId, "create_event", DRAFT),
      organizerChangeRow("b", eventId, "close_sales", DRAFT),
    ];
    const result = await runPlan(desk, rows);
    expect(result.items.map((item) => item.status)).toEqual(["UNKNOWN", "NOT_ATTEMPTED"]);
    expect(result.items[0]?.code).toBe("REQUEST_TIMEOUT");
    expect(calls).toHaveLength(1);
    const html = renderModel(screenModel({ results: result }));
    const unknown = resultBlock(html, "UNKNOWN");
    expect(unknown).toContain("Unconfirmed: sent, no authoritative receipt. May have applied. Not a rejection.");
    expect(unknown).not.toContain("Rejected");
    expect(unknown.toLowerCase()).not.toContain("failed");
  });

  it("reports a bad integer as not sent and does not call the invoker", async () => {
    const eventId = "show_nan";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [
      organizerChangeRow("a", eventId, "create_event", { ...DRAFT, invitationQuota: "1.5" }),
      organizerChangeRow("b", eventId, "close_sales", DRAFT),
    ];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    expect(plan.items[0]?.state).toBe("invalid");
    expect(plan.items[0]?.reason).toContain("integer");
    const result = await new OrganizerBatchRun(plan, rows, desk).submit();
    expect(result.items.map((item) => item.status)).toEqual(["NOT_SENT", "NOT_ATTEMPTED"]);
    expect(result.items[0]?.note).toContain("Not sent");
    expect(calls).toHaveLength(0);
  });

  it("does not send a stale selection after the desk row changes", async () => {
    const eventId = "show_stale";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [organizerChangeRow("a", eventId, "create_event", DRAFT)];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    expect(plan.items[0]?.state).toBe("ready");
    await desk.send(eventId, "create_event", DRAFT);
    const result = await new OrganizerBatchRun(plan, rows, desk).submit();
    expect(result.items[0]?.status).toBe("STALE");
    expect(result.items[0]?.note).toContain("Stale selection");
    expect(result.items[0]?.note).not.toContain("UNKNOWN");
    expect(result.items[0]?.note).not.toContain("NOT_BOUND");
    expect(calls).toHaveLength(1);
  });

  it("marks a halted console as a stale selection and does not send the prepared row", async () => {
    const eventId = "show_halt";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [organizerChangeRow("a", eventId, "close_sales", DRAFT)];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    await desk.send(eventId, "create_event", { ...DRAFT, invitationQuota: "1.5" });
    const result = await new OrganizerBatchRun(plan, rows, desk).submit();
    expect(result.items[0]?.status).toBe("STALE");
    expect(calls.map((call) => call.action)).toEqual([]);
  });

  it("blocks a duplicate command and sends it at most once", async () => {
    const eventId = "show_dup";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [
      organizerChangeRow("a", eventId, "create_event", DRAFT),
      organizerChangeRow("b", eventId, "create_event", DRAFT),
    ];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    expect(plan.items.map((item) => item.state)).toEqual(["ready", "blocked"]);
    expect(plan.items[1]?.reason).toContain("Duplicate");
    const result = await new OrganizerBatchRun(plan, rows, desk).submit();
    expect(result.items[0]?.status).toBe("RECEIPT");
    expect(result.items[1]?.status).toBe("FENCED");
    expect(calls).toHaveLength(1);
  });

  it("returns the same promise for a second submit and does not send again", async () => {
    const eventId = "show_latch";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [organizerChangeRow("a", eventId, "close_sales", DRAFT)];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    const run = new OrganizerBatchRun(plan, rows, desk);
    const first = run.submit();
    const second = run.submit();
    expect(second).toBe(first);
    await first;
    await Promise.all([run.submit(), run.submit()]);
    await run.submit();
    expect(calls).toHaveLength(1);
    expect(calls.some((call) => JSON.stringify(call).includes(plan.planId))).toBe(false);
  });

  it("keeps the typed inventory version after a receipt", async () => {
    const eventId = "show_version";
    const draft = copyOrganizerDraft({ ...DRAFT, expectedInventoryVersion: "4" });
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const rows = [organizerChangeRow("a", eventId, "issue_invitation", draft)];
    const result = await runPlan(desk, rows);
    expect(result.items[0]?.status).toBe("RECEIPT");
    expect(bodyOf(calls[0]).expectedInventoryVersion).toBe(4);
    expect(draft.expectedInventoryVersion).toBe("4");
    expect(bodyOf(calls[0])).not.toHaveProperty("eventId");
    const again = planOrganizerBatch(rows, desk.getSnapshot());
    expect(again.items[0]?.body?.expectedInventoryVersion).toBe(4);
  });

  it("omits a blank reservationSeconds and includes a typed one", async () => {
    const eventId = "show_seconds";
    const { desk, calls } = stubDesk(async (input, shape) => shape.invokeLocalCall(input));
    const blank = [organizerChangeRow("a", eventId, "create_event", DRAFT)];
    desk.retain(eventId);
    const blankPlan = planOrganizerBatch(blank, desk.getSnapshot());
    expect(blankPlan.items[0]?.body).not.toHaveProperty("reservationSeconds");
    expect(blankPlan.items[0]?.operationIdHint).toBe(`org:${eventId}:1:create_event`);
    await new OrganizerBatchRun(blankPlan, blank, desk).submit();
    expect(bodyOf(calls[0])).toEqual(blankPlan.items[0]?.body);
    expect(calls[0]?.operationId).toBe(blankPlan.items[0]?.operationIdHint);

    const typed = [
      organizerChangeRow("b", "show_seconds_b", "create_event", { ...DRAFT, reservationSeconds: "45" }),
    ];
    desk.retain("show_seconds_b");
    const typedPlan = planOrganizerBatch(typed, desk.getSnapshot());
    expect(typedPlan.items[0]?.body?.reservationSeconds).toBe(45);
    await new OrganizerBatchRun(typedPlan, typed, desk).submit();
    expect(bodyOf(calls[1]).reservationSeconds).toBe(45);
    for (const banned of ["capture", "settle_capture", "commit_trade", "admit"]) {
      expect(calls.some((call) => call.action === banned)).toBe(false);
    }
  });

  it("disables submit when the change list is edited after prepare", () => {
    const plan = planOrganizerBatch(
      [organizerChangeRow("a", "show_edit", "close_sales", DRAFT)],
      {
        source: "stub-shape",
        path: { kind: "available-stub-shape" },
        template: [],
        events: [
          {
            eventId: "show_edit",
            attempt: 1,
            pending: false,
            halted: false,
            issuedInventoryIds: [],
            rows: [],
            lastConfirmed: "Last confirmed receipt: none",
            unconfirmed: "Unconfirmed request: none",
          },
        ],
      },
    );
    expect(
      submissionAllowed({ rowCount: 1, plan, planCurrent: false, submitting: false, pathOpen: true }),
    ).toBe(false);
    const html = renderModel(screenModel({ plan, planCurrent: false, rows: [organizerChangeRow("a", "show_edit", "close_sales", DRAFT)] }));
    expect(html).toContain("Prepare preview again.");
    expect(buttonTag(html, "Submit")).toContain("disabled");
  });

  it("shows an in-flight submit without a receipt", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const eventId = "show_flight";
    const { desk } = stubDesk(async (input, shape) => {
      await gate;
      return shape.invokeLocalCall(input);
    });
    const rows = [organizerChangeRow("a", eventId, "create_event", DRAFT)];
    desk.retain(eventId);
    const plan = planOrganizerBatch(rows, desk.getSnapshot());
    const pending = new OrganizerBatchRun(plan, rows, desk).submit();
    try {
      expect(desk.view(eventId).rows[0]?.status).toBe("in-flight");
      const html = renderModel(
        screenModel({
          submitting: true,
          writesDisabled: true,
          canSubmit: false,
          plan,
          planCurrent: true,
          rows,
        }),
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Submitting. One attempt each.");
      expect(html).toContain("<fieldset");
      expect(html).toContain("disabled");
      expect(html).not.toContain('data-result="RECEIPT"');
    } finally {
      release();
      await pending;
    }
  });

  it("disables writes when the path is unavailable", () => {
    const path: OrganizerPathStatus = { kind: "unavailable", code: "GATE_UNAVAILABLE", detail: "closed" };
    const html = renderModel(
      screenModel({
        path,
        pathOpen: pathWritesOpen(path),
        writesDisabled: true,
        canSubmit: false,
        canPrepare: false,
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Organizer path unavailable.");
    expect(html).toContain("does not fall back to the stub");
    expect(html).toContain("Code GATE_UNAVAILABLE.");
    expect(html).toContain("<fieldset");
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(buttonTag(html, "Submit")).toContain("disabled");
  });

  it("keeps workspace sources off inventory authority and off the gate client", () => {
    const files = [
      "src/organizer-workspace.ts",
      "src/pages/OrganizerWorkspace.tsx",
      "src/organizer-desk.ts",
    ];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain("listPerformances");
    expect(combined).not.toContain("remainingCapacity");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).not.toContain("fetch(");
    expect(combined).not.toContain("settle_capture");
    expect(combined).not.toContain("permission denied");
    expect(combined).not.toContain("unauthorized");
    expect(combined).not.toContain("Idempotency-Key");
  });
});

function renderAt(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  );
}

function renderModel(model: OrganizerWorkspaceModel): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OrganizerWorkspaceScreen model={model} />
    </MemoryRouter>,
  );
}

function buttonTag(html: string, label: string): string {
  const match = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  return match?.[0] ?? "";
}

function resultBlock(html: string, status: string): string {
  const match = new RegExp(`<li[^>]*data-result="${status}"[\\s\\S]*?</li>`).exec(html);
  return match?.[0] ?? "";
}

async function runPlan(desk: OrganizerDesk, rows: OrganizerChangeRow[]): Promise<OrganizerBatchResult> {
  for (const row of rows) {
    if (row.eventId.length > 0) {
      desk.retain(row.eventId);
    }
  }
  const plan = planOrganizerBatch(rows, desk.getSnapshot());
  return new OrganizerBatchRun(plan, rows, desk).submit();
}

function screenModel(overrides: Partial<OrganizerWorkspaceModel> = {}): OrganizerWorkspaceModel {
  const editor = emptyOrganizerEditor();
  return {
    ruling: "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce",
    stubSentence: "Stub-shape receipts are not from the gate.",
    actorNote: "Operator is a local-call actor string, not an authentication result.",
    fundsNote: "No funds.",
    reloadNote: "Reload clears page-load state. A reload uses a new attempt id.",
    batchNote: BATCH_NOT_ATOMIC,
    path: { kind: "available-stub-shape" },
    pathOpen: true,
    suggestions: [],
    editor,
    rows: [],
    plan: null,
    planCurrent: false,
    submitting: false,
    results: null,
    canPrepare: false,
    canSubmit: false,
    writesDisabled: false,
    setEditor: () => undefined,
    addRow: () => undefined,
    removeRow: () => undefined,
    prepare: () => undefined,
    submit: () => undefined,
    ...overrides,
  };
}

function bodyOf(call: LocalCallInput | undefined): Record<string, unknown> {
  const body = call?.body;
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function stubDesk(
  handle: (input: LocalCallInput, shape: ReturnType<typeof createStubOrganizerInvoker>) => Promise<unknown>,
): { desk: OrganizerDesk; calls: LocalCallInput[] } {
  const calls: LocalCallInput[] = [];
  const shape = createStubOrganizerInvoker();
  const desk = createOrganizerDesk({
    protocol: {
      describe: () => ({ environment: "stub" }),
      observeTransport: async () => localStubObservation(),
    },
    source: {
      source: "stub-shape",
      invoker: {
        async invokeLocalCall(input) {
          calls.push(structuredClone(input));
          return handle(input, shape);
        },
      },
    },
  });
  return { desk, calls };
}
