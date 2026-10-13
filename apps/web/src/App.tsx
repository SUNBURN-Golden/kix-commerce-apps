import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AdmissionPage } from "./pages/Admission";
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
import { GiftPage } from "./pages/Gift";
import { HandoffPage } from "./pages/Handoff";
import { InventoryPage } from "./pages/Inventory";
import { MerchantPage } from "./pages/Merchant";
import { OrganizerPage } from "./pages/Organizer";
import { OrganizerWorkspacePage } from "./pages/OrganizerWorkspace";
import { PlatformPage } from "./pages/Platform";
import { ReceiptsPage } from "./pages/Receipts";
import { ResalePage } from "./pages/Resale";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<BoxOfficePage />} />
        <Route path="/buyer" element={<BuyerPage />} />
        <Route path="/discovery" element={<DiscoveryPage />} />
        <Route path="/discovery/:rowId" element={<DiscoveryPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/merchant" element={<MerchantPage />} />
        <Route path="/booking/:eventId" element={<BookingPage />} />
        <Route path="/admission" element={<AdmissionPage />} />
        <Route path="/resale" element={<ResalePage />} />
        <Route path="/gift" element={<GiftPage />} />
        <Route path="/organizer/workspace" element={<OrganizerWorkspacePage />} />
        <Route path="/organizer" element={<OrganizerPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/handoff" element={<HandoffPage />} />
        <Route path="/credit/origination" element={<CreditOriginationPage />} />
        <Route path="/credit/servicing" element={<CreditServicingPage />} />
        <Route path="/credit" element={<CreditPage />} />
        <Route path="/marketing" element={<MarketingHubPage />} />
        <Route path="/marketing/m01" element={<M01Page />} />
        <Route path="/marketing/m02" element={<M02Page />} />
        <Route path="/marketing/m03" element={<M03Page />} />
        <Route path="/marketing/m04" element={<M04Page />} />
        <Route path="/marketing/m05" element={<M05Page />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
