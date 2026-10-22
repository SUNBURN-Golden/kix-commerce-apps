import { Suspense } from "react";
import { Route, Routes, matchPath, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ScreenLoading } from "./components/ScreenLoading";
import { usePageIdentity } from "./i18n/use-page-identity";
import { APP_ROUTES, ROUTE_ALIASES } from "./shell/route-registry";
import { RouteBoundary } from "./shell/RenderBoundary";
import { ScreenSlot } from "./shell/ScreenSlot";
import { NotFoundPage } from "./pages/NotFound";
import { screens } from "./screens";

/** One registry route's screen. Its code loads on first use; Suspense shows a progress note meanwhile. */
function lazyScreen(entry: (typeof APP_ROUTES)[number]) {
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
        {APP_ROUTES.map((entry) => {
          return <Route key={entry.id} path={entry.path} element={lazyScreen(entry)} />;
        })}
        {ROUTE_ALIASES.map((alias) => {
          const target = APP_ROUTES.find((entry) => entry.path === alias.of);
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
  const { pathname } = useLocation();
  // Gallery previews own their landmarks; a Shell specimen must never be nested inside another Shell.
  if (import.meta.env.DEV) {
    const gallery = APP_ROUTES.find((entry) => entry.id === "component-gallery" && matchPath({ path: entry.path, end: true }, pathname));
    if (gallery) return <RouteBoundary screenKey={gallery.id} screenLabel={gallery.label}>{lazyScreen(gallery)}</RouteBoundary>;
  }
  return (
    <Shell>
      <RoutedScreens />
    </Shell>
  );
}
