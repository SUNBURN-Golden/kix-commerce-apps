/**
 * Information architecture for the buyer, organizer, and operator desks.
 * Field names and recorded status only. This module does not import the
 * protocol adapter, does not build a command body, and does not call fetch.
 * Tests compare these names with the locked bindings and the pinned actions.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const WORKSPACE_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const WORKSPACE_ROLES = ["buyer", "organizer", "operator"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SURFACE_BINDINGS = [
  "published-bound",
  "not-bound",
  "stub-only",
  "no-published-command",
  "planned",
] as const;

export type SurfaceBinding = (typeof SURFACE_BINDINGS)[number];

/** Reservation, payment, issuance, and admission stay four badges. */
export const OUTCOME_TRACKS = ["reservation", "payment", "issuance", "admission"] as const;

export type OutcomeTrack = (typeof OUTCOME_TRACKS)[number];

/**
 * Per-track screen vocabulary. There is no aggregate completion state.
 * `confirmed` is one track's own receipt, not a finished journey.
 */
export const TRACK_STATES = [
  "loading",
  "empty",
  "error",
  "in-flight",
  "confirmed",
  "rejected",
  "unknown",
  "not-sent",
  "fenced",
  "not-bound",
  "stale",
  "unavailable",
] as const;

export type TrackState = (typeof TRACK_STATES)[number];

export const WORKSPACE_SENDERS = ["BookingJourney", "OrganizerConsole", "GiftTransfer", "ConsentBind"] as const;

export type WorkspaceSender = (typeof WORKSPACE_SENDERS)[number];

export const SENDER_ACTIONS = {
  BookingJourney: ["create_event", "prepare_trade", "accept_trade"],
  OrganizerConsole: [
    "create_event",
    "close_sales",
    "open_admission",
    "complete_event",
    "cancel_event",
    "issue_invitation",
  ],
  GiftTransfer: ["offer_gift", "accept_gift", "cancel_gift"],
  ConsentBind: ["set_consent", "authorize_marketing"],
} as const satisfies Record<WorkspaceSender, readonly string[]>;

/**
 * Catalogue actions no sender in this registry posts.
 * `open_admission` is absent here because OrganizerConsole posts it.
 * `refund_ticket` is pinned and has no not-composed row on the journey helper.
 * The journey map records that the journey does not map it.
 * The monetary posting named by settlementPreview.consideredAction is not spelled
 * in this file. apps/web/src must not contain that token. The workspace test
 * reads it from the locked binding and treats it as never sent.
 */
export const NEVER_SENT_ACTIONS = ["capture", "commit_trade", "admit", "refund_ticket"] as const;

/** Locked desk method whose consideredAction is the monetary posting no sender posts. */
export const UNSENT_MONETARY_POSTING_METHOD = "settlementPreview" as const;

/**
 * Quote of the locked placeHold binding. H1 keeps this consideredAction.
 * prepare_trade is only a BookingJourney body. This record does not map placeHold onto it.
 */
export const PLACE_HOLD_RECORD = {
  method: "placeHold",
  status: "not-bound",
  consideredAction: "reserve_listing",
  mappedOntoPrepareTrade: false,
  reason:
    "placeHold({ eventId, quantity }) does not match reserve_listing, which requires domain, expiresAt, listingHash, listingId, and tradeId.",
} as const;

export interface TrackStateContract {
  readonly copy: string;
  readonly writes: "disabled" | "supported-action-on-this-track-only";
  readonly provenance: string;
}

/** Same contract for every surface. Apply it once per outcome track. */
export const TRACK_STATE_CONTRACT = {
  loading: {
    copy: "This track is loading.",
    writes: "disabled",
    provenance: "No receipt on this track.",
  },
  empty: {
    copy: "This track has no receipt yet.",
    writes: "supported-action-on-this-track-only",
    provenance: "No receipt on this track.",
  },
  error: {
    copy: "This track hit a local error.",
    writes: "disabled",
    provenance: "No new receipt.",
  },
  "in-flight": {
    copy: "This track has one request in flight.",
    writes: "disabled",
    provenance: "One attempt. No retry.",
  },
  confirmed: {
    copy: "This track has a confirmed receipt for its own action.",
    writes: "disabled",
    provenance: "Receipt for this action only. Stub-shape receipts are not from the gate.",
  },
  rejected: {
    copy: "This track was rejected.",
    writes: "disabled",
    provenance: "A rejection stays on this track.",
  },
  unknown: {
    copy: "This track is unknown.",
    writes: "disabled",
    provenance: "Unknown stays on this track. It is a separate state from rejected.",
  },
  "not-sent": {
    copy: "This track was not sent.",
    writes: "disabled",
    provenance: "Nothing was posted.",
  },
  fenced: {
    copy: "This track is fenced.",
    writes: "disabled",
    provenance: "A later write waits for a new page load.",
  },
  "not-bound": {
    copy: "This track is not-bound.",
    writes: "disabled",
    provenance: "The desk method stays not-bound.",
  },
  stale: {
    copy: "This track is stale.",
    writes: "disabled",
    provenance: "A stale response does not update this track.",
  },
  unavailable: {
    copy: "This track is unavailable.",
    writes: "disabled",
    provenance: "The desk stays on the selected adapter. There is no stub fallback.",
  },
} as const satisfies Record<TrackState, TrackStateContract>;

export interface WorkspaceSurface {
  readonly id: string;
  readonly role: WorkspaceRole;
  readonly route: string;
  readonly binding: SurfaceBinding;
  readonly sender: WorkspaceSender | null;
  readonly actions: readonly string[];
  readonly deskMethods: readonly string[];
  readonly provenanceNote: string;
  readonly taskId: string;
  readonly implemented: boolean;
  readonly pageControl: boolean;
}

export const WORKSPACE_SURFACES = [
  {
    id: "box-office-catalog",
    role: "buyer",
    route: "/",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: ["listPerformances"],
    provenanceNote:
      "Stub catalog. The contract-only catalogue has no list or read command. listPerformances stays on the stub. Booking, resale, credit, and M02 also read this list. That read is not a catalogue command.",
    taskId: "readme-box-office",
    implemented: true,
    pageControl: true,
  },
  {
    id: "box-office-journey-view",
    role: "buyer",
    route: "/",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Read-only view of journeys opened on this page load. This route does not send the booking journey. A journey receipt shown here is not a new post.",
    taskId: "w6a-ui-skeleton",
    implemented: true,
    pageControl: true,
  },
  {
    id: "box-office-settlement",
    role: "organizer",
    route: "/",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [
      "initiateSettlement",
      "authorizeSettlement",
      "captureSettlement",
      "commitSettlement",
      "failSettlement",
      "cancelSettlement",
      "reconcileSettlement",
      "viewSettlement",
    ],
    provenanceNote:
      "Mock F01–F03 case on the stub. captureSettlement is a mock phase name. commitSettlement is not commit_trade. The monetary posting stays unsent. Shares are not computed here.",
    taskId: "settlement-depth",
    implemented: true,
    pageControl: true,
  },
  {
    id: "booking-journey",
    role: "buyer",
    route: "/booking/:eventId",
    binding: "published-bound",
    sender: "BookingJourney",
    actions: SENDER_ACTIONS.BookingJourney,
    deskMethods: ["placeHold", "releaseHold", "confirmBooking"],
    provenanceNote:
      "BookingJourney posts create_event, then prepare_trade, then accept_trade. Nothing past accept_trade is composed. placeHold stays not-bound with consideredAction reserve_listing. placeHold({ eventId, quantity }) is not mapped onto prepare_trade. confirmBooking stays not-bound and does not send capture. Desk methods stay not-bound.",
    taskId: "w6a-journey-adapter",
    implemented: true,
    pageControl: true,
  },
  {
    id: "reservation-case",
    role: "buyer",
    route: "/booking/:eventId",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [
      "advanceReservationClock",
      "registerReservationShow",
      "holdReservation",
      "releaseReservation",
      "confirmReservation",
      "cancelReservation",
      "observeReservationPayment",
      "bindReservationSettlement",
      "issueReservation",
      "authorizeReservationAdmission",
      "consumeReservation",
      "reconcileReservation",
      "viewReservation",
      "viewReservationShow",
    ],
    provenanceNote:
      "Mock B01–B05 case. The same desk is mounted on /admission. Stub phases are not catalogue commands. issueReservation does not send capture. The admission page does not treat this case as entry.",
    taskId: "reservation-depth",
    implemented: true,
    pageControl: true,
  },
  {
    id: "admission-credential",
    role: "buyer",
    route: "/admission",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [
      "advanceAdmissionClock",
      "adoptAdmissionIssued",
      "authorizeAdmissionCredential",
      "consumeAdmissionCredential",
      "reconcileAdmission",
      "presentAdmission",
    ],
    provenanceNote:
      "Mock credential labels: valid, invalid, stale, already-consumed, transferred, cancelled, unavailable-server. The adapter assigns the label. presentAdmission does not post admit. A loopback health probe is not entry.",
    taskId: "admission-harden",
    implemented: true,
    pageControl: true,
  },
  {
    id: "resale-desk",
    role: "buyer",
    route: "/resale",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [
      "listResale",
      "openResale",
      "acceptResale",
      "advanceResaleClock",
      "adoptResaleIssued",
      "listResaleCase",
      "holdResaleBuy",
      "releaseResaleHold",
      "cancelResaleListing",
      "observeResalePayment",
      "bindResaleSettlement",
      "acceptResaleTransfer",
      "closeResaleListing",
      "reconcileResale",
      "viewResaleCase",
      "viewResaleRight",
      "rejectExternalResale",
    ],
    provenanceNote:
      "Mock R01–R05 case. acceptResale stays not-bound and is not accept_trade. rejectExternalResale is an in-memory refusal. This desk is not a live marketplace.",
    taskId: "resale-depth",
    implemented: true,
    pageControl: true,
  },
  {
    id: "gift-transfer",
    role: "buyer",
    route: "/gift",
    binding: "published-bound",
    sender: "GiftTransfer",
    actions: SENDER_ACTIONS.GiftTransfer,
    deskMethods: [],
    provenanceNote:
      "GiftTransfer posts offer_gift, then accept_gift or cancel_gift. offer_gift is not a credit draw. ticketId is caller input. The journey does not produce the giftable right. Stub-shape receipts are not from the gate.",
    taskId: "gift-surface",
    implemented: true,
    pageControl: true,
  },
  {
    id: "credit-desk",
    role: "operator",
    route: "/credit",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [
      "offerCredit",
      "approveCredit",
      "rejectCredit",
      "cancelCredit",
      "bindCreditSettlement",
      "drawCredit",
      "repayCredit",
      "closeCredit",
      "defaultCredit",
      "reconcileCredit",
      "viewCredit",
      "rejectUnsupportedCredit",
    ],
    provenanceNote:
      "Mock F04 case. drawCredit is not a disbursement. rejectUnsupportedCredit refuses a disburse shape. The catalogue has no credit command. offer_gift is not a draw.",
    taskId: "credit-depth",
    implemented: true,
    pageControl: true,
  },
  {
    id: "organizer-console",
    role: "organizer",
    route: "/organizer",
    binding: "published-bound",
    sender: "OrganizerConsole",
    actions: SENDER_ACTIONS.OrganizerConsole,
    deskMethods: [],
    provenanceNote:
      "OrganizerConsole posts create_event, close_sales, open_admission, complete_event, cancel_event, and issue_invitation. BookingJourney still does not compose open_admission. Seats and inventory ids are caller input. This record does not compute capacity. The operator actor string is not an authentication result. Stub-shape receipts are not from the gate.",
    taskId: "organizer-admin-console",
    implemented: true,
    pageControl: true,
  },
  {
    id: "operator-transport",
    role: "operator",
    route: "/",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Shell banner on every route. Route changes and the 15 second probe compare generation. A probe is liveness, not payment, issuance, or admission. Browser HTTP stays unavailable. There is no proxy and no stub fallback. UNKNOWN fences the next write.",
    taskId: "http-integration-gate",
    implemented: true,
    pageControl: true,
  },
  {
    id: "operator-unshown-desk",
    role: "operator",
    route: "/",
    binding: "not-bound",
    sender: null,
    actions: [],
    deskMethods: [
      "getBooking",
      "checkAdmission",
      "settlementPreview",
      "rejectExternalSettlement",
      "rejectExternalReservation",
      "rejectExternalAdmission",
      "viewResalePresentation",
    ],
    provenanceNote:
      "Protocol methods with no page control. checkAdmission stays not-bound and the admission page does not call it. settlementPreview stays a mock pointer and does not send the monetary posting. rejectExternalSettlement, rejectExternalReservation, and rejectExternalAdmission are in-memory refusals. getBooking and viewResalePresentation have no catalogue read.",
    taskId: "readme-operator-desk",
    implemented: true,
    pageControl: false,
  },
  {
    id: "marketing-hub",
    role: "buyer",
    route: "/marketing",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Session stub for M01–M05. M01–M04 stay 설계중. M05 stays 미착수. The hub does not call booking, resale, admission, settlement, or credit writes.",
    taskId: "w7-marketing-align",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-m01",
    role: "buyer",
    route: "/marketing/m01",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote: "M01 fan qualification / membership. 설계중. No published command. Session stub only.",
    taskId: "w7-marketing-align",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-m02",
    role: "buyer",
    route: "/marketing/m02",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "M02 presale. 설계중. No published command. The display read is listPerformances, owned by box-office-catalog. A presale note does not place a hold.",
    taskId: "w7-marketing-align",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-m03",
    role: "buyer",
    route: "/marketing/m03",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote: "M03 coupon / promotion. 설계중. No published command. Session markers are not a catalogue command.",
    taskId: "w7-marketing-align",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-m04",
    role: "buyer",
    route: "/marketing/m04",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote: "M04 referral / rewards. 설계중. No published command. Markers are not a payout.",
    taskId: "w7-marketing-align",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-m05",
    role: "buyer",
    route: "/marketing/m05",
    binding: "published-bound",
    sender: "ConsentBind",
    actions: SENDER_ACTIONS.ConsentBind,
    deskMethods: [],
    provenanceNote:
      "ConsentBind posts set_consent, then authorize_marketing. The ORIGINAL_32 label stays 미착수. Session flags keep channelSend none and are not the set_consent body. The actor string is not an authentication result. Stub-shape receipts are not from the gate.",
    taskId: "w7-m05-consent-bind",
    implemented: true,
    pageControl: true,
  },
  {
    id: "planned-discovery",
    role: "buyer",
    route: "/discovery",
    binding: "planned",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote: "NOT_IMPLEMENTED. Search and filters wait for c-discovery-prototype. No list command is published. This row is not a working search.",
    taskId: "c-discovery-prototype",
    implemented: false,
    pageControl: false,
  },
  {
    id: "buyer-workspace",
    role: "buyer",
    route: "/buyer",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Read-only page over receipts already opened on this page load. Selection, reservation, order, and issuance stay separate rows. Writes stay on /booking/:eventId and /gift. A reload clears page-load state and re-sends nothing. Stub-shape receipts are not from the gate.",
    taskId: "c-buyer-workspace",
    implemented: true,
    pageControl: true,
  },
  {
    id: "planned-organizer-workspace",
    role: "organizer",
    route: "/organizer/workspace",
    binding: "planned",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "NOT_IMPLEMENTED. Editing lifecycle, quantity, and sales preview waits for c-organizer-workspace. The current console remains /organizer.",
    taskId: "c-organizer-workspace",
    implemented: false,
    pageControl: false,
  },
  {
    id: "planned-receipt-explorer",
    role: "operator",
    route: "/receipts",
    binding: "planned",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "NOT_IMPLEMENTED. Receipt explanation for the buyer and the operator waits for c-receipt-explorer. A read does not turn unknown into confirmed.",
    taskId: "c-receipt-explorer",
    implemented: false,
    pageControl: false,
  },
  {
    id: "planned-accessibility",
    role: "buyer",
    route: "/",
    binding: "planned",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "NOT_IMPLEMENTED. Keyboard, mobile, amount, and time presentation across buyer, organizer, and operator screens waits for c-accessibility-baseline. This row adds no route.",
    taskId: "c-accessibility-baseline",
    implemented: false,
    pageControl: false,
  },
] as const satisfies readonly WorkspaceSurface[];

export interface BuyerFlowStage {
  readonly id: (typeof BUYER_FLOW_STAGE_IDS)[number];
  readonly surfaces: readonly string[];
  readonly tracks: readonly OutcomeTrack[];
  readonly note: string;
}

export const BUYER_FLOW_STAGE_IDS = [
  "discovery",
  "selection",
  "reservation",
  "payment",
  "issuance",
  "admission",
  "refund",
] as const;

export const BUYER_FLOW_STAGES = [
  {
    id: "discovery",
    surfaces: ["box-office-catalog", "planned-discovery"],
    tracks: [],
    note: "발견. The stub catalog is the current list. Planned search is NOT_IMPLEMENTED. No outcome badge.",
  },
  {
    id: "selection",
    surfaces: ["box-office-catalog", "booking-journey", "buyer-workspace"],
    tracks: [],
    note: "선택. Choosing a show opens /booking/:eventId. Selection has no outcome badge.",
  },
  {
    id: "reservation",
    surfaces: ["booking-journey", "reservation-case", "buyer-workspace"],
    tracks: ["reservation"],
    note: "예약. placeHold stays not-bound. prepare_trade is a BookingJourney body. The mock reservation case stays stub-only.",
  },
  {
    id: "payment",
    surfaces: ["booking-journey", "box-office-settlement", "buyer-workspace"],
    tracks: ["payment"],
    note: "결제 상태. confirmBooking does not send capture. The mock settlement case stays stub-only. Price and fee display policy is UNDETERMINED.",
  },
  {
    id: "issuance",
    surfaces: ["reservation-case", "organizer-console", "gift-transfer", "buyer-workspace"],
    tracks: ["issuance"],
    note: "권리. issueReservation is stub-only. issue_invitation is the organizer post. A gift transfers a caller-supplied right and does not mint one.",
  },
  {
    id: "admission",
    surfaces: ["admission-credential", "organizer-console"],
    tracks: ["admission"],
    note: "입장. The credential label is not admit. open_admission on the organizer console is a separate post. A health probe is not entry.",
  },
  {
    id: "refund",
    surfaces: ["operator-unshown-desk"],
    tracks: ["payment"],
    note: "환불. refund_ticket is pinned and no surface sends it. Status stays not-bound. COMPENSATION_UNDEFINED stays visible. Refund policy values are UNDETERMINED.",
  },
] as const satisfies readonly BuyerFlowStage[];

const SURFACE_INDEX = new Map<string, WorkspaceSurface>(WORKSPACE_SURFACES.map((surface) => [surface.id, surface]));

const STAGE_INDEX = new Map<string, BuyerFlowStage>(BUYER_FLOW_STAGES.map((stage) => [stage.id, stage]));

/** Binding, sender, and provenance. Does not say a surface works. */
export function surfaceBindingLine(id: string): string {
  const surface = SURFACE_INDEX.get(id);
  if (!surface) {
    return `Surface ${id} is absent from the workspace registry.`;
  }
  const sender = surface.sender ?? "none";
  const actions = surface.actions.length > 0 ? surface.actions.join(", ") : "none";
  const desk =
    surface.deskMethods.length > 0
      ? ` Desk methods stay not-bound: ${surface.deskMethods.join(", ")}.`
      : "";
  const presence = surface.implemented ? "Current route." : "NOT_IMPLEMENTED.";
  const control = surface.pageControl ? "Page control." : "No page control.";
  return `${surface.id} role ${surface.role} route ${surface.route}. Binding ${surface.binding}. Sender ${sender}. Actions ${actions}.${desk} ${presence} ${control} ${surface.provenanceNote}`;
}

/** One badge line for the stage's own tracks. */
export function stageLine(id: string): string {
  const stage = STAGE_INDEX.get(id);
  if (!stage) {
    return `Stage ${id} is absent from the buyer flow.`;
  }
  const badges =
    stage.tracks.length === 0
      ? "No outcome track on this stage."
      : stage.tracks.map((track) => `${track} stays its own badge`).join(". ") + ".";
  return `Stage ${stage.id}. ${badges} ${stage.note}`;
}
