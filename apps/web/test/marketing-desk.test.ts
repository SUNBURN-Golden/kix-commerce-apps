import { MARKETING_FIXTURES } from "../src/marketing/fixtures";
import { describe, expect, it, vi } from "vitest";
import { MARKETING_FORBIDDEN_CALLS } from "../src/marketing/contracts";
import {
  COUPON_FIXTURES,
  couponState,
  type MemberTier,
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

// Fixed clocks and constructor fixtures keep local knowledge separate from protocol outcomes.
describe("marketing lifecycle and fail-closed fixture validation", () => {
  const now = "2026-10-30T00:00:00.000Z";
  const member = (desk: MarketingStubDesk) => desk.join({ displayName: "Fan", tier: "fan" });
  function unchanged(desk: MarketingStubDesk, action: () => unknown, code?: string) {
    const before = desk.snapshot();
    let caught: unknown;
    try { action(); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(MarketingStubError);
    if (code) expect(caught).toMatchObject({ code });
    expect(desk.snapshot()).toEqual(before);
  }

  it("updates both tiers, validates atomically and explicitly recovers unknown membership", () => {
    const desk = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, membershipKnowledge: "unknown" });
    expect(desk.snapshot().membershipKnowledge).toBe("unknown");
    unchanged(desk, () => desk.recordInterest("evt_lanterns"), "MEMBERSHIP_UNKNOWN");
    unchanged(desk, () => desk.join({ displayName: "x".repeat(41), tier: "fan" }), "NAME_INVALID");
    unchanged(desk, () => desk.join({ displayName: "x", tier: "guest" as MemberTier }), "TIER_INVALID");
    member(desk);
    expect(desk.snapshot().membershipKnowledge).toBe("known");
    desk.join({ displayName: "Updated", tier: "member" });
    expect(desk.snapshot().membership?.tier).toBe("member");
    member(desk);
    expect(desk.snapshot().membership?.tier).toBe("fan");
    desk.leave();
    expect(desk.snapshot().membership).toBeNull();
    const other = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, membershipKnowledge: "unknown" });
    other.leave();
    expect(other.snapshot().membershipKnowledge).toBe("known");
    const reset = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, membershipKnowledge: "unknown" });
    reset.reset();
    expect(reset.snapshot().membershipKnowledge).toBe("known");
  });

  it("withdraws once, preserves historical tier and replaces the row only on explicit re-entry", () => {
    let at = now;
    const desk = new MarketingStubDesk(() => at);
    member(desk);
    const first = desk.recordInterest(" evt_lanterns ");
    desk.join({ displayName: "Member", tier: "member" });
    at = "2026-10-30T00:01:00.000Z";
    expect(desk.recordInterest("evt_lanterns")).toEqual(first);
    const withdrawn = desk.withdrawInterest(" evt_lanterns ");
    expect(withdrawn).toMatchObject({ state: "withdrawn", tier: "fan", recordedAt: now, withdrawnAt: at });
    unchanged(desk, () => desk.withdrawInterest("evt_lanterns"), "INTEREST_NOT_ACTIVE");
    at = "2026-10-30T00:02:00.000Z";
    expect(desk.recordInterest("evt_lanterns")).toMatchObject({ state: "recorded", tier: "member", recordedAt: at, withdrawnAt: null });
    expect(desk.snapshot().interests).toHaveLength(1);
    desk.leave();
    expect(desk.snapshot().interests).toEqual([]);
  });

  it("refuses blank, absent, closed and unknown windows without adding interests", () => {
    const desk = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, presales: [{ eventId: "closed", window: "closed-demo" }, { eventId: "unknown", window: "unknown" }] });
    member(desk);
    for (const eventId of [" ", "missing", "closed", "unknown"]) unchanged(desk, () => desk.recordInterest(eventId));
    expect(desk.presaleWindow("unknown")).toBe("unknown");
    expect(desk.presaleWindow("closed")).toBe("closed-demo");
  });

  it.each([
    ["2026-10-29T23:59:59.999Z", "future"],
    [now, "valid"],
    ["2026-10-30T00:00:59.999Z", "valid"],
    ["2026-10-30T00:01:00.000Z", "expired"],
    ["2026-10-30T00:01:00.001Z", "expired"],
    ["bad-clock", "invalid"],
  ] as const)("coupon boundary at %s is %s", (at, expected) => {
    const fixture = { ...COUPON_FIXTURES[0]!, validFrom: now, expiresAt: "2026-10-30T00:01:00.000Z" };
    expect(couponState(fixture, at)).toBe(expected);
    const read = vi.fn(() => at);
    const desk = new MarketingStubDesk(read, { ...MARKETING_FIXTURES, coupons: [fixture] });
    if (expected === "valid") { desk.applyCoupon(fixture.code); expect(read).toHaveBeenCalledTimes(1); }
    else { unchanged(desk, () => desk.applyCoupon(fixture.code)); expect(desk.snapshot().coupons).toEqual([]); }
  });

  it.each([
    { validFrom: "bad" }, { expiresAt: "bad" }, { expiresAt: "2026-02-30T00:00:00.000Z" },
    { validFrom: now, expiresAt: now }, { validFrom: "2026-10-31T00:00:00.000Z", expiresAt: now },
    { validity: "unknown" as const },
  ])("refuses malformed or unknown validity: %j", (extra) => {
    const fixture = { ...COUPON_FIXTURES[0]!, ...extra };
    const desk = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, coupons: [fixture] });
    unchanged(desk, () => desk.applyCoupon(fixture.code));
  });

  it("keeps expired attached history and synthetic conflicts, with no silent replacement", () => {
    let at = now;
    const fixture = { ...COUPON_FIXTURES[0]!, expiresAt: "2026-10-30T00:01:00.000Z", conflictGroup: "test-only" };
    const desk = new MarketingStubDesk(() => at, { ...MARKETING_FIXTURES, coupons: [fixture, { ...fixture, code: "SECOND", expiresAt: null }] });
    desk.applyCoupon(" lantern-note ");
    unchanged(desk, () => desk.applyCoupon("SECOND"), "COUPON_CONFLICT");
    at = "2026-10-30T00:01:00.000Z";
    expect(desk.snapshot().couponStates[fixture.code]).toBe("expired");
    unchanged(desk, () => desk.applyCoupon("SECOND"), "COUPON_CONFLICT");
    unchanged(desk, () => desk.applyCoupon(fixture.code), "COUPON_DUPLICATE");
    expect(desk.snapshot().coupons).toHaveLength(1);
  });

  it("normalizes referrals and records source and time exactly once, refusing missing/unknown attribution", () => {
    const desk = new MarketingStubDesk(() => now, { ...MARKETING_FIXTURES, referrals: [...MARKETING_FIXTURES.referrals,
      { code: "MISSING", knowledge: "known" }, { code: "BLANK", knowledge: "known", sourceRef: " " }, { code: "UNKNOWN", knowledge: "unknown", sourceRef: "synthetic:unknown" }] });
    for (const code of [" ", OWN_REFERRAL_CODE, "ABSENT", "MISSING", "BLANK", "UNKNOWN", "REF-STUB-UNATTRIBUTED"]) unchanged(desk, () => desk.acceptReferral(code));
    desk.acceptReferral(" ref-stub-hall ");
    expect(desk.snapshot().referralAttributions).toEqual([{ code: "REF-STUB-HALL", sourceRef: "synthetic:REF-STUB-HALL", acceptedAt: now, marker: "session-marker" }]);
    unchanged(desk, () => desk.acceptReferral("ref-stub-hall"), "REFERRAL_DUPLICATE");
    desk.acceptReferral("REF-STUB-PAPER");
    expect(desk.snapshot().rewardMarkers).toBe(2);
  });

  it("copies constructor fixtures, returned records and every snapshot collection defensively", () => {
    const fixtures = structuredClone(MARKETING_FIXTURES);
    const desk = new MarketingStubDesk(() => now, fixtures);
    member(desk);
    fixtures.presales[0]!.window = "closed-demo";
    const row = desk.recordInterest("evt_lanterns"); row.state = "withdrawn";
    const coupon = desk.applyCoupon("LANTERN-NOTE"); coupon.code = "changed";
    desk.acceptReferral("REF-STUB-HALL");
    const snapshot = desk.snapshot();
    snapshot.interests[0]!.tier = "member";
    snapshot.coupons[0]!.code = "changed";
    snapshot.referralAttributions[0]!.sourceRef = "changed";
    snapshot.acceptedReferrals.push("changed");
    snapshot.fixtures.presales[0]!.window = "unknown";
    snapshot.fixtures.referrals[0]!.sourceRef = "changed";
    snapshot.membership!.displayName = "changed";
    expect(desk.snapshot().interests[0]).toMatchObject({ state: "recorded", tier: "fan" });
    expect(desk.snapshot().coupons[0]!.code).toBe("LANTERN-NOTE");
    expect(desk.snapshot().referralAttributions[0]!.sourceRef).toBe("synthetic:REF-STUB-HALL");
    expect(desk.snapshot().acceptedReferrals).toHaveLength(1);
    expect(desk.snapshot().membership!.displayName).toBe("Fan");
    expect(new MarketingStubDesk(() => now).snapshot().interests).toEqual([]);
  });

  it("invalid clocks refuse every time-bearing marketing mutation atomically", () => {
    let at = now;
    const desk = new MarketingStubDesk(() => at);
    member(desk); desk.recordInterest("evt_lanterns");
    at = "invalid";
    for (const action of [() => desk.withdrawInterest("evt_lanterns"), () => desk.recordInterest("evt_paper_orchestra"), () => desk.applyCoupon("LANTERN-NOTE"), () => desk.acceptReferral("REF-STUB-HALL")]) unchanged(desk, action, "CLOCK_INVALID");
  });
});
