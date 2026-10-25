import { messages as readStateMessages } from "./messages/read-state";
import { messages as galleryMessages } from "./messages/gallery";
import { messages as mergedMessages } from "./messages/merged-surfaces";
/** Type/test inventory only; browser routes import their own bundles. */
import { messages as deskMessages } from "./desk-catalogue";
import { messages as m0 } from "./messages/a11y--present";
import { messages as m1 } from "./messages/admission-desk";
import { messages as m2 } from "./messages/buyer-workspace";
import { messages as m3 } from "./messages/consent-desk";
import { messages as m4 } from "./messages/credit-desk";
import { messages as m5 } from "./messages/credit-origination";
import { messages as m6 } from "./messages/credit-servicing";
import { messages as m7 } from "./messages/cross-surface-journeys";
import { messages as m8 } from "./messages/delegated-assistant";
import { messages as m9 } from "./messages/discovery--fixture";
import { messages as m10 } from "./messages/discovery--model";
import { messages as m11 } from "./messages/discovery-live";
import { messages as m12 } from "./messages/discovery-workspace";
import { messages as m13 } from "./messages/finance-operations";
import { messages as m14 } from "./messages/gift-desk";
import { messages as m15 } from "./messages/guide--status-words";
import { messages as m16 } from "./messages/handoff--packet";
import { messages as m17 } from "./messages/installable-mobile";
import { messages as m18 } from "./messages/inventory-venue";
import { messages as m19 } from "./messages/journey-desk";
import { messages as m20 } from "./messages/journey-identity";
import { messages as m21 } from "./messages/marketing--contracts";
import { messages as m22 } from "./messages/marketing--desk";
import { messages as m23 } from "./messages/marketing--labels";
import { messages as m24 } from "./messages/marketing-journey";
import { messages as m25 } from "./messages/marketplace-performance";
import { messages as m26 } from "./messages/merchant-operations";
import { messages as m27 } from "./messages/notification-inbox";
import { messages as m28 } from "./messages/operational-qualification";
import { messages as m29 } from "./messages/organizer-desk";
import { messages as m30 } from "./messages/organizer-workspace";
import { messages as m31 } from "./messages/pages--Admission";
import { messages as m32 } from "./messages/pages--AdmissionCredentialPanel";
import { messages as m33 } from "./messages/pages--Assistant";
import { messages as m34 } from "./messages/pages--AssistantPanels";
import { messages as m35 } from "./messages/pages--Booking";
import { messages as m36 } from "./messages/pages--BuyerPanels";
import { messages as m37 } from "./messages/pages--Credit";
import { messages as m38 } from "./messages/pages--CreditOrigination";
import { messages as m39 } from "./messages/pages--CreditOriginationPanels";
import { messages as m40 } from "./messages/pages--CreditPanel";
import { messages as m41 } from "./messages/pages--CreditServicing";
import { messages as m42 } from "./messages/pages--CreditServicingPanels";
import { messages as m43 } from "./messages/pages--CrossSurfaceJourneysPanels";
import { messages as m44 } from "./messages/pages--Discovery";
import { messages as m45 } from "./messages/pages--DiscoveryPanels";
import { messages as m46 } from "./messages/pages--Finance";
import { messages as m47 } from "./messages/pages--FinancePanels";
import { messages as m48 } from "./messages/pages--Gift";
import { messages as m49 } from "./messages/pages--GiftPanel";
import { messages as m50 } from "./messages/pages--Handoff";
import { messages as m51 } from "./messages/pages--Help";
import { messages as m52 } from "./messages/pages--InstallableMobile";
import { messages as m53 } from "./messages/pages--InstallableMobilePanels";
import { messages as m54 } from "./messages/pages--Inventory";
import { messages as m55 } from "./messages/pages--InventoryPanels";
import { messages as m56 } from "./messages/pages--JourneyIdentityPanels";
import { messages as m57 } from "./messages/pages--JourneyPanel";
import { messages as m58 } from "./messages/pages--MarketingJourney";
import { messages as m59 } from "./messages/pages--MarketingJourneyPanels";
import { messages as m60 } from "./messages/pages--MarketplacePerformance";
import { messages as m61 } from "./messages/pages--MarketplacePerformancePanels";
import { messages as m62 } from "./messages/pages--Merchant";
import { messages as m63 } from "./messages/pages--MerchantPanels";
import { messages as m64 } from "./messages/pages--Notifications";
import { messages as m65 } from "./messages/pages--NotificationsPanels";
import { messages as m66 } from "./messages/pages--OperationalQualification";
import { messages as m67 } from "./messages/pages--OperationalQualificationPanels";
import { messages as m68 } from "./messages/pages--Organizer";
import { messages as m69 } from "./messages/pages--OrganizerPanel";
import { messages as m70 } from "./messages/pages--OrganizerWorkspace";
import { messages as m71 } from "./messages/pages--Platform";
import { messages as m72 } from "./messages/pages--PlatformPanels";
import { messages as m73 } from "./messages/pages--PlatformRelease";
import { messages as m74 } from "./messages/pages--PlatformReleasePanels";
import { messages as m75 } from "./messages/pages--ProviderJourney";
import { messages as m76 } from "./messages/pages--ProviderJourneyPanels";
import { messages as m77 } from "./messages/pages--Receipts";
import { messages as m78 } from "./messages/pages--RefundReturnPanel";
import { messages as m79 } from "./messages/pages--Resale";
import { messages as m80 } from "./messages/pages--ResalePanel";
import { messages as m81 } from "./messages/pages--ReservationPanel";
import { messages as m82 } from "./messages/pages--SessionRecoveryPanels";
import { messages as m83 } from "./messages/pages--SettlementPanel";
import { messages as m84 } from "./messages/pages--TenantPermissions";
import { messages as m85 } from "./messages/pages--TenantPermissionsPanels";
import { messages as m86 } from "./messages/pages--marketing--Hub";
import { messages as m87 } from "./messages/pages--marketing--M01Membership";
import { messages as m88 } from "./messages/pages--marketing--M02Presale";
import { messages as m89 } from "./messages/pages--marketing--M03Coupons";
import { messages as m90 } from "./messages/pages--marketing--M04Rewards";
import { messages as m91 } from "./messages/pages--marketing--M05Consent";
import { messages as m92 } from "./messages/pages--marketing--MarketingChrome";
import { messages as m93 } from "./messages/platform-journey";
import { messages as m94 } from "./messages/platform-release";
import { messages as m95 } from "./messages/provider-journey";
import { messages as m96 } from "./messages/receipt-explorer";
import { messages as m97 } from "./messages/refund-return";
import { messages as m98 } from "./messages/resale-desk";
import { messages as m99 } from "./messages/reservation-desk";
import { messages as m100 } from "./messages/session-recovery";
import { messages as m101 } from "./messages/storage-allow-list";
import { messages as m102 } from "./messages/tenant-permissions";
import { messages as m103 } from "./messages/workspace--registry";
export const messages = { en: { ...readStateMessages.en,
...mergedMessages.en,
...galleryMessages.en,
...deskMessages.en,
...m0.en,
...m1.en,
...m2.en,
...m3.en,
...m4.en,
...m5.en,
...m6.en,
...m7.en,
...m8.en,
...m9.en,
...m10.en,
...m11.en,
...m12.en,
...m13.en,
...m14.en,
...m15.en,
...m16.en,
...m17.en,
...m18.en,
...m19.en,
...m20.en,
...m21.en,
...m22.en,
...m23.en,
...m24.en,
...m25.en,
...m26.en,
...m27.en,
...m28.en,
...m29.en,
...m30.en,
...m31.en,
...m32.en,
...m33.en,
...m34.en,
...m35.en,
...m36.en,
...m37.en,
...m38.en,
...m39.en,
...m40.en,
...m41.en,
...m42.en,
...m43.en,
...m44.en,
...m45.en,
...m46.en,
...m47.en,
...m48.en,
...m49.en,
...m50.en,
...m51.en,
...m52.en,
...m53.en,
...m54.en,
...m55.en,
...m56.en,
...m57.en,
...m58.en,
...m59.en,
...m60.en,
...m61.en,
...m62.en,
...m63.en,
...m64.en,
...m65.en,
...m66.en,
...m67.en,
...m68.en,
...m69.en,
...m70.en,
...m71.en,
...m72.en,
...m73.en,
...m74.en,
...m75.en,
...m76.en,
...m77.en,
...m78.en,
...m79.en,
...m80.en,
...m81.en,
...m82.en,
...m83.en,
...m84.en,
...m85.en,
...m86.en,
...m87.en,
...m88.en,
...m89.en,
...m90.en,
...m91.en,
...m92.en,
...m93.en,
...m94.en,
...m95.en,
...m96.en,
...m97.en,
...m98.en,
...m99.en,
...m100.en,
...m101.en,
...m102.en,
...m103.en,
}, ko: { ...readStateMessages.ko,
...mergedMessages.ko,
...galleryMessages.ko,
...deskMessages.ko,
...m0.ko,
...m1.ko,
...m2.ko,
...m3.ko,
...m4.ko,
...m5.ko,
...m6.ko,
...m7.ko,
...m8.ko,
...m9.ko,
...m10.ko,
...m11.ko,
...m12.ko,
...m13.ko,
...m14.ko,
...m15.ko,
...m16.ko,
...m17.ko,
...m18.ko,
...m19.ko,
...m20.ko,
...m21.ko,
...m22.ko,
...m23.ko,
...m24.ko,
...m25.ko,
...m26.ko,
...m27.ko,
...m28.ko,
...m29.ko,
...m30.ko,
...m31.ko,
...m32.ko,
...m33.ko,
...m34.ko,
...m35.ko,
...m36.ko,
...m37.ko,
...m38.ko,
...m39.ko,
...m40.ko,
...m41.ko,
...m42.ko,
...m43.ko,
...m44.ko,
...m45.ko,
...m46.ko,
...m47.ko,
...m48.ko,
...m49.ko,
...m50.ko,
...m51.ko,
...m52.ko,
...m53.ko,
...m54.ko,
...m55.ko,
...m56.ko,
...m57.ko,
...m58.ko,
...m59.ko,
...m60.ko,
...m61.ko,
...m62.ko,
...m63.ko,
...m64.ko,
...m65.ko,
...m66.ko,
...m67.ko,
...m68.ko,
...m69.ko,
...m70.ko,
...m71.ko,
...m72.ko,
...m73.ko,
...m74.ko,
...m75.ko,
...m76.ko,
...m77.ko,
...m78.ko,
...m79.ko,
...m80.ko,
...m81.ko,
...m82.ko,
...m83.ko,
...m84.ko,
...m85.ko,
...m86.ko,
...m87.ko,
...m88.ko,
...m89.ko,
...m90.ko,
...m91.ko,
...m92.ko,
...m93.ko,
...m94.ko,
...m95.ko,
...m96.ko,
...m97.ko,
...m98.ko,
...m99.ko,
...m100.ko,
...m101.ko,
...m102.ko,
...m103.ko,
} } as const;

export const BUNDLES = [readStateMessages,galleryMessages,mergedMessages,deskMessages, m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20, m21, m22, m23, m24, m25, m26, m27, m28, m29, m30, m31, m32, m33, m34, m35, m36, m37, m38, m39, m40, m41, m42, m43, m44, m45, m46, m47, m48, m49, m50, m51, m52, m53, m54, m55, m56, m57, m58, m59, m60, m61, m62, m63, m64, m65, m66, m67, m68, m69, m70, m71, m72, m73, m74, m75, m76, m77, m78, m79, m80, m81, m82, m83, m84, m85, m86, m87, m88, m89, m90, m91, m92, m93, m94, m95, m96, m97, m98, m99, m100, m101, m102, m103] as const;
