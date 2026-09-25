import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AdmissionPage } from "./pages/Admission";
import { BookingPage } from "./pages/Booking";
import { BoxOfficePage } from "./pages/BoxOffice";
import { CampaignPage } from "./pages/marketing/CampaignPage";
import { CampaignIndexPage, MarketingMissingPage } from "./pages/marketing/CampaignIndex";
import { MarketingLayout } from "./pages/marketing/MarketingLayout";
import { TrackingPage } from "./pages/marketing/TrackingPage";
import { ResalePage } from "./pages/Resale";

function DeskLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/marketing" element={<MarketingLayout />}>
        <Route index element={<CampaignIndexPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path=":campaignId" element={<CampaignPage />} />
        <Route path="*" element={<MarketingMissingPage />} />
      </Route>
      <Route element={<DeskLayout />}>
        <Route path="/" element={<BoxOfficePage />} />
        <Route path="/booking/:eventId" element={<BookingPage />} />
        <Route path="/admission" element={<AdmissionPage />} />
        <Route path="/resale" element={<ResalePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
