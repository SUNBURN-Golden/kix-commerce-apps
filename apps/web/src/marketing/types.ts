/**
 * Wave 7 marketing information architecture for this app.
 * M01–M05 are demo surface labels from the Task 005 charter.
 * They are not kix-protocol field names, OpenAPI operations, or conformance claims.
 */

export const MARKETING_SURFACES = {
  campaigns: "M01",
  landingShells: "M02",
  contentSlots: "M03",
  creativeVariants: "M04",
  trackingStub: "M05",
} as const;

export type MarketingSurfaceCode = (typeof MARKETING_SURFACES)[keyof typeof MARKETING_SURFACES];

export type SlotId = "hero" | "detail" | "faq" | "disclaimer";

export interface ContentSlot {
  slotId: SlotId;
  label: string;
  body: string;
  editable: boolean;
}

export interface CreativeVariant {
  variantId: string;
  label: string;
  hero: string;
  detail: string;
}

export interface CampaignFixture {
  campaignId: string;
  title: string;
  /**
   * Join key for the Wave 6 desk stub seed.
   * This is a local demo fixture key, not a protocol identifier.
   */
  deskFixtureKey: string;
  summary: string;
  /** App path only. No production host. */
  path: string;
  variants: readonly CreativeVariant[];
  slots: readonly ContentSlot[];
}

export interface DocumentMeta {
  title: string;
  description: string;
  canonicalPath: string;
  robots: "noindex, nofollow";
  ogTitle: string;
  ogDescription: string;
}

export interface LandingShell extends DocumentMeta {
  surface: typeof MARKETING_SURFACES.landingShells;
  /** No production host is configured for this demo. */
  host: null;
  indexed: false;
}

export type TrackName = "page_view" | "slot_impression" | "cta_click" | "variant_select";

export interface TrackRecord {
  recordId: string;
  name: TrackName;
  campaignId: string | null;
  detail: string;
  at: string;
  transport: "none";
  disposition: "stub-not-transmitted";
}

export const DEMO_DISCLAIMER =
  "Wave 7 marketing demo. This page does not sell admission, take payment, or state protocol rules. Desk booking is simulated and moves no funds. Landing tags are a shell with noindex and no production host. The tracking log stays in this session and is not analytics. An OpenAPI bind is still required before any production integration claim.";

export const SLOT_BODY_MAX = 600;
