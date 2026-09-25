import { StubProtocolAdapter } from "@kix/protocol-adapter";
import { describe, expect, it } from "vitest";
import { CAMPAIGNS, getCampaign } from "./campaigns.js";
import { buildLandingShell } from "./landing.js";
import { applyVariant, updateSlot } from "./slots.js";
import { DEMO_DISCLAIMER } from "./types.js";

describe("Wave 7 campaign fixtures and landing shells", () => {
  it("keeps M02 shells path-only, noindex, and unpublished", () => {
    for (const campaign of CAMPAIGNS) {
      expect(campaign.summary.length).toBeLessThanOrEqual(160);
      expect(campaign.path).toBe(`/marketing/${campaign.campaignId}`);
      const shell = buildLandingShell(campaign, campaign.variants[0]!);
      expect(shell.surface).toBe("M02");
      expect(shell.title).toContain(campaign.title);
      expect(shell.description).toBe(campaign.summary);
      expect(shell.canonicalPath.startsWith("/marketing/")).toBe(true);
      expect(shell.canonicalPath.startsWith("http")).toBe(false);
      expect(shell.robots).toBe("noindex, nofollow");
      expect(shell.host).toBeNull();
      expect(shell.indexed).toBe(false);
    }
  });

  it("joins desk fixture keys to the default stub catalog without treating them as protocol ids", async () => {
    const rows = await new StubProtocolAdapter().listPerformances();
    const keys = new Set(rows.map((row) => row.eventId));
    expect(CAMPAIGNS.length).toBeGreaterThanOrEqual(3);
    for (const campaign of CAMPAIGNS) {
      expect(keys.has(campaign.deskFixtureKey)).toBe(true);
      expect(getCampaign(campaign.campaignId)?.title).toBe(campaign.title);
    }
    expect(getCampaign("missing")).toBeNull();
  });

  it("applies creative variants locally and keeps the disclaimer fixed", () => {
    const campaign = CAMPAIGNS[0]!;
    const originalHero = campaign.slots[0]!.body;
    const next = applyVariant(campaign.slots, campaign.variants[1]!);
    expect(campaign.slots[0]!.body).toBe(originalHero);
    expect(next.find((slot) => slot.slotId === "hero")?.body).toBe(campaign.variants[1]!.hero);
    expect(next.find((slot) => slot.slotId === "detail")?.body).toBe(campaign.variants[1]!.detail);
    expect(next.find((slot) => slot.slotId === "disclaimer")?.body).toBe(DEMO_DISCLAIMER);
    expect(next.find((slot) => slot.slotId === "disclaimer")?.editable).toBe(false);

    const blocked = updateSlot(next, "disclaimer", "erased");
    expect(blocked.find((slot) => slot.slotId === "disclaimer")?.body).toBe(DEMO_DISCLAIMER);

    const edited = updateSlot(next, "faq", "Local edit only.");
    expect(edited.find((slot) => slot.slotId === "faq")?.body).toBe("Local edit only.");
    expect(next.find((slot) => slot.slotId === "faq")?.body).not.toBe("Local edit only.");
  });
});
