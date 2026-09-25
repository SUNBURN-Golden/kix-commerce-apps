import { describe, expect, it } from "vitest";
import { TrackingStub } from "./tracking.js";

describe("Wave 7 tracking stub", () => {
  it("records session rows and never marks them transmitted", () => {
    const stub = new TrackingStub(
      () => "2026-09-25T00:00:00.000Z",
      () => "track_1",
    );
    const row = stub.record({
      name: "page_view",
      campaignId: "camp_lanterns_window",
      detail: "/marketing/camp_lanterns_window",
    });

    expect(stub.transport).toBe("none");
    expect(row).toEqual({
      recordId: "track_1",
      name: "page_view",
      campaignId: "camp_lanterns_window",
      detail: "/marketing/camp_lanterns_window",
      at: "2026-09-25T00:00:00.000Z",
      transport: "none",
      disposition: "stub-not-transmitted",
    });
    expect(JSON.stringify(row)).not.toContain("http");
    expect("send" in stub).toBe(false);
    expect("flush" in stub).toBe(false);
    expect(stub.list()).toHaveLength(1);
    stub.clear();
    expect(stub.list()).toEqual([]);
  });

  it("issues distinct ids from the default generator", () => {
    const stub = new TrackingStub(() => "2026-09-25T00:00:00.000Z");
    const first = stub.record({ name: "cta_click", campaignId: null, detail: "booking-desk" });
    const second = stub.record({ name: "variant_select", campaignId: null, detail: "quiet_listing" });
    expect(first.recordId).not.toBe(second.recordId);
    expect(first.disposition).toBe("stub-not-transmitted");
    expect(second.transport).toBe("none");
  });
});
