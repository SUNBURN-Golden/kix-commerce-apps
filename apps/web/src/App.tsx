import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AdmissionPage } from "./pages/Admission";
import { BookingPage } from "./pages/Booking";
import { BoxOfficePage } from "./pages/BoxOffice";
import { M01Page } from "./pages/marketing/M01Membership";
import { M02Page } from "./pages/marketing/M02Presale";
import { M03Page } from "./pages/marketing/M03Coupons";
import { M04Page } from "./pages/marketing/M04Rewards";
import { M05Page } from "./pages/marketing/M05Consent";
import { MarketingHubPage } from "./pages/marketing/Hub";
import { ResalePage } from "./pages/Resale";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<BoxOfficePage />} />
        <Route path="/booking/:eventId" element={<BookingPage />} />
        <Route path="/admission" element={<AdmissionPage />} />
        <Route path="/resale" element={<ResalePage />} />
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
