import { messages as sourceCopy } from "../i18n/messages/marketing--desk";
import { cachedGroups, CACHED_NOT_SENT, assertConnected } from "../connectivity/write-guard";
/**
 * In-memory marketing fixtures for Wave 7 M01–M05.
 * Data lives for one page load of the demo. It is not a kix-protocol type,
 * not an OpenAPI schema, and not a Move layout.
 * Runtime code in this folder does not read the OpenAPI pin.
 * MARKETING_CONTRACT_ALIGNMENT records the catalogue state.
 * M01–M04 have no published command. M05 names set_consent and
 * authorize_marketing. This session desk does not call either one.
 * The bind lives outside this folder.
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
export type PresaleWindow = "open-demo" | "closed-demo" | "unknown";

export { COUPON_FIXTURES, PARTNER_REFERRAL_CODES, OWN_REFERRAL_CODE } from "./fixtures";
import { MARKETING_FIXTURES, OWN_REFERRAL_CODE, type CouponFixture, type MarketingFixtureBundle } from "./fixtures";
export type { MarketingFixtureBundle } from "./fixtures";

const MEMBERSHIP_NOTE =
  sourceCopy.en["srj"];

export class MarketingStubError extends Error {
  constructor(message: string, readonly code = "MARKETING_REFUSED") {
    super(message);
    this.name = sourceCopy.en["srz"];
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
  state: "recorded" | "withdrawn";
  withdrawnAt: string | null;
}

export interface AppliedCoupon {
  code: string;
  titleKo: string;
  titleEn: string;
  marker: "session-marker";
  appliedAt: string;
}

export interface ReferralAttribution {
  code: string;
  sourceRef: string;
  acceptedAt: string;
  marker: "session-marker";
}
export type CouponState = "valid" | "expired" | "future" | "unknown" | "invalid";

/** Strict UTC fixture timestamps; malformed dates, rollover dates and clocks fail closed. */
function timestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
  const result = Date.parse(value);
  return Number.isFinite(result) && new Date(result).toISOString() === value ? result : NaN;
}
export function couponState(fixture: CouponFixture, now: string): CouponState {
  const at = timestamp(now);
  const from = fixture.validFrom === null ? -Infinity : timestamp(fixture.validFrom);
  const until = fixture.expiresAt === null ? Infinity : timestamp(fixture.expiresAt);
  if (!Number.isFinite(at) || Number.isNaN(from) || Number.isNaN(until) || from >= until) return "invalid";
  if (fixture.validity !== "known") return "unknown";
  return at < from ? "future" : at >= until ? "expired" : "valid";
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
  membershipKnowledge: "known" | "unknown";
  fixtures: MarketingFixtureBundle;
  couponStates: Record<string, CouponState>;
  referralAttributions: ReferralAttribution[];
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
  private membershipKnowledge: "known" | "unknown";
  private readonly fixtures: MarketingFixtureBundle;
  private referralAttributions: ReferralAttribution[] = [];
  private membership: MembershipCard | null = null;
  private interests: PresaleInterest[] = [];
  private coupons: AppliedCoupon[] = [];
  private acceptedReferrals: string[] = [];
  private rewardMarkers = 0;
  private consent: ConsentRecord = emptyConsent();

  constructor(private readonly now: () => string = () => new Date().toISOString(), fixtures: MarketingFixtureBundle = MARKETING_FIXTURES) {
    this.fixtures = this.copyFixtures(fixtures);
    this.membershipKnowledge = fixtures.membershipKnowledge;
  }

  private copyFixtures(fixtures: MarketingFixtureBundle): MarketingFixtureBundle {
    return { ...fixtures, presales: fixtures.presales.map((row) => ({ ...row })), coupons: fixtures.coupons.map((row) => ({ ...row })), referrals: fixtures.referrals.map((row) => ({ ...row })) };
  }

  private actionTime(): string {
    const now = this.now();
    if (!Number.isFinite(timestamp(now))) throw new MarketingStubError(sourceCopy.en["marketing.clockInvalid"], "CLOCK_INVALID");
    return now;
  }

  presaleWindow(eventId: string): PresaleWindow {
    if (this.membershipKnowledge !== "known") return "unknown";
    if (!this.membership) return "closed-demo";
    return this.fixtures.presales.find((row) => row.eventId === eventId)?.window ?? "unknown";
  }

  snapshot(): MarketingSnapshot {
    const at = this.coupons.length ? this.now() : "";
    return {
      boundary: MARKETING_BOUNDARY,
      membershipKnowledge: this.membershipKnowledge,
      fixtures: this.copyFixtures(this.fixtures),
      couponStates: Object.fromEntries(this.coupons.map((row) => {
        const fixture = this.fixtures.coupons.find((item) => item.code === row.code);
        return [row.code, fixture ? couponState(fixture, at) : "unknown"];
      })),
      referralAttributions: this.referralAttributions.map((row) => ({ ...row })),
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
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    this.seq = 0;
    this.membershipKnowledge = "known";
    this.referralAttributions = [];
    this.membership = null;
    this.interests = [];
    this.coupons = [];
    this.acceptedReferrals = [];
    this.rewardMarkers = 0;
    this.consent = emptyConsent();
  }

  join(input: { displayName: string; tier: MemberTier }): MembershipCard {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    const displayName = input.displayName.trim();
    if (displayName.length < 1 || displayName.length > 40) {
      throw new MarketingStubError(sourceCopy.en["marketing.nameInvalid"], "NAME_INVALID");
    }
    if (input.tier !== "fan" && input.tier !== "member") {
      throw new MarketingStubError(sourceCopy.en["sc9"], "TIER_INVALID");
    }
    this.membershipKnowledge = "known";
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
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    this.membership = null;
    this.membershipKnowledge = "known";
    this.interests = [];
  }

  recordInterest(eventId: string): PresaleInterest {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    const trimmed = eventId.trim();
    if (!trimmed) {
      throw new MarketingStubError(sourceCopy.en["scb"], "EVENT_EMPTY");
    }
    if (this.membershipKnowledge !== "known") throw new MarketingStubError(sourceCopy.en["marketing.membershipUnknown"], "MEMBERSHIP_UNKNOWN");
    const fixture = this.fixtures.presales.find((row) => row.eventId === trimmed);
    if (!fixture) throw new MarketingStubError(sourceCopy.en["marketing.eventUnknown"], "EVENT_UNKNOWN");
    if (fixture.window === "unknown") throw new MarketingStubError(sourceCopy.en["marketing.windowUnknown"], "WINDOW_UNKNOWN");
    const tier = this.membership?.tier;
    if (!tier || fixture.window !== "open-demo") {
      throw new MarketingStubError(
        sourceCopy.en["s1rk"], "WINDOW_CLOSED",
      );
    }
    const existing = this.interests.find((item) => item.eventId === trimmed);
    if (existing?.state === "recorded") {
      return { ...existing };
    }
    const created: PresaleInterest = {
      eventId: trimmed,
      tier,
      window: "open-demo",
      recordedAt: this.actionTime(),
      state: "recorded",
      withdrawnAt: null,
    };
    if (existing) this.interests[this.interests.indexOf(existing)] = created;
    else this.interests.push(created);
    return { ...created };
  }

  withdrawInterest(eventId: string): PresaleInterest {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    const row = this.interests.find((item) => item.eventId === eventId.trim() && item.state === "recorded");
    if (!row) throw new MarketingStubError(sourceCopy.en["marketing.interestMissing"], "INTEREST_NOT_ACTIVE");
    const at = this.actionTime();
    row.state = "withdrawn";
    row.withdrawnAt = at;
    return { ...row };
  }

  applyCoupon(code: string): AppliedCoupon {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    const normalized = normalizeCode(code);
    const fixture = this.fixtures.coupons.find((item) => item.code === normalized);
    if (!fixture) {
      throw new MarketingStubError(sourceCopy.en["s259"], "COUPON_UNKNOWN");
    }
    if (this.coupons.some((item) => item.code === fixture.code)) {
      throw new MarketingStubError(sourceCopy.en["s1pq"], "COUPON_DUPLICATE");
    }
    const at = this.actionTime();
    const state = couponState(fixture, at);
    if (state !== "valid") throw new MarketingStubError(sourceCopy.en[`marketing.coupon.${state}`], `COUPON_${state.toUpperCase()}`);
    // Synthetic groups retain all attached history, even after expiry. Never replace a marker.
    if (fixture.conflictGroup && this.coupons.some((row) => this.fixtures.coupons.find((item) => item.code === row.code)?.conflictGroup === fixture.conflictGroup)) {
      throw new MarketingStubError(sourceCopy.en["marketing.couponConflict"], "COUPON_CONFLICT");
    }
    const applied: AppliedCoupon = {
      code: fixture.code,
      titleKo: fixture.titleKo,
      titleEn: fixture.titleEn,
      marker: "session-marker",
      appliedAt: at,
    };
    this.coupons.push(applied);
    return { ...applied };
  }

  acceptReferral(code: string): { markers: number } {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
    const normalized = normalizeCode(code);
    if (!normalized) {
      throw new MarketingStubError(sourceCopy.en["sif"], "REFERRAL_EMPTY");
    }
    if (normalized === OWN_REFERRAL_CODE) {
      throw new MarketingStubError(sourceCopy.en["s23m"], "REFERRAL_SELF");
    }
    const fixture = this.fixtures.referrals.find((row) => row.code === normalized);
    if (!fixture) {
      throw new MarketingStubError(sourceCopy.en["s25a"], "REFERRAL_UNKNOWN");
    }
    if (this.acceptedReferrals.includes(normalized)) {
      throw new MarketingStubError(sourceCopy.en["s1pp"], "REFERRAL_DUPLICATE");
    }
    if (fixture.knowledge !== "known" || !fixture.sourceRef?.trim()) throw new MarketingStubError(sourceCopy.en["marketing.referralUnknown"], "ATTRIBUTION_UNKNOWN");
    const at = this.actionTime();
    this.referralAttributions.push({ code: normalized, sourceRef: fixture.sourceRef, acceptedAt: at, marker: "session-marker" });
    this.acceptedReferrals.push(normalized);
    this.rewardMarkers += 1;
    return { markers: this.rewardMarkers };
  }

  saveConsent(input: { performanceNotes: boolean; membershipNotes: boolean }): ConsentRecord {
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
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
    assertConnected();
    if (typeof location !== "undefined" && cachedGroups(location.pathname).some((group) => group.label === "marketing-session")) throw new MarketingStubError(CACHED_NOT_SENT);
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
