import { computeBuildIdentity } from "./build-identity";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));

// Explicit locale-data groups share repeated sentences without claiming their dependencies.
const displayCopyGroups: [string, string[]][] = [
  ["display-copy-1", [
    "a11y--present",
    "admission-desk",
    "credit-desk",
    "credit-origination",
    "credit-servicing",
    "cross-surface-journeys",
    "delegated-assistant",
    "discovery--fixture",
    "discovery--model",
    "discovery-workspace",
    "marketing--desk",
    "marketing-journey",
  ]],
  ["display-copy-2", [
    "guide--status-words",
    "handoff--packet",
    "pages--Handoff",
    "pages--Help",
  ]],
  ["display-copy-3", [
    "discovery-live",
    "installable-mobile",
    "inventory-venue",
    "journey-identity",
    "marketing--contracts",
    "marketing--labels",
    "marketplace-performance",
    "notification-inbox",
    "pages--MarketplacePerformance",
    "pages--MarketplacePerformancePanels",
    "tenant-permissions",
  ]],
  ["display-copy-4", [
    "consent-desk",
    "gift-desk",
    "journey-desk",
    "organizer-desk",
    "organizer-workspace",
    "pages--Admission",
    "pages--AdmissionCredentialPanel",
    "pages--Booking",
    "pages--BuyerPanels",
    "pages--Credit",
    "pages--CreditOrigination",
    "pages--CreditOriginationPanels",
    "pages--CreditPanel",
    "pages--CreditServicing",
    "pages--CreditServicingPanels",
    "pages--Discovery",
    "pages--DiscoveryPanels",
    "pages--Finance",
    "pages--FinancePanels",
    "pages--InventoryPanels",
    "pages--Merchant",
    "pages--MerchantPanels",
    "pages--Notifications",
    "pages--NotificationsPanels",
    "pages--TenantPermissions",
    "pages--TenantPermissionsPanels",
  ]],
  ["display-copy-5", [
    "buyer-workspace",
    "pages--Assistant",
    "pages--AssistantPanels",
    "pages--CrossSurfaceJourneysPanels",
    "pages--Gift",
    "pages--GiftPanel",
    "pages--InstallableMobile",
    "pages--InstallableMobilePanels",
    "pages--Inventory",
    "pages--JourneyIdentityPanels",
    "pages--JourneyPanel",
    "pages--MarketingJourney",
    "pages--MarketingJourneyPanels",
    "pages--OperationalQualification",
    "pages--OperationalQualificationPanels",
    "pages--Organizer",
    "pages--OrganizerPanel",
    "pages--OrganizerWorkspace",
    "pages--Platform",
    "pages--PlatformPanels",
    "pages--PlatformRelease",
    "pages--PlatformReleasePanels",
    "pages--ProviderJourney",
    "pages--ProviderJourneyPanels",
    "pages--Receipts",
    "pages--RefundReturnPanel",
    "pages--Resale",
    "pages--ResalePanel",
    "pages--ReservationPanel",
    "pages--SessionRecoveryPanels",
    "pages--SettlementPanel",
    "pages--marketing--Hub",
    "pages--marketing--M01Membership",
    "pages--marketing--M02Presale",
    "pages--marketing--M03Coupons",
    "pages--marketing--M04Rewards",
    "pages--marketing--M05Consent",
    "pages--marketing--MarketingChrome",
    "receipt-explorer",
  ]],
  ["display-copy-6", [
    "finance-operations",
    "merchant-operations",
    "operational-qualification",
    "platform-journey",
    "platform-release",
    "provider-journey",
    "read-state",
    "refund-return",
    "resale-desk",
    "reservation-desk",
    "session-recovery",
    "storage-allow-list",
  ]],
];

export default defineConfig({
  define: { __KIX_BUILD_IDENTITY__: JSON.stringify(computeBuildIdentity()) },
  plugins: [react()],
  // Preserve the existing size limits for localized copy and the shared app shell.
  build: {
    minify: "terser",
    // Revisit expressions exposed by the first pass without changing compression safety defaults.
    terserOptions: { compress: { passes: 2 } },
    rollupOptions: {
      output: {
        // Related desk copy shares vocabulary. Compress these lazy catalogues together
        // without pulling its dependencies (or either screen) into the entry bundle.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("/protocol-adapter/vendor/kix-sdk-0/") && id.endsWith("?raw")) return "kix-sdk0-bytes";
          if (/\/protocol-adapter\/src\/(openapi-contract-pin|integration-gate-pin)\.ts$/.test(id) || /\/vendor\/kix-protocol\..*\.json\?raw$/.test(id)) return "kix-openapi-pins";
          if (/\/protocol-adapter\/src\/contract-fixtures\.ts$/.test(id)) return "kix-fixture-catalogue";
          if (/\/protocol-adapter\/src\/(operational-qualification|operational-qualification-controller|platform-release|cross-surface-journeys)\.ts$/.test(id)) return "kix-review-cases";
          if (/\/protocol-adapter\/src\/(finance-operations|tenant-permissions|delegated-assistant)\.ts$/.test(id)) return "kix-operations-cases";
          if (/\/protocol-adapter\/src\/(platform-journey|provider-journey|refund-return|installable-mobile|inventory-read|discovery-read|marketplace-performance)\.ts$/.test(id)) return "kix-journey-cases";

          const copy = /\/src\/i18n\/messages\/([^/]+)\.ts$/.exec(id)?.[1];
          if (copy) return displayCopyGroups.find(([, files]) => files.includes(copy))?.[0];
        },
      },
    },
  },
  resolve: {
    alias: {
      "@kix/protocol-adapter": path.resolve(appDir, "../../packages/protocol-adapter/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
