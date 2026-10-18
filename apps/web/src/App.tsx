import type { ComponentType } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { identifyPage } from "./shell/page-identity";
import { ROUTES, ROUTE_ALIASES, type RouteId } from "./shell/route-registry";
import { RouteBoundary } from "./shell/RenderBoundary";
import { NotFoundPage } from "./pages/NotFound";
import { AdmissionPage } from "./pages/Admission";
import { AssistantPage } from "./pages/Assistant";
import { BookingPage } from "./pages/Booking";
import { BoxOfficePage } from "./pages/BoxOffice";
import { BuyerPage } from "./pages/Buyer";
import { DiscoveryPage } from "./pages/Discovery";
import { M01Page } from "./pages/marketing/M01Membership";
import { M02Page } from "./pages/marketing/M02Presale";
import { M03Page } from "./pages/marketing/M03Coupons";
import { M04Page } from "./pages/marketing/M04Rewards";
import { M05Page } from "./pages/marketing/M05Consent";
import { MarketingHubPage } from "./pages/marketing/Hub";
import { CreditPage } from "./pages/Credit";
import { CreditOriginationPage } from "./pages/CreditOrigination";
import { CreditServicingPage } from "./pages/CreditServicing";
import { CrossSurfaceJourneysPage } from "./pages/CrossSurfaceJourneys";
import { FinancePage } from "./pages/Finance";
import { GiftPage } from "./pages/Gift";
import { HandoffPage } from "./pages/Handoff";
import { InstallableMobilePage } from "./pages/InstallableMobile";
import { InventoryPage } from "./pages/Inventory";
import { JourneyIdentityPage } from "./pages/JourneyIdentity";
import { MarketingJourneyPage } from "./pages/MarketingJourney";
import { MarketplacePerformancePage } from "./pages/MarketplacePerformance";
import { MerchantPage } from "./pages/Merchant";
import { NotificationsPage } from "./pages/Notifications";
import { OperationalQualificationPage } from "./pages/OperationalQualification";
import { PlatformReleasePage } from "./pages/PlatformRelease";
import { OrganizerPage } from "./pages/Organizer";
import { OrganizerWorkspacePage } from "./pages/OrganizerWorkspace";
import { PlatformPage } from "./pages/Platform";
import { ProviderJourneyPage } from "./pages/ProviderJourney";
import { ReceiptsPage } from "./pages/Receipts";
import { ResalePage } from "./pages/Resale";
import { SessionRecoveryPage } from "./pages/SessionRecovery";
import { TenantPermissionsPage } from "./pages/TenantPermissions";

/** The component each registry route draws. A route added to the registry without a component here fails typecheck. */
const SCREENS: Record<RouteId, ComponentType> = {
  "box-office": BoxOfficePage,
  buyer: BuyerPage,
  discovery: DiscoveryPage,
  inventory: InventoryPage,
  booking: BookingPage,
  admission: AdmissionPage,
  resale: ResalePage,
  gift: GiftPage,
  mobile: InstallableMobilePage,
  assistant: AssistantPage,
  organizer: OrganizerPage,
  "organizer-workspace": OrganizerWorkspacePage,
  merchant: MerchantPage,
  finance: FinancePage,
  provider: ProviderJourneyPage,
  credit: CreditPage,
  "credit-origination": CreditOriginationPage,
  "credit-servicing": CreditServicingPage,
  marketing: MarketingHubPage,
  "marketing-journey": MarketingJourneyPage,
  "marketing-m01": M01Page,
  "marketing-m02": M02Page,
  "marketing-m03": M03Page,
  "marketing-m04": M04Page,
  "marketing-m05": M05Page,
  platform: PlatformPage,
  "marketplace-performance": MarketplacePerformancePage,
  permissions: TenantPermissionsPage,
  notifications: NotificationsPage,
  identity: JourneyIdentityPage,
  session: SessionRecoveryPage,
  receipts: ReceiptsPage,
  handoff: HandoffPage,
  journeys: CrossSurfaceJourneysPage,
  qualification: OperationalQualificationPage,
  release: PlatformReleasePage,
};

function RoutedScreens() {
  const identity = identifyPage(useLocation().pathname);
  return (
    <RouteBoundary screenKey={identity.key} screenLabel={identity.label}>
      <Routes>
        {ROUTES.map((entry) => {
          const Screen = SCREENS[entry.id];
          return <Route key={entry.id} path={entry.path} element={<Screen />} />;
        })}
        {ROUTE_ALIASES.map((alias) => {
          const target = ROUTES.find((entry) => entry.path === alias.of);
          const Screen = SCREENS[target!.id];
          return <Route key={alias.path} path={alias.path} element={<Screen />} />;
        })}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RouteBoundary>
  );
}

export function App() {
  return (
    <Shell>
      <RoutedScreens />
    </Shell>
  );
}
