/**
 * In-memory marketing fixtures for Wave 7 M01–M05.
 * Data lives for one page load of the demo. It is not a kix-protocol type,
 * not an OpenAPI schema, and not a Move layout.
 * Runtime code in this folder does not read the OpenAPI pin.
 * MARKETING_CONTRACT_ALIGNMENT records the catalogue state.
 * M01–M04 have no published command. M05 names set_consent and
 * authorize_marketing and does not call either one.
 * Calling them belongs to w7-m05-consent-bind, which is not this desk.
 */

/**
 * Marketing session boundary. The protocol-adapter OpenAPI pin does not flip these flags.
 * `status` is the session posture for the M01–M04 stub. It is not the M05 charter label.
 * M05 stays 미착수 on MARKETING_SURFACES. Labels are never promoted.
 * openApiBound stays false. This boundary is not a command body.
 */
export const MARKETING_BOUNDARY = {
  status: "설계중",
  protocolBinding: "none",
  liveChain: false,
  fundsMovement: "none",
  creditDisbursement: "none",
  outboundSend: "none",
  openApiBound: false,
} as const;

export type DemoTier = "guest" | "fan" | "member";
export type MemberTier = Exclude<DemoTier, "guest">;
export type PresaleWindow = "open-demo" | "closed-demo";

export const COUPON_FIXTURES = [
  {
    code: "LANTERN-NOTE",
    titleKo: "랜턴 회차 안내",
    titleEn: "Lantern listing note",
    marker: "session-marker",
  },
  {
    code: "PAPER-NOTE",
    titleKo: "페이퍼 오케스트라 안내",
    titleEn: "Paper Orchestra listing note",
    marker: "session-marker",
  },
  {
    code: "FERRY-NOTE",
    titleKo: "라스트 페리 안내",
    titleEn: "Last Ferry listing note",
    marker: "session-marker",
  },
] as const;

export const PARTNER_REFERRAL_CODES = ["REF-STUB-HALL", "REF-STUB-PAPER", "REF-STUB-FERRY"] as const;

/** This browser session’s own demo code. It cannot be accepted by the same session. */
export const OWN_REFERRAL_CODE = "REF-STUB-SELF";

const MEMBERSHIP_NOTE =
  "Local marketing fixture for this page load. It is not a Wave 2 right and it is not a protocol field.";

export class MarketingStubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingStubError";
  }
}

export interface MembershipCard {
  memberRef: string;
  displayName: string;
  tier: MemberTier;
  status: typeof MARKETING_BOUNDARY.status;
  note: string;
}

export interface PresaleInterest {
  eventId: string;
  tier: MemberTier;
  window: "open-demo";
  recordedAt: string;
}

export interface AppliedCoupon {
  code: string;
  titleKo: string;
  titleEn: string;
  marker: "session-marker";
  appliedAt: string;
}

export interface ConsentRecord {
  performanceNotes: boolean;
  membershipNotes: boolean;
  state: "unset" | "saved" | "withdrawn";
  updatedAt: string | null;
  channelSend: "none";
  storage: "browser-session-stub";
}

export interface MarketingSnapshot {
  boundary: typeof MARKETING_BOUNDARY;
  membership: MembershipCard | null;
  interests: PresaleInterest[];
  coupons: AppliedCoupon[];
  referralCode: string;
  rewardMarkers: number;
  acceptedReferrals: string[];
  consent: ConsentRecord;
}

export function presaleWindowFor(tier: DemoTier): PresaleWindow {
  return tier === "guest" ? "closed-demo" : "open-demo";
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isPartnerCode(code: string): code is (typeof PARTNER_REFERRAL_CODES)[number] {
  return (PARTNER_REFERRAL_CODES as readonly string[]).includes(code);
}

function emptyConsent(): ConsentRecord {
  return {
    performanceNotes: false,
    membershipNotes: false,
    state: "unset",
    updatedAt: null,
    channelSend: "none",
    storage: "browser-session-stub",
  };
}

export class MarketingStubDesk {
  private seq = 0;
  private membership: MembershipCard | null = null;
  private interests: PresaleInterest[] = [];
  private coupons: AppliedCoupon[] = [];
  private acceptedReferrals: string[] = [];
  private rewardMarkers = 0;
  private consent: ConsentRecord = emptyConsent();

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  snapshot(): MarketingSnapshot {
    return {
      boundary: MARKETING_BOUNDARY,
      membership: this.membership ? { ...this.membership } : null,
      interests: this.interests.map((item) => ({ ...item })),
      coupons: this.coupons.map((item) => ({ ...item })),
      referralCode: OWN_REFERRAL_CODE,
      rewardMarkers: this.rewardMarkers,
      acceptedReferrals: [...this.acceptedReferrals],
      consent: { ...this.consent },
    };
  }

  reset(): void {
    this.seq = 0;
    this.membership = null;
    this.interests = [];
    this.coupons = [];
    this.acceptedReferrals = [];
    this.rewardMarkers = 0;
    this.consent = emptyConsent();
  }

  join(input: { displayName: string; tier: MemberTier }): MembershipCard {
    const displayName = input.displayName.trim();
    if (displayName.length < 1 || displayName.length > 40) {
      throw new MarketingStubError("Enter a display name of 1–40 characters.");
    }
    if (input.tier !== "fan" && input.tier !== "member") {
      throw new MarketingStubError("Choose a fan or member demo tier.");
    }
    this.seq += 1;
    this.membership = {
      memberRef: `mbr_stub_${this.seq}`,
      displayName,
      tier: input.tier,
      status: MARKETING_BOUNDARY.status,
      note: MEMBERSHIP_NOTE,
    };
    return { ...this.membership };
  }

  leave(): void {
    this.membership = null;
    this.interests = [];
  }

  recordInterest(eventId: string): PresaleInterest {
    const trimmed = eventId.trim();
    if (!trimmed) {
      throw new MarketingStubError("Choose a performance.");
    }
    const tier = this.membership?.tier;
    if (!tier || presaleWindowFor(tier) !== "open-demo") {
      throw new MarketingStubError(
        "The demo presale window is closed. Issue a fan or member card on M01 first. This screen does not place a hold.",
      );
    }
    const existing = this.interests.find((item) => item.eventId === trimmed);
    if (existing) {
      return { ...existing };
    }
    const created: PresaleInterest = {
      eventId: trimmed,
      tier,
      window: "open-demo",
      recordedAt: this.now(),
    };
    this.interests.push(created);
    return { ...created };
  }

  applyCoupon(code: string): AppliedCoupon {
    const normalized = normalizeCode(code);
    const fixture = COUPON_FIXTURES.find((item) => item.code === normalized);
    if (!fixture) {
      throw new MarketingStubError("Unknown demo code. Markers are display-only.");
    }
    if (this.coupons.some((item) => item.code === fixture.code)) {
      throw new MarketingStubError("That demo code is already on this session.");
    }
    const applied: AppliedCoupon = {
      code: fixture.code,
      titleKo: fixture.titleKo,
      titleEn: fixture.titleEn,
      marker: "session-marker",
      appliedAt: this.now(),
    };
    this.coupons.push(applied);
    return { ...applied };
  }

  acceptReferral(code: string): { markers: number } {
    const normalized = normalizeCode(code);
    if (!normalized) {
      throw new MarketingStubError("Enter a demo referral code.");
    }
    if (normalized === OWN_REFERRAL_CODE) {
      throw new MarketingStubError("This session cannot accept its own demo code.");
    }
    if (!isPartnerCode(normalized)) {
      throw new MarketingStubError("Unknown demo referral code.");
    }
    if (this.acceptedReferrals.includes(normalized)) {
      throw new MarketingStubError("That demo code is already counted.");
    }
    this.acceptedReferrals.push(normalized);
    this.rewardMarkers += 1;
    return { markers: this.rewardMarkers };
  }

  saveConsent(input: { performanceNotes: boolean; membershipNotes: boolean }): ConsentRecord {
    this.consent = {
      performanceNotes: input.performanceNotes,
      membershipNotes: input.membershipNotes,
      state: "saved",
      updatedAt: this.now(),
      channelSend: "none",
      storage: "browser-session-stub",
    };
    return { ...this.consent };
  }

  withdrawConsent(): ConsentRecord {
    if (this.consent.state === "unset") {
      return { ...this.consent };
    }
    this.consent = {
      performanceNotes: false,
      membershipNotes: false,
      state: "withdrawn",
      updatedAt: this.now(),
      channelSend: "none",
      storage: "browser-session-stub",
    };
    return { ...this.consent };
  }
}
