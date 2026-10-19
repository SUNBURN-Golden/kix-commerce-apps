import { Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ScreenLoading } from "./components/ScreenLoading";
import { usePageIdentity } from "./i18n/use-page-identity";
import { ROUTES, ROUTE_ALIASES } from "./shell/route-registry";
import { RouteBoundary } from "./shell/RenderBoundary";
import { ScreenSlot } from "./shell/ScreenSlot";
import { NotFoundPage } from "./pages/NotFound";
import { screens } from "./screens";

/** One registry route's screen. Its code loads on first use; Suspense shows a progress note meanwhile. */
function lazyScreen(entry: (typeof ROUTES)[number]) {
  return (
    <Suspense key={entry.id} fallback={<ScreenLoading label={entry.label} />}>
      <ScreenSlot id={entry.id} read={screens.read} />
    </Suspense>
  );
}

function RoutedScreens() {
  const identity = usePageIdentity(useLocation().pathname);
  return (
    <RouteBoundary screenKey={identity.key} screenLabel={identity.label}>
      <Routes>
        {ROUTES.map((entry) => {
          return <Route key={entry.id} path={entry.path} element={lazyScreen(entry)} />;
        })}
        {ROUTE_ALIASES.map((alias) => {
          const target = ROUTES.find((entry) => entry.path === alias.of);
          if (target === undefined) {
            throw new Error(`Route alias ${alias.path} points at an unknown route ${alias.of}`);
          }
          return <Route key={alias.path} path={alias.path} element={lazyScreen(target)} />;
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
