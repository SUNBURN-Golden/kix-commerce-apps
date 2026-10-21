import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { AppBoundary } from "./shell/RenderBoundary";
import "./styles.css";
import { ConnectivityProvider } from "./connectivity/ConnectivityProvider";
import { ConnectivityBanner } from "./components/ConnectivityBanner";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}

createRoot(root).render(
  <StrictMode>
    <LocaleProvider>
      <BrowserRouter>
        <ConnectivityProvider>
          <ConnectivityBanner />
          <AppBoundary>
            <App />
          </AppBoundary>
        </ConnectivityProvider>
      </BrowserRouter>
    </LocaleProvider>
  </StrictMode>,
);
