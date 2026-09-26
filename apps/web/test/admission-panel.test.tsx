import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdmissionDeskState, AdmissionPresentation } from "@kix/protocol-adapter";
import { AdmissionCredentialPanel } from "../src/pages/AdmissionCredentialPanel";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BANNED_COPY = [
  /gate scanned live/i,
  /venue admitted/i,
  /ticket printed for entry/i,
  /toss/i,
  /portone/i,
  /charged/i,
  /paid out/i,
  /bank settled/i,
  /live capture/i,
];

const STATES: AdmissionDeskState[] = [
  "valid",
  "invalid",
  "stale",
  "already-consumed",
  "transferred",
  "cancelled",
  "unavailable-server",
];

function presentation(deskState: AdmissionDeskState): AdmissionPresentation {
  return {
    mode: deskState === "unavailable-server" ? "http-boundary" : "mock",
    surface: "wave4.admission.P03.fsm",
    provenance: "MOCK_GATE_ONLY",
    lifecycleAuthority: deskState === "unavailable-server" ? "INTEGRATION_GATE_TRANSPORT" : "IN_MEMORY_FSM",
    rightId: "iss_evt_lanterns",
    version: 1,
    holderRole: "desk-buyer",
    phase: deskState === "valid" ? "ELIGIBLE" : null,
    fresh: deskState === "valid",
    decision: deskState === "valid" ? null : deskState,
    deskState,
    transferObserved: deskState === "transferred",
    offlineAdmission: false,
    venueCredentialReissued: false,
    admissionRoutingProduction: false,
    externalAdmission: "UNSUPPORTED",
    economicFinalityClaimed: false,
    fundsExecuted: false,
    note:
      deskState === "unavailable-server"
        ? "Loopback integration-gate probe. Not venue admission. A reachable gate is not entry. Local HTTP success is not production approval. P03 stays 설계중."
        : "Simulated mock credential on the adapter stub. Not venue admission. P03 stays 설계중. Protocol truth remains in kix-protocol. This case does not scan a gate or move funds.",
  };
}

describe("admission credential panel", () => {
  it("prints each adapter label without deciding entry", () => {
    for (const deskState of STATES) {
      const html = renderToStaticMarkup(
        <AdmissionCredentialPanel
          title="North Station Lanterns"
          presentation={presentation(deskState)}
          error={null}
          pending={false}
          commands={deskState !== "unavailable-server"}
          onCommand={() => undefined}
        />,
      );
      expect(html).toContain(deskState);
      expect(html).toContain("Not venue admission");
      expect(html).toContain("false");
      expect(html).toContain("UNSUPPORTED");
      expect(html).toContain("does not decide entry");
      for (const pattern of BANNED_COPY) {
        expect(html).not.toMatch(pattern);
      }
    }
  });

  it("keeps booking read-only and keeps consume on the credential command", () => {
    const html = renderToStaticMarkup(
      <AdmissionCredentialPanel
        title="Paper Orchestra"
        presentation={null}
        error={null}
        pending={false}
        commands={false}
      />,
    );
    expect(html).toContain("Not opened");
    expect(html).toContain("does not authorize or consume");
    expect(html).not.toContain("Consume mock credential once");

    const files = ["src/pages/Admission.tsx", "src/pages/Booking.tsx", "src/admission-desk.ts", "src/pages/AdmissionCredentialPanel.tsx"];
    const combined = files.map((file) => readFileSync(path.join(webRoot, file), "utf8")).join("\n");
    expect(combined).not.toContain("checkAdmission");
    expect(combined).not.toContain("consumeReservation");
    expect(combined).not.toContain("authorizeReservationAdmission");
    expect(combined).not.toContain("invokeLocalCall");
    expect(combined).toContain("presentAdmission");
    expect(combined).toContain("consumeAdmissionCredential");
    expect(readFileSync(path.join(webRoot, "src/pages/Booking.tsx"), "utf8")).not.toContain("consumeAdmissionCredential");
    for (const pattern of BANNED_COPY) {
      expect(combined).not.toMatch(pattern);
    }
  });
});
