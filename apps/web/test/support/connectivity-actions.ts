/** App-internal audit inventory. Fixture controls are guarded separately from business writes. */
export const SYNTHETIC_WRITERS = [
  "platform-journey", "provider-journey", "refund-return", "journey-identity", "session-recovery",
  "credit-origination", "credit-servicing", "finance-operations", "marketing-journey",
  "delegated-assistant", "tenant-permissions", "notification-inbox", "installable-mobile",
  "operational-qualification", "platform-release", "marketplace-performance",
] as const;
export const LEGACY_WRITERS = ["admission", "credit", "reservation", "resale", "settlement"] as const;
export const CATALOGUE_WRITERS = ["journey", "gift", "organizer", "consent"] as const;
