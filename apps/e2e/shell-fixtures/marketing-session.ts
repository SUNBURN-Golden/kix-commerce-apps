/** Isolated shell-fault bundle ONLY. Never imported by the production build. */
import { MarketingStubDesk } from "../../web/src/marketing/desk";
import { MARKETING_FIXTURES, type MarketingFixtureBundle } from "../../web/src/marketing/fixtures";
declare global {
  interface Window {
    __kixMarketingFixture?: "unknown" | "windows" | "empty";
    __kixMarketingNow?: string;
  }
}
const scenario = window.__kixMarketingFixture;
const fixtures: MarketingFixtureBundle = {
  ...MARKETING_FIXTURES,
  membershipKnowledge: scenario === "unknown" ? "unknown" : "known",
  presales: scenario === "empty" ? [] : MARKETING_FIXTURES.presales.map((row, index) => ({ ...row, window: scenario === "windows" ? index === 0 ? "closed-demo" : "unknown" : row.window })),
  coupons: scenario === "empty" ? [] : [...MARKETING_FIXTURES.coupons, { ...MARKETING_FIXTURES.coupons[0]!, code: "DEMO-BOUNDARY", validFrom: "2026-10-30T00:00:00.000Z", expiresAt: "2026-10-30T00:01:00.000Z" }],
  referrals: scenario === "empty" ? [] : MARKETING_FIXTURES.referrals,
};
export const marketingSession = new MarketingStubDesk(() => window.__kixMarketingNow ?? "2026-10-30T00:00:00.000Z", fixtures);
