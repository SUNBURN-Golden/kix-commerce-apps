import { computeBuildIdentity } from "./build-identity";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localeCopyTemplates } from "./build-locale-copy";

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
    "pages--CommerceJourneyPanel",
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
  plugins: [localeCopyTemplates(), react()],
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
          if (/\/protocol-adapter\/src\/(finance-operations|tenant-permissions|delegated-assistant|merchant-operations)\.ts$/.test(id)) return "kix-operations-cases";
          if (/\/protocol-adapter\/src\/(platform-journey|provider-journey|refund-return(?:-controller)?|installable-mobile|inventory-read|discovery-read|marketplace-performance)\.ts$/.test(id)) return "kix-journey-cases";

          // Both fixture journeys share the command templates, receipt guards and mock dispatch.
          if (/\/protocol-adapter\/src\/(commerce-journey(?:-(command|fixture|receipts|stub))?|resale-journey(?:-fixture)?)\.ts$/.test(id)) return "commerce-fixture-journeys";

          // The session stubs share forms, fixtures and bilingual copy. Keep them in one
          // lazy chunk so repeated markup and vocabulary compress together.
          if (/\/src\/(pages\/marketing\/(Hub|M01Membership|M02Presale|M03Coupons|M04Rewards|M05Consent|MarketingChrome)|marketing\/(desk|fixtures|session|useMarketingSnapshot))\.tsx?$/.test(id)
            || /\/src\/i18n\/messages\/(marketing--desk|pages--marketing--(Hub|M01Membership|M02Presale|M03Coupons|M04Rewards|M05Consent|MarketingChrome))\.ts$/.test(id)) return "marketing-stubs";

          // The fault build substitutes this for marketing/session. Preserve the same
          // chunk boundary so its constructor can use the desk before page modules run.
          if (id.endsWith("/e2e/shell-fixtures/marketing-session.ts")) return "marketing-stubs";

          // These secondary commerce desks share forms and panel markup. Compress them together
          // as one lazy module; the landing, Gift, Admission and Credit keep separate lazy boundaries.
          if (/\/src\/pages\/(Booking|Buyer|Resale(Panel)?|Organizer(?:Workspace|Panel)?|ReservationPanel)\.tsx$/.test(id)) return "commerce-desks";
          // The box office's refund controller ships with its source above.
          // The other synthetic controllers share compression in a separate chunk.
          if (/\/protocol-adapter\/src\/(marketing-journey-controller|delegated-assistant-controller|credit-servicing-controller)\.ts$/.test(id)) return "synthetic-controllers";

          // The two bounded read desks share lifecycle fencing and status markup.
          // Compress them together behind their existing lazy route boundaries.
          if (/\/src\/(pages\/(Discovery|DiscoveryPanels|Inventory|InventoryPanels)|discovery-live|inventory-venue|read-lifecycle)\.tsx?$/.test(id)) return "read-desks";

          // Small UI helpers that many lazy desks share load as one lazy chunk; the entry never imports them.
          if (/\/src\/(a11y\/focus|components\/(AsyncState|CachedReadNotice|ConnectivityWriteButton)|connectivity\/(copy|desk-protocol|refusal|write-guard)|desk-attempts|i18n\/desk-context)\.tsx?$/.test(id)) return "desk-ui";

          // Keep secondary routes lazy while sharing compression across their repeated panels.
          if (/\/src\/pages\/(Platform|ProviderJourney|InstallableMobile)(Panels)?\.tsx$/.test(id)) return "Platform";
          if (/\/src\/pages\/(Assistant|MarketingJourney)(Panels)?\.tsx$/.test(id)) return "Assistant";
          if (/\/src\/pages\/(PlatformRelease|OperationalQualification)(Panels)?\.tsx$/.test(id)) return "PlatformRelease";
          if (/\/src\/((organizer|consent|gift)-desk|organizer-workspace)\.ts$/.test(id)) return "catalogue-desks";
          // The box office, booking and buyer pages all use the journey and refund controls.
          if (/\/src\/(journey-desk|refund-return|pages\/(RefundReturnPanel|JourneyPanel))\.tsx?$/.test(id)) return "refund-and-booking";

          // The journey labels reuse the booking and resale desk dictionaries.
          if (id.endsWith("/src/i18n/desk-catalogue.ts")) return "display-copy-5";
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
