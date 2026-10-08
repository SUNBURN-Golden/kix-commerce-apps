import { describe, expect, it } from "vitest";
import { MARKETING_FORBIDDEN_CALLS } from "../src/marketing/contracts";
import {
  COUPON_FIXTURES,
  MARKETING_BOUNDARY,
  MarketingStubDesk,
  MarketingStubError,
  OWN_REFERRAL_CODE,
  PARTNER_REFERRAL_CODES,
  presaleWindowFor,
} from "../src/marketing/desk";
import {
  MARKETING_SURFACES,
  ORIGINAL_32_LABEL_RANK,
  ORIGINAL_32_MARKETING_STATUS,
  marketingChromeLabel,
} from "../src/marketing/labels";

function clock() {
  let tick = 0;
  return () => {
    tick += 1;
    return `2026-09-26T00:00:${String(tick).padStart(2, "0")}.000Z`;
  };
}

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysOf(child, found);
    }
  }
  return found;
}

describe("marketing labels", () => {
  it("keeps each charter label at the ORIGINAL_32 source and does not promote M05", () => {
    expect(MARKETING_SURFACES.map((item) => item.id)).toEqual(["M01", "M02", "M03", "M04", "M05"]);
    expect(MARKETING_SURFACES.map((item) => item.titleKo)).toEqual([
      "팬 자격 / 멤버십",
      "선예매",
      "쿠폰 / 프로모션",
      "추천 / 리워드",
      "CRM / 데이터 활용",
    ]);
    expect(MARKETING_SURFACES.map((item) => item.status)).toEqual([
      "설계중",
      "설계중",
      "설계중",
      "설계중",
      "미착수",
    ]);
    for (const item of MARKETING_SURFACES) {
      const source = ORIGINAL_32_MARKETING_STATUS[item.id];
      expect(item.status).toBe(source);
      expect(ORIGINAL_32_LABEL_RANK.indexOf(item.status)).toBeLessThanOrEqual(
        ORIGINAL_32_LABEL_RANK.indexOf(source),
      );
    }
    expect(ORIGINAL_32_MARKETING_STATUS.M05).toBe("미착수");
    expect(marketingChromeLabel("/marketing/m05")).toEqual({
      title: "KIX Marketing · M05 · 미착수",
      eyebrow: "M05 · 미착수",
    });
    expect(marketingChromeLabel("/marketing/m01")?.eyebrow).toBe("M01 · 설계중");
    expect(marketingChromeLabel("/marketing")).toEqual({
      title: "KIX Marketing",
      eyebrow: "Marketing desk",
    });
    expect(marketingChromeLabel("/")).toBeNull();
    expect(MARKETING_BOUNDARY.status).toBe("설계중");
    expect(MARKETING_BOUNDARY.protocolBinding).toBe("none");
    expect(MARKETING_BOUNDARY.openApiBound).toBe(false);
    expect(MARKETING_BOUNDARY.fundsMovement).toBe("none");
    expect(MARKETING_BOUNDARY.creditDisbursement).toBe("none");
    expect(MARKETING_BOUNDARY.outboundSend).toBe("none");
    expect(MARKETING_BOUNDARY.liveChain).toBe(false);
  });
});

describe("marketing stub desk", () => {
  it("issues a local fan card and closes the window again when the card is cleared", () => {
    const desk = new MarketingStubDesk(clock());
    expect(presaleWindowFor("guest")).toBe("closed-demo");
    expect(() => desk.recordInterest("evt_lanterns")).toThrow(MarketingStubError);

    const card = desk.join({ displayName: "  Mira  ", tier: "fan" });
    expect(card.memberRef).toBe("mbr_stub_1");
    expect(card.memberRef.startsWith("right_")).toBe(false);
    expect(card.displayName).toBe("Mira");
    expect(card.status).toBe("설계중");
    expect(card.note).toMatch(/not a protocol field/);

    const interest = desk.recordInterest("evt_lanterns");
    expect(interest.window).toBe("open-demo");
    expect(interest.recordedAt).toBe("2026-09-26T00:00:01.000Z");
    expect(desk.recordInterest("evt_lanterns").recordedAt).toBe(interest.recordedAt);

    desk.leave();
    expect(desk.snapshot().membership).toBeNull();
    expect(desk.snapshot().interests).toEqual([]);
    expect(presaleWindowFor("guest")).toBe("closed-demo");
  });

  it("rejects a blank name and records a member-tier interest without a payment field", () => {
    const desk = new MarketingStubDesk(clock());
    expect(() => desk.join({ displayName: "   ", tier: "member" })).toThrow(/1–40/);
    desk.join({ displayName: "Nari", tier: "member" });
    const interest = desk.recordInterest(" evt_paper_orchestra ");
    expect(interest.tier).toBe("member");
    expect(interest.eventId).toBe("evt_paper_orchestra");
    const names = keysOf(desk.snapshot());
    expect(names.has("payment")).toBe(false);
    expect(names.has("amount")).toBe(false);
    expect(names.has("currency")).toBe(false);
    expect(names.has("price")).toBe(false);
  });

  it("applies fixture coupon markers once and rejects unknown codes", () => {
    const desk = new MarketingStubDesk(clock());
    const applied = desk.applyCoupon(" lantern-note ");
    expect(applied.code).toBe("LANTERN-NOTE");
    expect(applied.marker).toBe("session-marker");
    expect(applied.titleKo).toBe(COUPON_FIXTURES[0]?.titleKo);
    expect(() => desk.applyCoupon("LANTERN-NOTE")).toThrow(/already/);
    expect(() => desk.applyCoupon("PAID-10")).toThrow(/display-only/);
    expect(desk.snapshot().coupons).toHaveLength(1);
  });

  it("counts partner referral markers and refuses the session’s own code", () => {
    const desk = new MarketingStubDesk(clock());
    expect(desk.snapshot().referralCode).toBe(OWN_REFERRAL_CODE);
    expect(() => desk.acceptReferral("ref-stub-self")).toThrow(/own demo code/);
    expect(() => desk.acceptReferral("REF-STUB-UNKNOWN")).toThrow(/Unknown/);
    expect(desk.acceptReferral("ref-stub-hall").markers).toBe(1);
    expect(() => desk.acceptReferral(PARTNER_REFERRAL_CODES[0])).toThrow(/already counted/);
    expect(desk.acceptReferral("REF-STUB-PAPER").markers).toBe(2);
    const snapshot = desk.snapshot();
    expect(snapshot.rewardMarkers).toBe(2);
    expect(snapshot.boundary.creditDisbursement).toBe("none");
    expect(keysOf(snapshot).has("currency")).toBe(false);
  });

  it("stores consent flags with send disabled and records a withdrawal", () => {
    const desk = new MarketingStubDesk(clock());
    expect(desk.withdrawConsent().state).toBe("unset");
    const saved = desk.saveConsent({ performanceNotes: true, membershipNotes: false });
    expect(saved.state).toBe("saved");
    expect(saved.channelSend).toBe("none");
    expect(saved.storage).toBe("browser-session-stub");
    expect(saved.performanceNotes).toBe(true);
    expect(saved.updatedAt).toBe("2026-09-26T00:00:01.000Z");

    const withdrawn = desk.withdrawConsent();
    expect(withdrawn.state).toBe("withdrawn");
    expect(withdrawn.performanceNotes).toBe(false);
    expect(withdrawn.membershipNotes).toBe(false);
    expect(withdrawn.channelSend).toBe("none");
    const names = Object.getOwnPropertyNames(MarketingStubDesk.prototype);
    expect(names).not.toContain("send");
    expect(names).not.toContain("disburse");
    expect(names).not.toContain("confirmBooking");
    for (const call of MARKETING_FORBIDDEN_CALLS) {
      expect(names).not.toContain(call);
    }
    expect(MARKETING_BOUNDARY.protocolBinding).toBe("none");
    expect(MARKETING_BOUNDARY.openApiBound).toBe(false);
    expect(MARKETING_BOUNDARY.outboundSend).toBe("none");
    expect(MARKETING_BOUNDARY.creditDisbursement).toBe("none");
  });

  it("resets the session stub without leaving markers behind", () => {
    const desk = new MarketingStubDesk(clock());
    desk.join({ displayName: "Mira", tier: "fan" });
    desk.recordInterest("evt_lanterns");
    desk.applyCoupon("FERRY-NOTE");
    desk.acceptReferral("REF-STUB-FERRY");
    desk.saveConsent({ performanceNotes: true, membershipNotes: true });
    desk.reset();
    const snapshot = desk.snapshot();
    expect(snapshot.membership).toBeNull();
    expect(snapshot.interests).toEqual([]);
    expect(snapshot.coupons).toEqual([]);
    expect(snapshot.rewardMarkers).toBe(0);
    expect(snapshot.acceptedReferrals).toEqual([]);
    expect(snapshot.consent.state).toBe("unset");
    expect(snapshot.boundary).toBe(MARKETING_BOUNDARY);
  });
});
