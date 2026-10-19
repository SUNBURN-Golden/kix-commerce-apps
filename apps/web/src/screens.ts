import type { RouteId } from "./shell/route-registry";
import { createScreenLoader, type ScreenImport } from "./shell/screen-loader";

/**
 * The code each registry route draws, one dynamic import per route so the bundler emits one chunk for it.
 * A route added to the registry without an import here fails typecheck. The specifiers stay literal.
 */
const SCREEN_IMPORTS: Record<RouteId, ScreenImport> = {
  "box-office": () => import("./pages/BoxOffice").then((m) => ({ default: m.BoxOfficePage })),
  buyer: () => import("./pages/Buyer").then((m) => ({ default: m.BuyerPage })),
  discovery: () => import("./pages/Discovery").then((m) => ({ default: m.DiscoveryPage })),
  inventory: () => import("./pages/Inventory").then((m) => ({ default: m.InventoryPage })),
  booking: () => import("./pages/Booking").then((m) => ({ default: m.BookingPage })),
  admission: () => import("./pages/Admission").then((m) => ({ default: m.AdmissionPage })),
  resale: () => import("./pages/Resale").then((m) => ({ default: m.ResalePage })),
  gift: () => import("./pages/Gift").then((m) => ({ default: m.GiftPage })),
  mobile: () => import("./pages/InstallableMobile").then((m) => ({ default: m.InstallableMobilePage })),
  assistant: () => import("./pages/Assistant").then((m) => ({ default: m.AssistantPage })),
  organizer: () => import("./pages/Organizer").then((m) => ({ default: m.OrganizerPage })),
  "organizer-workspace": () => import("./pages/OrganizerWorkspace").then((m) => ({ default: m.OrganizerWorkspacePage })),
  merchant: () => import("./pages/Merchant").then((m) => ({ default: m.MerchantPage })),
  finance: () => import("./pages/Finance").then((m) => ({ default: m.FinancePage })),
  provider: () => import("./pages/ProviderJourney").then((m) => ({ default: m.ProviderJourneyPage })),
  credit: () => import("./pages/Credit").then((m) => ({ default: m.CreditPage })),
  "credit-origination": () => import("./pages/CreditOrigination").then((m) => ({ default: m.CreditOriginationPage })),
  "credit-servicing": () => import("./pages/CreditServicing").then((m) => ({ default: m.CreditServicingPage })),
  marketing: () => import("./pages/marketing/Hub").then((m) => ({ default: m.MarketingHubPage })),
  "marketing-journey": () => import("./pages/MarketingJourney").then((m) => ({ default: m.MarketingJourneyPage })),
  "marketing-m01": () => import("./pages/marketing/M01Membership").then((m) => ({ default: m.M01Page })),
  "marketing-m02": () => import("./pages/marketing/M02Presale").then((m) => ({ default: m.M02Page })),
  "marketing-m03": () => import("./pages/marketing/M03Coupons").then((m) => ({ default: m.M03Page })),
  "marketing-m04": () => import("./pages/marketing/M04Rewards").then((m) => ({ default: m.M04Page })),
  "marketing-m05": () => import("./pages/marketing/M05Consent").then((m) => ({ default: m.M05Page })),
  platform: () => import("./pages/Platform").then((m) => ({ default: m.PlatformPage })),
  "marketplace-performance": () => import("./pages/MarketplacePerformance").then((m) => ({ default: m.MarketplacePerformancePage })),
  permissions: () => import("./pages/TenantPermissions").then((m) => ({ default: m.TenantPermissionsPage })),
  notifications: () => import("./pages/Notifications").then((m) => ({ default: m.NotificationsPage })),
  identity: () => import("./pages/JourneyIdentity").then((m) => ({ default: m.JourneyIdentityPage })),
  session: () => import("./pages/SessionRecovery").then((m) => ({ default: m.SessionRecoveryPage })),
  receipts: () => import("./pages/Receipts").then((m) => ({ default: m.ReceiptsPage })),
  handoff: () => import("./pages/Handoff").then((m) => ({ default: m.HandoffPage })),
  journeys: () => import("./pages/CrossSurfaceJourneys").then((m) => ({ default: m.CrossSurfaceJourneysPage })),
  qualification: () => import("./pages/OperationalQualification").then((m) => ({ default: m.OperationalQualificationPage })),
  release: () => import("./pages/PlatformRelease").then((m) => ({ default: m.PlatformReleasePage })),
};

export const screens = createScreenLoader<RouteId>(SCREEN_IMPORTS);
