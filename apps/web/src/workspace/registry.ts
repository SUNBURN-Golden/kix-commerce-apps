import { messages as sourceCopy } from "../i18n/messages/workspace--registry";
import { sourceMessage } from "../i18n/source-message";
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

/**
 * Reservation, payment, issuance, admission, return-required, and refund-done
 * stay six separate badges. Return-required is its own state, not a pre-stage
 * of refund-done; refund-done is a synthetic record on this app, never a real
 * refund. There is no aggregate completion state.
 */
export const OUTCOME_TRACKS = ["reservation", "payment", "issuance", "admission", "return-required", "refund-done"] as const;

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

export const WORKSPACE_SENDERS = [sourceCopy.en["sae"], sourceCopy.en["s162"], sourceCopy.en["sml"], sourceCopy.en["sdr"]] as const;

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
    sourceCopy.en["s18a"],
} as const;

export interface TrackStateContract {
  readonly copy: string;
  readonly writes: "disabled" | "supported-action-on-this-track-only";
  readonly provenance: string;
}

/** Same contract for every surface. Apply it once per outcome track. */
export const TRACK_STATE_CONTRACT = {
  loading: {
    copy: sourceCopy.en["s23u"],
    writes: "disabled",
    provenance: sourceCopy.en["sxm"],
  },
  empty: {
    copy: sourceCopy.en["s23q"],
    writes: "supported-action-on-this-track-only",
    provenance: sourceCopy.en["sxm"],
  },
  error: {
    copy: sourceCopy.en["s23s"],
    writes: "disabled",
    provenance: sourceCopy.en["swd"],
  },
  "in-flight": {
    copy: sourceCopy.en["s23r"],
    writes: "disabled",
    provenance: "One attempt. No retry.",
  },
  confirmed: {
    copy: sourceCopy.en["s23p"],
    writes: "disabled",
    provenance: sourceCopy.en["s1dc"],
  },
  rejected: {
    copy: sourceCopy.en["s240"],
    writes: "disabled",
    provenance: sourceCopy.en["s6q"],
  },
  unknown: {
    copy: sourceCopy.en["s23y"],
    writes: "disabled",
    provenance: sourceCopy.en["s25e"],
  },
  "not-sent": {
    copy: sourceCopy.en["s23z"],
    writes: "disabled",
    provenance: sourceCopy.en["s11k"],
  },
  fenced: {
    copy: sourceCopy.en["s23t"],
    writes: "disabled",
    provenance: sourceCopy.en["s2l"],
  },
  "not-bound": {
    copy: sourceCopy.en["s23v"],
    writes: "disabled",
    provenance: sourceCopy.en["s1rs"],
  },
  stale: {
    copy: sourceCopy.en["s23w"],
    writes: "disabled",
    provenance: sourceCopy.en["s8f"],
  },
  unavailable: {
    copy: sourceCopy.en["s23x"],
    writes: "disabled",
    provenance: sourceCopy.en["s1rv"],
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
      sourceCopy.en["s1mv"],
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
      sourceCopy.en["s1c0"],
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
    sender: sourceCopy.en["sae"],
    actions: SENDER_ACTIONS.BookingJourney,
    deskMethods: ["placeHold", "releaseHold", "confirmBooking"],
    provenanceNote:
      sourceCopy.en["saf"],
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
      sourceCopy.en["ssv"],
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
    sender: sourceCopy.en["sml"],
    actions: SENDER_ACTIONS.GiftTransfer,
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["smn"],
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
      sourceCopy.en["ssy"],
    taskId: "credit-depth",
    implemented: true,
    pageControl: true,
  },
  {
    id: "organizer-console",
    role: "organizer",
    route: "/organizer",
    binding: "published-bound",
    sender: sourceCopy.en["s162"],
    actions: SENDER_ACTIONS.OrganizerConsole,
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s164"],
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
      sourceCopy.en["s1k7"],
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
      sourceCopy.en["s1a0"],
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
    sender: sourceCopy.en["sdr"],
    actions: SENDER_ACTIONS.ConsentBind,
    deskMethods: [],
    provenanceNote:
      "ConsentBind posts set_consent, then authorize_marketing. The ORIGINAL_32 label stays 미착수. Session flags keep channelSend none and are not the set_consent body. The actor string is not an authentication result. Stub-shape receipts are not from the gate.",
    taskId: "w7-m05-consent-bind",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketing-journey",
    role: "buyer",
    route: "/marketing/journey",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1ol"],
    taskId: "c-marketing-journey-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "discovery-prototype",
    role: "buyer",
    route: "/discovery",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1oj"],
    taskId: "c-discovery-prototype",
    implemented: true,
    pageControl: true,
  },
  {
    id: "discovery-live-read",
    role: "buyer",
    route: "/discovery",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1os"],
    taskId: "c-discovery-live-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "inventory-venue-select",
    role: "buyer",
    route: "/inventory",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1p7"],
    taskId: "c-inventory-venue-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "platform-journey-trade",
    role: "buyer",
    route: "/platform",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1op"],
    taskId: "c-platform-journey-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "merchant-operations",
    role: "organizer",
    route: "/merchant",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1on"],
    taskId: "c-merchant-operations-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "credit-origination",
    role: "organizer",
    route: "/credit/origination",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1oc"],
    taskId: "c-credit-origination-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "credit-servicing",
    role: "operator",
    route: "/credit/servicing",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1oe"],
    taskId: "c-credit-servicing-journey-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "finance-operations",
    role: "operator",
    route: "/finance",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1oh"],
    taskId: "c-finance-operations-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "delegated-assistant",
    role: "buyer",
    route: "/assistant",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1of"],
    taskId: "c-delegated-assistant-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "provider-connected-journey",
    role: "buyer",
    route: "/provider",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1ou"],
    taskId: "c-provider-connected-journey-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "tenant-permissions",
    role: "operator",
    route: "/permissions",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic tenant permissions on one page: buyer, organizer, settler, and support workspaces on one source, each listing only the resource kinds its role may read. Read-own, read-tenant, read-audit, each proposal capability, the approval, and the sensitive export stay separate capabilities, a change is a proposal a different actor approves, and recorded is not applied — a membership or an account moves only when the source applies it. An assignment carries a generation: a role switch is a new session with cleared rows, a late answer is dropped, and a write under an older generation is rejected role-stale. A hidden control is never the enforcement: the source checks every call and the tests send requests straight to the port. A pasted reference is a direct open; a ref outside the role's kinds or outside the tenant is denied, never substituted. Every payload states six non-claims as false or is refused whole. On integration-http the read, the export, and the requests stay not-bound because kix-protocol:k-operator-contract is not merged, pending node c-tenant-permissions is not promoted, and the contract-only catalogue has no permission read or command. Synthetic rows are not a producer receipt.",
    taskId: "c-tenant-permissions-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "notification-inbox",
    role: "operator",
    route: "/notifications",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic notification inbox on one page: only producer-contracted event kinds are projected, deliveries deduplicate on the source's own key, and a second delivery is dropped and counted. A notification confirms what the source recorded — never an economic effect, and an arrival is not a receipt. A notification carries the grant generation it was issued under: a stale-issued row keeps its place but its offered action resolves nothing, never skipping the current-generation check, and a request built under an older generation is rejected generation-stale. A sensitive detail is withheld at the source unless the role holds read-sensitive. A hidden control is never enforcement: the source checks every read, inquiry, and request, and the tests send requests straight to the port. An offered action is a move, not a send: open-authority moves to the receipts desk and open-support opens the source's own redacted support material. Every payload states seven non-claims as false or is refused whole. On integration-http the read, the inquiry, and the requests stay not-bound because kix-protocol:k-operator-contract is not merged, pending node c-notification-inbox is not promoted, and the contract-only catalogue has no notification read, dedupe, read-state, resolve, or inquiry command. Synthetic rows are not a producer receipt.",
    taskId: "c-notification-inbox-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "marketplace-performance-bench",
    role: "operator",
    route: "/marketplace-performance",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic marketplace scale bench on one page: a lazy 150000-row stream serves only a bounded window, a filter and a page size over the bound are refused rather than clamped, and a cancelled, older, or foreign-context answer is dropped and counted rather than applied. The contended page stays behind a synthetic queue whose admission is browse access only — never a hold, a payment, a right, or entry — and an expired admission grants nothing. A read that stops being ready clears every row: a fast page never confirms a stale price or a stale right. Every settled call is measured once at the browser boundary under its own workload and device labels, the source's offered latency stays a separate label, no producer load figure is mixed into the browser-boundary denominator, and an emulated device profile is never reported as real mobile evidence. On integration-http the read and the queue stay not-bound because kix-protocol:ps-07-scale-qualification is not merged and the contract-only catalogue has no marketplace read, queue, or search command. Synthetic rows are not a producer receipt.",
    taskId: "c-marketplace-performance-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "installable-mobile-shell",
    role: "buyer",
    route: "/mobile",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic installable mobile shell on one page: install, shell update, session reconnect, pass presentation, order confirm, and order withdraw stay six separate writes, each sent once per scope. A stored vault item is a copy that keeps the source's own verdict and verdict instant — shown while the link is down it mints no admission and is never sent as authority, and an expired verdict is never revived by a stored copy. The device clock is report-only: a skewed or missing clock marks stored verdicts clock-uncertain and decides nothing, because the source's own instant is the only expiry authority. An app resume re-executes nothing: it marks the held read resumed and fences every write until an explicit read lands, and an uncertain confirm or withdraw stays unknown and is never retried. A read while the link is down answers offline and the stored items stay labelled cached; a write while the link is down answers unknown and applies nothing. Re-login under another actor reuses no session and no stored copy, and a result from an earlier context is quarantined. Every payload states seven non-claims as false or is refused whole. On integration-http the read and the writes stay not-bound because pending node c-installable-mobile is not promoted and the contract-only catalogue has no install, session, vault, presentation, or device command. Synthetic rows are not a device attestation, an authentication result, a payment, or an admission grant, and a withdrawal record executes nothing.",
    taskId: "c-installable-mobile-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "platform-operational-qualification",
    role: "operator",
    route: "/qualification",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic operational qualification on one page: one run executes the whole matrix over the sibling stub surfaces — normal, decline, stale, unknown, cancel, refund, recovery, and permission-revocation each keep their own exercise record — and records one packet. A journey closes on the terminal state of its whole leg sequence, never on a per-call confirmed; source, device, provider, rights, and finance keep their own unresolved denominators and are never merged into one readiness figure; functional, performance, security, and environment evidence are reported per scope with unverified items marked unverified; and the operational support, incident handoff, and current UI review material are bundled without claiming a completed real-user review. A result that arrives after an actor transition is quarantined and no identity leaks into the new context, and a packet that claims a non-claim is refused whole and leaves the run unknown. The packet only ever states STUB_RUN_RECORDED: it is never promoted to a public deployment, a real-money approval, a service qualification, or real integration, and it states every non-claim as a literal false. On integration-http the run stays not-bound because pending node c-platform-operational-qualification is not promoted, kix-protocol:ps-07-scale-qualification and kix-protocol:cr-10-credit-qualification are not merged, commerce-integration-closeout is unpromoted, and the contract-only catalogue has no qualification command. Synthetic rows are not a producer qualification receipt.",
    taskId: "c-platform-operational-qualification-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "platform-release",
    role: "operator",
    route: "/release",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1oy"],
    taskId: "c-platform-release-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "refund-return-desk",
    role: "buyer",
    route: "/booking/:eventId",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1ox"],
    taskId: "c-refund-return-states-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "journey-identity",
    role: "operator",
    route: "/identity",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic journey context desk on one page: a session binds an app-internal context key of mode, actor, role, domain, source cut generation, pin tuple, and incarnation — never a public identifier and never an authentication result. Every read row is adjudicated before it is used: a row minted under another mode, domain, tuple, actor, role, or session is foreign and is never this journey's evidence, a row on an older cut or behind the watermark floor is stale, and an observation is never a proof of payment, issuance, or admission. An attach is sent once per subject, a lost or late answer keeps that subject blocked, a context or cut change isolates the earlier session, and a stub reset keeps earlier unknowns on record. On integration-http the read and the attach stay not-bound because pending node c-journey-identity is not promoted and the contract-only catalogue has no journey read or evidence command. Synthetic rows are not a producer receipt.",
    taskId: "c-journey-identity-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "session-recovery",
    role: "operator",
    route: "/session",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1p8"],
    taskId: "c-session-recovery-stub",
    implemented: true,
    pageControl: true,
  },
  {
    id: "cross-surface-journeys",
    role: "operator",
    route: "/journeys",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1ow"],
    taskId: "c-cross-surface-journeys-stub",
    implemented: true,
    pageControl: true,
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
      sourceCopy.en["s1bz"],
    taskId: "c-buyer-workspace",
    implemented: true,
    pageControl: true,
  },
  {
    id: "organizer-workspace",
    role: "organizer",
    route: "/organizer/workspace",
    binding: "published-bound",
    sender: sourceCopy.en["s162"],
    actions: SENDER_ACTIONS.OrganizerConsole,
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s16b"],
    taskId: "c-organizer-workspace",
    implemented: true,
    pageControl: true,
  },
  {
    id: "receipt-explorer",
    role: "operator",
    route: "/receipts",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s1by"],
    taskId: "c-receipt-explorer",
    implemented: true,
    pageControl: true,
  },
  {
    id: "accessibility-baseline",
    role: "operator",
    route: "(none)",
    binding: "no-published-command",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      sourceCopy.en["s18v"],
    taskId: "c-accessibility-baseline",
    implemented: true,
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
  "return",
  "refund",
] as const;

export const BUYER_FLOW_STAGES = [
  {
    id: "discovery",
    surfaces: ["box-office-catalog", "discovery-prototype", "discovery-live-read"],
    tracks: [],
    note: "발견. The stub catalog stays on /. Discovery is a synthetic fixture on /discovery, and the projection read on the same page stays synthetic. Search reads no list command. No outcome badge.",
  },
  {
    id: "selection",
    surfaces: ["box-office-catalog", "inventory-venue-select", "booking-journey", "buyer-workspace"],
    tracks: [],
    note: "선택. Choosing a show opens /booking/:eventId. Seat and GA selection is a synthetic page on /inventory and stays local. Selection has no outcome badge.",
  },
  {
    id: "reservation",
    surfaces: ["booking-journey", "reservation-case", "platform-journey-trade", "buyer-workspace"],
    tracks: ["reservation"],
    note: "예약. placeHold stays not-bound. prepare_trade is a BookingJourney body. The mock reservation case stays stub-only.",
  },
  {
    id: "payment",
    surfaces: ["booking-journey", "box-office-settlement", "platform-journey-trade", "provider-connected-journey", "buyer-workspace"],
    tracks: ["payment"],
    note: "결제 상태. confirmBooking does not send capture. The mock settlement case stays stub-only. The provider journey records a synthetic redirect, return, and observation; a return landing is not a payment observation. Price and fee display policy is UNDETERMINED.",
  },
  {
    id: "issuance",
    surfaces: ["reservation-case", "organizer-console", "organizer-workspace", "gift-transfer", "platform-journey-trade", "provider-connected-journey", "buyer-workspace"],
    tracks: ["issuance"],
    note: "권리. issueReservation is stub-only. issue_invitation is the organizer post. A gift transfers a caller-supplied right and does not mint one. A synthetic issuance record grants no admission authority.",
  },
  {
    id: "admission",
    surfaces: ["admission-credential", "organizer-console"],
    tracks: ["admission"],
    note: "입장. The credential label is not admit. open_admission on the organizer console is a separate post. A health probe is not entry.",
  },
  {
    id: "return",
    surfaces: ["refund-return-desk"],
    tracks: ["return-required"],
    note: "반환. Return-required is its own state, not a step before a refund. observe_return is pinned and never sent. A synthetic return observation records a return and records no refund.",
  },
  {
    id: "refund",
    surfaces: ["operator-unshown-desk", "platform-journey-trade", "provider-connected-journey", "refund-return-desk"],
    tracks: ["refund-done"],
    note: "환불. refund_ticket is pinned and no surface sends it. Status stays not-bound. COMPENSATION_UNDEFINED stays visible. The provider journey and the refund desk record a synthetic refund row that executes nothing. A refund-done cell does not clear a return-required cell. Refund policy values are UNDETERMINED.",
  },
] as const satisfies readonly BuyerFlowStage[];

const SURFACE_INDEX = new Map<string, WorkspaceSurface>(WORKSPACE_SURFACES.map((surface) => [surface.id, surface]));

const STAGE_INDEX = new Map<string, BuyerFlowStage>(BUYER_FLOW_STAGES.map((stage) => [stage.id, stage]));

/** Binding, sender, and provenance. Does not say a surface works. */
export function surfaceBindingLine(id: string): string {
  const surface = SURFACE_INDEX.get(id);
  if (!surface) {
    return sourceMessage(sourceCopy.en["p.t449"], { v1: id });
  }
  const sender = surface.sender ?? "none";
  const actions = surface.actions.length > 0 ? surface.actions.join(", ") : "none";
  const desk =
    surface.deskMethods.length > 0
      ? sourceMessage(sourceCopy.en["p.t450"], { v1: surface.deskMethods.join(", ") })
      : "";
  const presence = !surface.implemented ? "NOT_IMPLEMENTED." : surface.pageControl ? sourceCopy.en["sfd"] : sourceCopy.en["stw"];
  const control = surface.pageControl ? sourceCopy.en["s16v"] : sourceCopy.en["swq"];
  return sourceMessage(sourceCopy.en["p.t591"], { v1: surface.id, v2: surface.role, v3: surface.route, v4: surface.binding, v5: sender, v6: actions, v7: desk, v8: presence, v9: control, v10: surface.provenanceNote });
}

/** One badge line for the stage's own tracks. */
export function stageLine(id: string): string {
  const stage = STAGE_INDEX.get(id);
  if (!stage) {
    return sourceMessage(sourceCopy.en["p.t451"], { v1: id });
  }
  const badges =
    stage.tracks.length === 0
      ? sourceCopy.en["swp"]
      : stage.tracks.map((track) => sourceMessage(sourceCopy.en["p.t452"], { v1: track })).join(". ") + ".";
  return sourceMessage(sourceCopy.en["p.t592"], { v1: stage.id, v2: badges, v3: stage.note });
}
