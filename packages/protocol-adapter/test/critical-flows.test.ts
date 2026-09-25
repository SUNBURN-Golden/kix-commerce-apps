import { describe, expect, it } from "vitest";
import {
  CREDIT_BOUNDARY,
  createProtocol,
  HttpProtocolAdapter,
  PROVISIONAL_HTTP_PATHS,
  ProtocolError,
  StubProtocolAdapter,
} from "../src/index.js";

describe("booking, admission, and resale stub flows", () => {
  it("books a hold and admits the issued right only once", async () => {
    const protocol = new StubProtocolAdapter();
    const [first] = await protocol.listPerformances();
    expect(first?.eventId).toBe("evt_lanterns");

    const before = first!.remainingCapacity;
    const hold = await protocol.placeHold({ eventId: first!.eventId, quantity: 2 });
    const during = await protocol.listPerformances();
    expect(during.find((item) => item.eventId === first!.eventId)?.remainingCapacity).toBe(before - 2);

    const booking = await protocol.confirmBooking(hold.holdId);
    expect(booking.payment).toBe("simulated-no-funds");
    expect(booking.rightsRef).toMatch(/^right_/);
    expect(booking.surfaces).toContain("wave2.rights");
    expect(booking.surfaces).toContain("wave4.booking.B01-B05");

    const admitted = await protocol.checkAdmission({
      rightsRef: booking.rightsRef,
      gateId: "gate-main",
    });
    expect(admitted.admitted).toBe(true);
    expect(admitted.surface).toBe("wave4.admission.P03");
    expect(admitted.zkSurface).toBe("wave2.zk_gate");
    expect(admitted.proofMode).toBe("stub");

    const second = await protocol.checkAdmission({
      rightsRef: booking.rightsRef,
      gateId: "gate-main",
    });
    expect(second.admitted).toBe(false);
  });

  it("blocks admission while a listing is open, then admits only the transferred right", async () => {
    const protocol = new StubProtocolAdapter();
    const hold = await protocol.placeHold({ eventId: "evt_paper_orchestra", quantity: 1 });
    const original = await protocol.confirmBooking(hold.holdId);
    const listing = await protocol.openResale({
      bookingId: original.bookingId,
      askLabel: "display only",
    });

    const blocked = await protocol.checkAdmission({
      rightsRef: original.rightsRef,
      gateId: "gate-side",
    });
    expect(blocked.admitted).toBe(false);

    const transferred = await protocol.acceptResale(listing.listingId);
    expect(transferred.booking.payment).toBe("simulated-no-funds");
    expect(transferred.booking.rightsRef).not.toBe(original.rightsRef);
    expect(transferred.listing.status).toBe("transferred");

    const oldRight = await protocol.checkAdmission({
      rightsRef: original.rightsRef,
      gateId: "gate-side",
    });
    expect(oldRight.admitted).toBe(false);

    const newRight = await protocol.checkAdmission({
      rightsRef: transferred.booking.rightsRef,
      gateId: "gate-side",
    });
    expect(newRight.admitted).toBe(true);
  });

  it("releases a hold back to capacity and rejects unknown rights", async () => {
    const protocol = new StubProtocolAdapter([], () => 1_700_000_000_000);
    await expect(protocol.listPerformances()).resolves.toEqual([]);

    const seeded = new StubProtocolAdapter();
    const hold = await seeded.placeHold({ eventId: "evt_last_ferry", quantity: 1 });
    await seeded.releaseHold(hold.holdId);
    const restored = await seeded.listPerformances();
    expect(restored.find((item) => item.eventId === "evt_last_ferry")?.remainingCapacity).toBe(12);
    await expect(seeded.confirmBooking(hold.holdId)).rejects.toBeInstanceOf(ProtocolError);

    const decision = await seeded.checkAdmission({ rightsRef: "right_missing", gateId: "gate-main" });
    expect(decision.admitted).toBe(false);
  });

  it("points at settlement codes without computing a split", async () => {
    const protocol = new StubProtocolAdapter();
    const preview = await protocol.settlementPreview("evt_lanterns");
    expect(preview.mode).toBe("mock");
    expect(preview.references).toEqual(["F01", "F02", "F03"]);
    expect(preview.surface).toBe("wave3.settlement.F01-F03");
    expect(preview).not.toHaveProperty("amount");
    expect(preview).not.toHaveProperty("currency");
  });

  it("keeps credit disbursement off the client", () => {
    expect(CREDIT_BOUNDARY.action).toBe("none");
    const protocol = createProtocol();
    expect("disburseCredit" in protocol).toBe(false);
    expect(protocol.describe().fundsMovement).toBe("none");
    expect(protocol.describe().liveChain).toBe(false);
  });
});

describe("http adapter binding", () => {
  it("refuses http mode without a base URL", () => {
    expect(() => createProtocol({ mode: "http" })).toThrow(ProtocolError);
  });

  it("posts booking confirmation to the provisional path and rejects real payment markers", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, method, body });
      if (url.endsWith(PROVISIONAL_HTTP_PATHS.confirmBooking)) {
        return jsonResponse({
          bookingId: "bkg_remote",
          eventId: "evt_lanterns",
          quantity: 1,
          rightsRef: "right_remote",
          status: "confirmed",
          payment: "simulated-no-funds",
        });
      }
      return jsonResponse({
        eventId: "evt_lanterns",
        mode: "mock",
        references: ["F01", "F02", "F03"],
        note: "remote mock pointer",
      });
    };

    const protocol = new HttpProtocolAdapter("https://protocol.example.test", fetchImpl);
    const booking = await protocol.confirmBooking("hold_9");
    expect(booking.rightsRef).toBe("right_remote");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: `https://protocol.example.test${PROVISIONAL_HTTP_PATHS.confirmBooking}`,
      body: JSON.stringify({ holdId: "hold_9" }),
    });
    expect(calls.some((call) => call.url.includes("credit") || call.url.includes("disburse"))).toBe(false);

    const preview = await protocol.settlementPreview("evt_lanterns");
    expect(preview.mode).toBe("mock");
    expect(preview.references).toEqual(["F01", "F02", "F03"]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
