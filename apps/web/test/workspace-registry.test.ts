import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMMERCE_COMMAND_BINDINGS,
  COMMERCE_METHODS,
  CONSENT_COMPOSED,
  CONSENT_NOT_COMPOSED,
  GIFT_COMPOSED,
  GIFT_NOT_COMPOSED,
  JOURNEY_COMPOSED,
  JOURNEY_NOT_COMPOSED,
  JOURNEY_RULING,
  ORGANIZER_COMPOSED,
  ORGANIZER_NOT_COMPOSED,
  PINNED_ACTIONS,
  isPinnedAction,
} from "@kix/protocol-adapter";
import {
  BUYER_FLOW_STAGE_IDS,
  BUYER_FLOW_STAGES,
  NEVER_SENT_ACTIONS,
  OUTCOME_TRACKS,
  PLACE_HOLD_RECORD,
  UNSENT_MONETARY_POSTING_METHOD,
  SENDER_ACTIONS,
  SURFACE_BINDINGS,
  TRACK_STATE_CONTRACT,
  TRACK_STATES,
  WORKSPACE_ROLES,
  WORKSPACE_RULING,
  WORKSPACE_SURFACES,
  stageLine,
  surfaceBindingLine,
} from "../src/workspace/registry";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");

const PLANNED_TASKS = ["c-receipt-explorer", "c-accessibility-baseline"] as const;

const CLAIM = /\bworks\b|live payment|funds moved|disbursed|payment complete|admission complete|refund complete/i;

describe("workspace registry", () => {
  it("keeps reservation, payment, issuance, and admission as separate badges", () => {
    expect([...OUTCOME_TRACKS]).toEqual(["reservation", "payment", "issuance", "admission"]);
    expect(new Set(OUTCOME_TRACKS).size).toBe(4);
    expect(TRACK_STATES).not.toContain("completed");
    expect(TRACK_STATES).not.toContain("complete");
    expect(TRACK_STATES).not.toContain("done");
    expect(Object.keys(TRACK_STATE_CONTRACT)).toEqual([...TRACK_STATES]);
    expect(TRACK_STATE_CONTRACT.confirmed.copy).toContain("its own action");
    expect(TRACK_STATE_CONTRACT.unknown.copy).not.toContain("rejected");
    expect(TRACK_STATE_CONTRACT.rejected.copy).not.toContain("unknown");

    const seen = new Set<string>();
    for (const stage of BUYER_FLOW_STAGES) {
      expect(stage.tracks.length).toBeLessThanOrEqual(1);
      for (const track of stage.tracks) {
        seen.add(track);
        expect(stageLine(stage.id)).toContain(`${track} stays its own badge`);
      }
      if (stage.tracks.length === 0) {
        expect(stageLine(stage.id)).toContain("No outcome track on this stage.");
      }
      expect(stageLine(stage.id)).not.toMatch(CLAIM);
    }
    expect([...seen].sort()).toEqual([...OUTCOME_TRACKS].sort());
    expect(BUYER_FLOW_STAGE_IDS).toEqual([
      "discovery",
      "selection",
      "reservation",
      "payment",
      "issuance",
      "admission",
      "refund",
    ]);
    expect(BUYER_FLOW_STAGES.find((stage) => stage.id === "refund")?.note).toContain("COMPENSATION_UNDEFINED");
    expect(BUYER_FLOW_STAGES.find((stage) => stage.id === "refund")?.note).toContain("refund_ticket");
  });

  it("pins desk methods to the locked not-bound bindings", () => {
    const seen: string[] = [];
    for (const surface of WORKSPACE_SURFACES) {
      for (const method of surface.deskMethods) {
        seen.push(method);
        const binding = COMMERCE_COMMAND_BINDINGS[method as keyof typeof COMMERCE_COMMAND_BINDINGS];
        expect(binding, method).toBeDefined();
        expect(binding.status).toBe("not-bound");
      }
      expect(surfaceBindingLine(surface.id)).toContain(`Binding ${surface.binding}`);
      expect(surfaceBindingLine(surface.id)).not.toMatch(CLAIM);
      if (surface.binding !== "published-bound") {
        expect(surfaceBindingLine(surface.id)).toMatch(/not-bound|stub-only|no-published-command|planned/);
      }
      if (surface.deskMethods.length > 0) {
        expect(surfaceBindingLine(surface.id)).toContain("Desk methods stay not-bound");
      }
    }
    expect([...seen].sort()).toEqual([...COMMERCE_METHODS].sort());
    expect(new Set(seen).size).toBe(seen.length);

    expect(PLACE_HOLD_RECORD.method).toBe("placeHold");
    expect(PLACE_HOLD_RECORD.status).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.status);
    expect(PLACE_HOLD_RECORD.consideredAction).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction);
    expect(PLACE_HOLD_RECORD.consideredAction).toBe("reserve_listing");
    expect(PLACE_HOLD_RECORD.reason).toBe(COMMERCE_COMMAND_BINDINGS.placeHold.reason);
    expect(PLACE_HOLD_RECORD.mappedOntoPrepareTrade).toBe(false);
  });

  it("pins sender actions and keeps never-sent actions off every sender", () => {
    expect([...SENDER_ACTIONS.BookingJourney]).toEqual([...JOURNEY_COMPOSED]);
    expect([...SENDER_ACTIONS.OrganizerConsole]).toEqual([...ORGANIZER_COMPOSED]);
    expect([...SENDER_ACTIONS.GiftTransfer]).toEqual([...GIFT_COMPOSED]);
    expect([...SENDER_ACTIONS.ConsentBind]).toEqual([...CONSENT_COMPOSED]);

    const sent = new Set<string>();
    for (const surface of WORKSPACE_SURFACES) {
      if (surface.sender === null) {
        expect(surface.actions).toEqual([]);
        continue;
      }
      expect([...surface.actions]).toEqual([...SENDER_ACTIONS[surface.sender]]);
      for (const action of surface.actions) {
        sent.add(action);
        expect(isPinnedAction(action)).toBe(true);
      }
    }

    expect(UNSENT_MONETARY_POSTING_METHOD).toBe("settlementPreview");
    const monetaryPosting = COMMERCE_COMMAND_BINDINGS[UNSENT_MONETARY_POSTING_METHOD].consideredAction;
    expect(monetaryPosting).toBe("settle_capture");
    const neverSent = [...NEVER_SENT_ACTIONS, monetaryPosting];
    expect(new Set(neverSent).size).toBe(neverSent.length);
    for (const action of neverSent) {
      expect(isPinnedAction(action)).toBe(true);
      expect(sent.has(action)).toBe(false);
    }
    expect([...NEVER_SENT_ACTIONS]).toEqual(["capture", "commit_trade", "admit", "refund_ticket"]);
    expect(neverSent).toEqual(["capture", "commit_trade", "admit", "refund_ticket", "settle_capture"]);

    const journeyNotSent = JOURNEY_NOT_COMPOSED.map((entry) => entry.action);
    expect(journeyNotSent).toEqual(["capture", "settle_capture", "commit_trade", "open_admission", "admit"]);
    expect(journeyNotSent.filter((action) => sent.has(action))).toEqual(["open_admission"]);
    expect(ORGANIZER_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "admit",
    ]);
    expect(GIFT_NOT_COMPOSED.map((entry) => entry.action)).toEqual([
      "capture",
      "settle_capture",
      "commit_trade",
      "issue_invitation",
    ]);
    expect(CONSENT_NOT_COMPOSED.map((entry) => entry.action)).toEqual(["capture", "settle_capture"]);
    for (const entry of [
      ...JOURNEY_NOT_COMPOSED,
      ...ORGANIZER_NOT_COMPOSED,
      ...GIFT_NOT_COMPOSED,
      ...CONSENT_NOT_COMPOSED,
    ]) {
      expect(entry.reason).toContain(JOURNEY_RULING);
    }
    expect(journeyNotSent).not.toContain("refund_ticket");

    const journeyMap = readFileSync(path.join(repoRoot, "docs/wave-6a-journey-map-apps-bind.md"), "utf8");
    expect(journeyMap).toContain("does not map `refund_ticket`");
  });

  it("marks planned routes unimplemented and leaves the registry free of calls", () => {
    expect([...WORKSPACE_ROLES]).toEqual(["buyer", "organizer", "operator"]);
    expect(WORKSPACE_RULING).toBe(JOURNEY_RULING);
    expect([...SURFACE_BINDINGS]).toEqual([
      "published-bound",
      "not-bound",
      "stub-only",
      "no-published-command",
      "planned",
    ]);

    const planned = WORKSPACE_SURFACES.filter((surface) => surface.binding === "planned");
    expect(planned.map((surface) => surface.taskId)).toEqual([...PLANNED_TASKS]);
    for (const surface of planned) {
      expect(surface.implemented).toBe(false);
      expect(surface.pageControl).toBe(false);
      expect(surface.sender).toBeNull();
      expect(surface.actions).toEqual([]);
      expect(surface.deskMethods).toEqual([]);
      expect(surface.provenanceNote).toContain("NOT_IMPLEMENTED");
      expect(surfaceBindingLine(surface.id)).toContain("NOT_IMPLEMENTED");
    }

    const marketing = WORKSPACE_SURFACES.filter((surface) => surface.id.startsWith("marketing-m0"));
    for (const surface of marketing) {
      if (surface.id === "marketing-m05") {
        expect(surface.binding).toBe("published-bound");
        expect([...surface.actions]).toEqual(["set_consent", "authorize_marketing"]);
      } else {
        expect(surface.binding).toBe("no-published-command");
        expect(surface.actions).toEqual([]);
        for (const action of PINNED_ACTIONS) {
          expect(surface.provenanceNote).not.toContain(action);
        }
      }
    }

    const buyer = WORKSPACE_SURFACES.find((surface) => surface.id === "buyer-workspace");
    expect(buyer?.route).toBe("/buyer");
    expect(buyer?.binding).toBe("stub-only");
    expect(buyer?.sender).toBeNull();
    expect(buyer?.actions).toEqual([]);
    expect(buyer?.deskMethods).toEqual([]);
    expect(buyer?.implemented).toBe(true);
    expect(buyer?.pageControl).toBe(true);
    expect(buyer?.taskId).toBe("c-buyer-workspace");
    expect(buyer?.provenanceNote).not.toMatch(CLAIM);
    expect(surfaceBindingLine("buyer-workspace")).toContain("Current route.");
    expect(surfaceBindingLine("buyer-workspace")).toContain("stub-only");

    const discovery = WORKSPACE_SURFACES.find((surface) => surface.id === "discovery-prototype");
    expect(discovery?.route).toBe("/discovery");
    expect(discovery?.binding).toBe("stub-only");
    expect(discovery?.sender).toBeNull();
    expect(discovery?.actions).toEqual([]);
    expect(discovery?.deskMethods).toEqual([]);
    expect(discovery?.implemented).toBe(true);
    expect(discovery?.pageControl).toBe(true);
    expect(discovery?.taskId).toBe("c-discovery-prototype");
    expect(discovery?.provenanceNote).not.toMatch(CLAIM);
    expect(surfaceBindingLine("discovery-prototype")).toContain("Current route.");
    expect(surfaceBindingLine("discovery-prototype")).toContain("stub-only");
    expect(BUYER_FLOW_STAGES.find((stage) => stage.id === "discovery")?.surfaces).toEqual([
      "box-office-catalog",
      "discovery-prototype",
    ]);

    const organizer = WORKSPACE_SURFACES.find((surface) => surface.id === "organizer-workspace");
    expect(organizer?.route).toBe("/organizer/workspace");
    expect(organizer?.binding).toBe("published-bound");
    expect(organizer?.sender).toBe("OrganizerConsole");
    expect([...(organizer?.actions ?? [])]).toEqual([...SENDER_ACTIONS.OrganizerConsole]);
    expect(organizer?.deskMethods).toEqual([]);
    expect(organizer?.implemented).toBe(true);
    expect(organizer?.pageControl).toBe(true);
    expect(organizer?.taskId).toBe("c-organizer-workspace");
    expect(organizer?.provenanceNote).not.toMatch(CLAIM);
    expect(surfaceBindingLine("organizer-workspace")).toContain("Current route.");
    expect(surfaceBindingLine("organizer-workspace")).toContain("published-bound");

    const source = readFileSync(path.join(webRoot, "src/workspace/registry.ts"), "utf8");
    expect(source).not.toContain("planned-buyer-workspace");
    expect(source).not.toContain("planned-discovery");
    expect(source).not.toContain("planned-organizer-workspace");
    expect(source).not.toContain("invokeLocalCall");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("@kix/protocol-adapter");
    expect(source).not.toContain("settle_capture");

    const design = readFileSync(path.join(repoRoot, "docs/workspace-design-apps-bind.md"), "utf8");
    expect(design).toContain(WORKSPACE_RULING);
    expect(design).toContain("reservation");
    expect(design).toContain("payment");
    expect(design).toContain("issuance");
    expect(design).toContain("admission");
    expect(design).toContain("COMPENSATION_UNDEFINED");
    expect(design).toContain("NOT_IMPLEMENTED");
    expect(design).toContain("apps/web/test/journey-panel.test.tsx");
  });
});
