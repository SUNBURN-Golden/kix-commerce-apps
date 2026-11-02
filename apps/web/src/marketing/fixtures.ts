/** App-local examples only. Dates and groups establish no product duration or stacking policy. */
export interface PresaleFixture {
  eventId: string;
  window: "open-demo" | "closed-demo" | "unknown";
}
export interface CouponFixture {
  code: string;
  titleKo: string;
  titleEn: string;
  marker: "session-marker";
  validity: "known" | "unknown";
  /** null means unbounded, only when validity is known. */
  validFrom: string | null;
  expiresAt: string | null;
  conflictGroup: string | null;
}
/** Input is deliberately separate from an accepted attribution. Missing sourceRef refuses acceptance. */
export interface ReferralFixture {
  code: string;
  sourceRef?: string | null;
  knowledge: "known" | "unknown";
}
export interface MarketingFixtureBundle {
  membershipKnowledge: "known" | "unknown";
  presales: readonly PresaleFixture[];
  coupons: readonly CouponFixture[];
  referrals: readonly ReferralFixture[];
}
export const PARTNER_REFERRAL_CODES = ["REF-STUB-HALL", "REF-STUB-PAPER", "REF-STUB-FERRY"] as const;
export const OWN_REFERRAL_CODE = "REF-STUB-SELF";
const coupon = (code: string, titleKo: string, titleEn: string, extra: Partial<CouponFixture> = {}): CouponFixture => ({
  code, titleKo, titleEn, marker: "session-marker", validity: "known", validFrom: null, expiresAt: null, conflictGroup: null, ...extra,
});
export const COUPON_FIXTURES: readonly CouponFixture[] = [
  coupon("LANTERN-NOTE", "랜턴 회차 안내", "Lantern listing note"),
  coupon("PAPER-NOTE", "페이퍼 오케스트라 안내", "Paper Orchestra listing note"),
  coupon("FERRY-NOTE", "라스트 페리 안내", "Last Ferry listing note"),
  coupon("DEMO-EXPIRED", "합성 만료 예시", "Synthetic expired example", { expiresAt: "2000-01-01T00:00:00.000Z" }),
  coupon("DEMO-FUTURE", "합성 미래 예시", "Synthetic future example", { validFrom: "2099-01-01T00:00:00.000Z" }),
  coupon("DEMO-UNKNOWN", "합성 미확인 예시", "Synthetic unknown example", { validity: "unknown" }),
  coupon("DEMO-GROUP-A", "합성 그룹 A", "Synthetic group A", { conflictGroup: "synthetic-example" }),
  coupon("DEMO-GROUP-B", "합성 그룹 B", "Synthetic group B", { conflictGroup: "synthetic-example" }),
];
export const MARKETING_FIXTURES: MarketingFixtureBundle = {
  membershipKnowledge: "known",
  presales: ["evt_lanterns", "evt_paper_orchestra", "evt_last_ferry"].map((eventId) => ({ eventId, window: "open-demo" })),
  coupons: COUPON_FIXTURES,
  referrals: [
    ...PARTNER_REFERRAL_CODES.map((code) => ({ code, sourceRef: `synthetic:${code}`, knowledge: "known" as const })),
    { code: "REF-STUB-UNATTRIBUTED", sourceRef: null, knowledge: "unknown" },
  ],
};
