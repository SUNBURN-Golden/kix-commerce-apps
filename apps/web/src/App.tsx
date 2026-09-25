import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AdmissionPage } from "./pages/Admission";
import { BookingPage } from "./pages/Booking";
import { BoxOfficePage } from "./pages/BoxOffice";
import { ResalePage } from "./pages/Resale";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<BoxOfficePage />} />
        <Route path="/booking/:eventId" element={<BookingPage />} />
        <Route path="/admission" element={<AdmissionPage />} />
        <Route path="/resale" element={<ResalePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
