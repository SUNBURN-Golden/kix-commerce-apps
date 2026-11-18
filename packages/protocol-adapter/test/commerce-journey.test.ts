import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { exercise, journeyFor } from "./support/commerce-journey.js";
import { commerceJourneyRead, READS } from "../src/commerce-journey-command.js";
import { FSM_COMMANDS, FSM_FALSE_FLAGS, JOURNEY_FIXTURE } from "../src/commerce-journey-fixture.js";
import { StubProtocolAdapter } from "../src/stub-adapter.js";

const vendor = new URL("../vendor/commerce-journey/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, vendor));
const fixture = JSON.parse(read("reference/booking_resale_admission/fixtures/commerce_journey_conformance_v1.json").toString());
const catalogue = JSON.parse(read("docs/contracts/openapi/fsm-command-contract.json").toString());

describe("pinned commerce fixture", () => {
  it("retains producer bytes and the selected command names, bodies and evidence paths", () => {
    const provenance = JSON.parse(read("provenance.json").toString()) as { files: Record<string, { sha256: string; gitBlob: string }> };
    for (const [path, entry] of Object.entries(provenance.files)) {
      const content = read(path.startsWith("sdk/") ? path.replace("sdk/", "../kix-sdk-0/") : path);
      expect(createHash("sha256").update(content).digest("hex"), path).toEqual(entry.sha256);
      expect(createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex"), path).toEqual(entry.gitBlob);
    }
    expect(catalogue.sourceAuthentication).toBe("FIXTURE_ONLY");
    for (const row of fixture.steps) {
      const { idempotency_key, ...body } = row.body;
      expect(idempotency_key).toEqual(expect.any(String));
      expect(Reflect.get(JOURNEY_FIXTURE, row.id), row.id).toEqual([row.action, body, row.expect_error ?? row.expect.paths]);
    }
    for (const [action, [subject]] of Object.entries(FSM_COMMANDS)) {
      expect(catalogue.commands[action].subject_field).toBe(subject);
    }
    expect(FSM_FALSE_FLAGS).toEqual(fixture.final_expect.always_false_flags);
    expect(READS).toEqual(fixture.final_expect.read_queries);
  });

  it.each(["admission", "resale", "refund"] as const)("runs the %s branch through the selected stub", async (branch) => {
    const adapter = new StubProtocolAdapter();
    await adapter.advanceReservationClock({ nowAt: "2026-11-18T00:00:00.000Z", idempotencyKey: "legacy-clock" });
    await exercise(branch, adapter);
    await expect(adapter.viewReservation("reserve-B")).rejects.toMatchObject({ code: "UNKNOWN_RESERVATION" });
  });
  it("returns NOT_BOUND without transport and fences a lost receipt", async () => {
    const port = { advanceCommerceJourney: vi.fn().mockRejectedValue(new Error("lost receipt")) };
    const journey = journeyFor("admission", port);
    for (const name of READS) expect(commerceJourneyRead(name)).toEqual({ kind: "NOT_BOUND", query: name, reason: expect.stringContaining("no read endpoint") });
    expect(port.advanceCommerceJourney).not.toHaveBeenCalled();
    const running = journey.run("reservation-clock");
    expect(await journey.run("reservation-clock")).toBeUndefined();
    expect(await running).toMatchObject({ kind: "UNKNOWN" });
    expect(await journey.run("reservation-clock")).toBeUndefined();
    expect(await journey.run("register-show")).toBeUndefined();
    expect(port.advanceCommerceJourney).toHaveBeenCalledTimes(1);
  });
});
