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
    id: "marketing-journey",
    role: "buyer",
    route: "/marketing/journey",
    binding: "stub-only",
    sender: null,
    actions: [],
    deskMethods: [],
    provenanceNote:
      "Synthetic marketing benefit journey on one page: benefits discovered with the source's own eligibility verdict, priority rank, usage figures, coupon budget in redemptions, and referral attribution, applied to an order as a synthetic write, rejected by the source with a code and one return action, and reclaimed on request. Discover, apply, rejected, and reclaim are four separate lines. A benefit notice and an application confirm no purchase, pay no reward, and apply no discount. Consent is read as the source reports it and is set and authorized only on the consent page, where an earlier authorization is not reused after a withdrawal. CRM stays the independent M05 scope: this page selects no audience, sends no message, and completes no CRM product. Whether a reclaim restores a usage count or a budget is UNDETERMINED. On integration-http the read and the writes stay not-bound because no current producer tuple exists and the contract-only catalogue has no eligibility, usage, budget, attribution, apply, or reclaim command. Synthetic rows are not a producer receipt.",
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
      "Synthetic fixture for search, filters, sort, paging, and a scale window. Counts and tiers are synthetic labels. The one catalogue read is listPerformances. Stub-shape receipts are not from the gate.",
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
      "Synthetic projection read on the same page. The adapter validates a bounded cursor, filter, watermark, and access scope before a row returns, and checks the pin tuple before the first row. A row confirms no sale, no ownership, and no payment. On integration-http the read stays not-bound because the contract-only catalogue has no read command. Synthetic rows are not a producer receipt.",
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
      "Synthetic seat and GA selection on one page: summary, one bounded page, then a selection detail, with explicit refresh. The adapter checks the pin tuple before the first row and refuses a read under another generation or a different mode. An observed hold shows its expiry from the adapter flag. Queue admission is selection access only. Accessible seating stays unsupported. A selection is local: it reserves, sells, and pays nothing, and the hold desk method stays not-bound. On integration-http the read stays not-bound because the contract-only catalogue has no inventory read command. Synthetic rows are not a producer receipt.",
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
      "Synthetic multi-channel trade on one page: two channels list one right, a price change supersedes a listing, and a booking, a payment observation, a right transfer, and a refund explanation each keep their own state. One write is sent at a time per right. A lost or late result keeps that right blocked, a result from an earlier session is quarantined, and a read never resolves an unknown write. On integration-http the read and the writes stay not-bound because the contract-only catalogue has no listing, trade, payment, transfer, or refund command. Synthetic rows are not a producer receipt.",
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
      "Synthetic merchant read and export on one page: events, listings, trades, and settlement-obligation lines stay four lenses on their own source cuts, an unpaid, a held, and a refund-burden line keeps its own kind and state, and every line states settled, fundsAvailable, and lendable as false. A payload that breaks that stays refused before a row shows. Figures on different cuts are never merged into one balance, and the export is the producer's own file, shown only while it is one complete export of the cut the last read saw. On integration-http the read and the export stay not-bound because the contract-only catalogue has no merchant read or export command. Synthetic rows are not a producer receipt.",
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
      "Synthetic credit origination on one page: the application, the review decision, the commitment, and the drawdown permission stay four lanes, a submitted application and an assistant explanation are never a decision, and every payload states its five lane non-claims as false or is refused whole. Rate, limit, and schedule figures are the source's own text, shown as UNDETERMINED when the source sent none, and never computed here. A lane built under an older policy revision stays flagged, a withdrawn consent or an expired document suspends permission, and a shared limit keeps the source's own order. On integration-http the read and the requests stay not-bound because no current producer tuple exists and the contract-only catalogue has no credit command. Synthetic rows are not a producer receipt.",
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
      "Synthetic credit servicing on one page: the draw instruction, the disbursement observation, the reservation, and the exposure stay four facts, the repayment schedule, payments, allocations, unapplied remainders, reversals, adjustments, and the case history stay linked to the same obligation, and every payload states its eight lane non-claims as false or is refused whole. A partial repayment keeps its unapplied remainder and restores no commitment limit, a charge-off or recovery-case closure extinguishes no debt, and a payment observed after the case closed reopens nothing by itself. View, proposal, and approval stay three capabilities and an actor may not approve its own proposal. On integration-http the read and the requests stay not-bound because no current producer tuple exists and the contract-only catalogue has no credit command. Synthetic rows are not a producer receipt.",
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
      "Synthetic finance operations on one page: a reconciliation queue of unmatched, duplicate, late, several-payee, residual, and balance cases, each linked to its original trade, with facts, payee allocations, and unapplied remainders kept as the source's own rows. Totals, differences, and shares are the source's own text and are never computed here. A case whose two sides sit on source cuts at different positions is flagged timing-uncertain, and the export is the producer's own synthetic file, shown as current only when it is one complete export of the cut set the last read saw. A correction is a proposal, an approval is a record that changes no economic state, no actor holds the authority to change economic state, and nothing forces a ledger to match. On integration-http the read, the export, and the requests stay not-bound because no current producer tuple exists and the contract-only catalogue has no finance command. Synthetic rows are not a producer receipt.",
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
      "Synthetic delegation assistant on one page: a request, a proposal, an approval, and a command stay four separate lines. Request text is untrusted intent and is never authority: instruction-like text refuses the whole request, an ambiguous goal infers no grant, scope, action, or budget, and only the approve control on a recorded open proposal sends one synthetic command once under the caller's intent reference. A grant's scope, deadline, target, budget, allowed actions, and requested and adopted modes are the source's own fields, copied and never raised; an unadopted execution delegation stays in query/propose mode. A revoke, a stale grant version, or a lost answer keeps the grant's writes blocked, a late result after a context change is quarantined, and a read never resolves an unknown write. Every payload states seven non-claims as false or is refused whole. On integration-http the read and the writes stay not-bound because no current producer tuple exists, the delegation-surface node is not promoted, and the contract-only catalogue has no delegation read or command. Synthetic rows are not a producer receipt, and nothing here moves funds, transfers a right, or signs.",
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
      "Synthetic provider checkout on one page: the checkout redirect, the buyer's return landing, the provider's own report, the issuance record, and the refund record stay five separate lines on each order. The environment and the account are checked on every read: the desk serves the sandbox only, a declared production environment refuses the read, a write that does not declare sandbox is refused, and an unqualified actor fences every write. A return landing is a source event and is never a payment observation; issuance and refund stay fenced until a provider report is recorded and observed. One write is sent at a time per order, a lost or late result keeps that order blocked, a result from an earlier session is quarantined, and a read never resolves an unknown write. Every payload states six non-claims as false or is refused whole, and a confirmed answer that breaks them leaves the write unknown. On integration-http the read and the writes stay not-bound because kix-protocol:k-provider-sandbox and kix-protocol:k-authority-qualification are not merged and the contract-only catalogue has no checkout, payment-observation read, issuance, or provider-refund command. Synthetic rows are not a provider receipt, a sandbox success is not a real payment, an issuance record is not a real right, and a refund record executes nothing.",
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
      "Synthetic release candidate on one page: one run re-pins the producer and consumer source, the synthetic artifact, and the config tuple under the live tuple key, re-runs the sibling qualification record as technical evidence only, and presents install, publish, and operate as user decisions it never takes. A packet recorded under a different source or contract tuple is refused whole and an approval under another tuple is never reused; real user acceptance stays PENDING_USER_DECISION and distinct from the technical qualification. The support, incident, privacy, accessibility, and update/rollback lanes are handoff documents, not operating channels, and deferred scope and unresolved items stay on five separate denominators that never merge into one readiness figure. The packet only ever states STUB_CANDIDATE_RECORDED and every non-claim is a literal false. On integration-http the run stays not-bound because pending node c-platform-release is not promoted, kix-protocol:k-platform-release is not merged, the RELEASE gate has not run, and the contract-only catalogue has no release command. Synthetic rows are not a release receipt.",
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
      "Synthetic refund-and-return desk on one in-process source, mounted on the booking page and the box-office settlement panel, and read-only on the buyer workspace. Reservation, payment observation, issuance, return-required, and refund-done stay five separate cells, and a return-required marker is not a refund pre-stage. Cancel, void, PG-cancel adjustment, return observation, and refund stay five separate lines: refund_ticket, void_unissued, adjust_pg_cancel, and observe_return are recorded and never sent, and the catalogue has no booking-cancel command. A recorded line executes nothing. On integration-http the read and the writes stay not-bound because the contract-only catalogue has no order read or refund command. Synthetic rows are not a producer receipt.",
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
      "Synthetic session recovery desk on one page: an intent and its conflict scope are recorded in a versioned journal in this tab's session storage before the synthetic attach is sent, and the answer is recorded after. After a reload or a tab resume, an intent that was not settled is UNKNOWN, nothing is sent again, and no new write or compensation goes out for that subject. A confirmed record from an earlier page load is history only. A corrupt, unsupported, or lost journal is quarantined and shown as SESSION_EVIDENCE_LOST, every write is held, and no new reference is issued. Browser storage can be cleared, lost, or copied, so this is not an exactly-once guarantee; retention is UNDETERMINED and nothing expires a fence. The journal format is app-internal and is not a public schema, operation, capability, or identifier. On integration-http the attach stays not-bound because pending node c-async-session-fence is not promoted and the contract-only catalogue has no journey read or evidence command. Synthetic rows are not a producer receipt.",
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
      "Synthetic read-only table of journeys on one page: for each journey and branch (normal, explicit rejection, response lost, partly landed) the last confirmed step, the unconfirmed request, the blocked next action, and the compensation cell. Rows come from the synthetic sources that already exist, driven in this process, from the operational qualification packet, or as a pointer to the test that already pins the branch. UNKNOWN is never shown as done or lost, a branch no source reproduces stays visible and is never counted as a success, and the compensation cell has three words (NONE_NEEDED, FENCED, COMPENSATION_UNDEFINED) and names no command. The page sends no command and composes no opposite or compensating command. Whether a marketing reclaim restores a usage count or a budget is UNDETERMINED. On integration-http the table stays not-bound because pending node c-cross-surface-journeys is not promoted and no producer contract for it is merged. The table format is app-internal and is not a public schema, operation, capability, or identifier. Synthetic rows are not a producer receipt.",
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
      "Read-only page over receipts already opened on this page load. Selection, reservation, order, and issuance stay separate rows. Writes stay on /booking/:eventId and /gift. A reload clears page-load state and re-sends nothing. Stub-shape receipts are not from the gate.",
    taskId: "c-buyer-workspace",
    implemented: true,
    pageControl: true,
  },
  {
    id: "organizer-workspace",
    role: "organizer",
    route: "/organizer/workspace",
    binding: "published-bound",
    sender: "OrganizerConsole",
    actions: SENDER_ACTIONS.OrganizerConsole,
    deskMethods: [],
    provenanceNote:
      "Organizer workspace edits caller fields for the six lifecycle commands and previews each command before one send. Each command is its own request. The shared OrganizerConsole is the sender. Stub-shape receipts are not from the gate. The operator actor string is not an authentication result.",
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
      "Read-only explanation of receipts already on this page load. Operation, status, source, and profile stay with the receipt. An unknown outcome stays unknown. The support export redacts tokens, personal data, and account numbers. A receipt from another session is not shown. This page does not send. Stub-shape receipts are not from the gate.",
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
      "Presentation baseline for amount, quantity, deadline, keyboard, and non-color status on the existing buyer, organizer, and operator screens. This row adds no route and no command. Price and fee display stays UNDETERMINED. Display locale does not decide expiry.",
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
    return `Surface ${id} is absent from the workspace registry.`;
  }
  const sender = surface.sender ?? "none";
  const actions = surface.actions.length > 0 ? surface.actions.join(", ") : "none";
  const desk =
    surface.deskMethods.length > 0
      ? ` Desk methods stay not-bound: ${surface.deskMethods.join(", ")}.`
      : "";
  const presence = !surface.implemented ? "NOT_IMPLEMENTED." : surface.pageControl ? "Current route." : "No added route.";
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
