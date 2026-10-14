import { JOURNEY_NOT_COMPOSED, type JourneyNotComposed } from "./booking-journey.js";
import { COMMERCE_COMMAND_BINDINGS } from "./commerce-bindings.js";
import {
  DISCOVERY_PROJECTION_AS_OF,
  DISCOVERY_READ_TUPLE_LITERALS,
  checkDiscoveryReadTuple,
  type DiscoveryReadTuple,
} from "./discovery-read.js";
import { type PinnedAction } from "./openapi-contract-pin.js";

/**
 * Synthetic provider-sandbox checkout source for the provider journey screen.
 *
 * This is the stub-scope stand-in for an approved payment provider's sandbox.
 * The real connection stays pending on kix-protocol:k-provider-sandbox and
 * kix-protocol:k-authority-qualification, and on the unpromoted
 * c-provider-connected-journey node. The contract-only catalogue has no
 * checkout, payment-observation read, issuance, or provider-refund command, so
 * no producer SDK, manifest, or vector is consumed and this module sends
 * nothing over a network.
 *
 * The source declares one environment, "sandbox", and never serves
 * "production". It reports each actor's qualification verdict; an actor it
 * does not qualify is "unqualified" and its writes are rejected
 * ACCOUNT_UNQUALIFIED. Those verdicts are stub policy for tests and the demo.
 * They are not a provider approval, not a test account, and not protocol law.
 *
 * The source is deliberately naive. It does not de-duplicate a repeated
 * intent and it carries no idempotency key, so the only thing that keeps a
 * client from a second effect is the client fence in provider-controller.ts.
 * A return landing and a provider callback are source events the page
 * requests through the synthetic controls; a real provider offers none of
 * them. A return landing alone is never a payment observation.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */
export const PROVIDER_JOURNEY_RULING =
  "M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce";

export const PROVIDER_NOT_BOUND_REASON =
  "No current producer tuple exists for a provider checkout: kix-protocol:k-provider-sandbox and kix-protocol:k-authority-qualification are not merged, and c-provider-connected-journey is not promoted. The contract-only catalogue has no checkout, payment-observation read, issuance, or provider-refund command. The provider journey stays not-bound on integration-http.";

export const PROVIDER_PROJECTION_NAME = "kix.provider.journey";

/** Fixed instant the synthetic source claims to be built at. */
export const PROVIDER_AS_OF = DISCOVERY_PROJECTION_AS_OF;

/** Watermark the stale scenario serves, and the floor a reader holds against it. */
export const PROVIDER_STALE_WATERMARK = "2026-10-10T00:00:00.000Z";
export const PROVIDER_STALE_FLOOR = "2026-10-12T00:00:00.000Z";

/** The desk's qualified actor string. It is a context label, not an authentication result. */
export const PROVIDER_DESK_ACTOR = "provider-buyer";

/** A second actor the source does not qualify. Context label, not an authentication result. */
export const PROVIDER_GUEST_ACTOR = "provider-guest";

/** The only environment the source ever declares. */
export const PROVIDER_SANDBOX = "sandbox" as const;

export const PROVIDER_QUALIFICATIONS = ["sandbox-qualified", "unqualified"] as const;

export type ProviderQualification = (typeof PROVIDER_QUALIFICATIONS)[number];

/** Opaque order amount unit. Nothing here parses, sums, or scales an amount. */
export const PROVIDER_UNIT = "mock-unit";

/** Printed when the source sent no amount. */
export const PROVIDER_UNDETERMINED = "UNDETERMINED";

/** The synthetic writes. None of them is a desk method and none is a catalogue command. */
export const PROVIDER_STEPS = ["begin", "observe", "issue", "refund"] as const;

export type ProviderStep = (typeof PROVIDER_STEPS)[number];

/** Redirect, return, payment, issuance, and refund are five independent lines. There is no aggregate. */
export const PROVIDER_FACETS = ["redirect", "return", "payment", "issuance", "refund"] as const;

export type ProviderFacet = (typeof PROVIDER_FACETS)[number];

export const PROVIDER_SCENARIOS = [
  "clean",
  "empty",
  "stale",
  "unqualified",
  "production-claimed",
  "provider-error",
  "declined",
  "return-only",
  "begin-lost",
  "observe-lost",
  "observe-late",
  "issue-lost",
  "refund-lost",
  "held-response",
  "claims-real",
  "receipt-claims",
] as const;

export type ProviderScenario = (typeof PROVIDER_SCENARIOS)[number];

export const PROVIDER_REJECT_CODES = [
  "PROVIDER_ERROR",
  "ACCOUNT_UNQUALIFIED",
  "CHECKOUT_OPEN",
  "CHECKOUT_ABANDONED",
  "PAYMENT_PENDING",
  "PAYMENT_DECLINED",
  "PAYMENT_NOT_OBSERVED",
  "ALREADY_ISSUED",
  "REFUND_UNAVAILABLE",
  "ALREADY_REFUNDED",
  "VERSION_STALE",
  "UNKNOWN_REF",
  "IDENTITY_MISMATCH",
] as const;

export type ProviderRejectCode = (typeof PROVIDER_REJECT_CODES)[number];

/** A rejection with one of these codes means the page read before it wrote is behind. */
export const PROVIDER_STALE_CLASS_CODES: readonly ProviderRejectCode[] = ["VERSION_STALE"];

export const PROVIDER_INVALID_CODES = ["INTENT", "STEP", "IDENTITY", "VERSION", "ENVIRONMENT"] as const;

export type ProviderInvalidCode = (typeof PROVIDER_INVALID_CODES)[number];

export const PROVIDER_REFUSAL_CODES = ["CLAIM"] as const;

export type ProviderRefusalCode = (typeof PROVIDER_REFUSAL_CODES)[number];

/** Quote of the locked hold binding. H1 keeps this consideredAction and keeps it not-bound. */
export const PROVIDER_HOLD_NOT_BOUND = {
  method: "placeHold",
  status: COMMERCE_COMMAND_BINDINGS.placeHold.status,
  consideredAction: COMMERCE_COMMAND_BINDINGS.placeHold.consideredAction,
  reason: COMMERCE_COMMAND_BINDINGS.placeHold.reason,
  mappedOntoPrepareTrade: false,
} as const;

/**
 * Non-claim fields every payload and every write receipt states as literal
 * false. A payload that claims any of them is refused whole. A sandbox success
 * creates no real payment, no funds movement, no admission grant, and no
 * executed refund, and it is not a provider integration.
 */
export const PROVIDER_NON_CLAIM_FIELDS = [
  "realPayment",
  "fundsMoved",
  "admissionGrant",
  "refundExecuted",
  "providerIntegrationComplete",
  "productionEnvironment",
] as const;

export type ProviderNonClaimField = (typeof PROVIDER_NON_CLAIM_FIELDS)[number];

export type ProviderNonClaims = Readonly<Record<ProviderNonClaimField, false>>;

const PROVIDER_NON_CLAIMS: ProviderNonClaims = {
  realPayment: false,
  fundsMoved: false,
  admissionGrant: false,
  refundExecuted: false,
  providerIntegrationComplete: false,
  productionEnvironment: false,
};

export interface ProviderNotComposed {
  action:
    | JourneyNotComposed["action"]
    | "refund_ticket"
    | "adjust_pg_cancel"
    | "finalize_effect"
    | "observe_effect"
    | "observe_return";
  reason: string;
}

/**
 * Catalogue commands this module records and does not send. The journey list is
 * reused as is. refund_ticket and the payment-effect commands that name a
 * payment id are added with their own reasons: the synthetic checkout, the
 * synthetic observation, and the synthetic refund record compose none of them.
 */
export const PROVIDER_NOT_COMPOSED: readonly ProviderNotComposed[] = [
  ...JOURNEY_NOT_COMPOSED,
  {
    action: "refund_ticket",
    reason: `${PROVIDER_JOURNEY_RULING}. refund_ticket is pinned (domain, expectedVersion, ticketId) and never composed here. The synthetic refund record on this page is not refund_ticket and executes nothing.`,
  },
  {
    action: "adjust_pg_cancel",
    reason: `${PROVIDER_JOURNEY_RULING}. adjust_pg_cancel names a paymentId, an amount, and a currency, and is never composed. The synthetic payment observation on this page is not it.`,
  },
  {
    action: "finalize_effect",
    reason: `${PROVIDER_JOURNEY_RULING}. finalize_effect names a paymentId and is never composed. Nothing on this page finalizes a payment effect.`,
  },
  {
    action: "observe_effect",
    reason: `${PROVIDER_JOURNEY_RULING}. observe_effect names a paymentId, an amount, and a currency, and is never composed. The synthetic payment observation on this page is not it.`,
  },
  {
    action: "observe_return",
    reason: `${PROVIDER_JOURNEY_RULING}. observe_return names a paymentId, a payer, an amount, and a currency, and is never composed. The synthetic return landing and observation on this page are not it.`,
  },
];

// ---------------------------------------------------------------------------
// Identity. Each kind has its own prefix and one kind is never read as another.
// ---------------------------------------------------------------------------

export const PROVIDER_REF_KINDS = [
  "order",
  "checkout",
  "return",
  "callback",
  "payment",
  "issuance",
  "right",
  "refund",
] as const;

export type ProviderRefKind = (typeof PROVIDER_REF_KINDS)[number];

const REF_PREFIX: Readonly<Record<ProviderRefKind, string>> = {
  order: "ord-",
  checkout: "cko-",
  return: "ret-",
  callback: "cbk-",
  payment: "psp-",
  issuance: "iss-",
  right: "rgt-",
  refund: "rfd-",
};

const REF_PATTERN = /^(ord|cko|ret|cbk|psp|iss|rgt|rfd)-[0-9]{4}$/;

export function providerRef(kind: ProviderRefKind, serial: number): string {
  return `${REF_PREFIX[kind]}${String(serial).padStart(4, "0")}`;
}

export function providerRefKind(ref: string): ProviderRefKind | null {
  if (!REF_PATTERN.test(ref)) {
    return null;
  }
  for (const kind of PROVIDER_REF_KINDS) {
    if (ref.startsWith(REF_PREFIX[kind])) {
      return kind;
    }
  }
  return null;
}

export function isProviderRef(ref: unknown, kind: ProviderRefKind): ref is string {
  return typeof ref === "string" && providerRefKind(ref) === kind;
}

export interface ProviderIdentityRow {
  /** Kind of the identity on the screen. */
  id: ProviderRefKind | "version" | "amount";
  /** Field name on this module's snapshot. */
  providerField: string;
  status: "field-named" | "not-bound";
  /**
   * Published body fields that play the same role. A test reads the vendored pin and
   * checks every entry. Empty for a not-bound row. No body is built from this list.
   */
  bodyFields: readonly { action: PinnedAction; field: string }[];
  reason: string;
}

/**
 * Which identity on the provider screen has a named field in the pinned
 * catalogue. Naming a field is not binding it: the value here is a synthetic
 * reference, and the pinned catalogue does not publish the receipt path that
 * would carry it. A row with no field is not-bound and the screen invents none.
 */
export const PROVIDER_IDENTITY_REGISTER: readonly ProviderIdentityRow[] = [
  {
    id: "order",
    providerField: "orderRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pinned money posting names orderId, and that posting is never composed. No pinned body this journey could send names an order, and there is no order read command, so an order reference here is a synthetic row only.",
  },
  {
    id: "checkout",
    providerField: "checkoutRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names a checkout or a provider session. A checkout reference on this screen is a synthetic row only.",
  },
  {
    id: "return",
    providerField: "returnRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "No pinned body or receipt names a return landing. observe_return is pinned and never composed, and a return landing is never a payment observation.",
  },
  {
    id: "callback",
    providerField: "callbackRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names a provider callback id. A callback reference on this screen is a synthetic row only.",
  },
  {
    id: "payment",
    providerField: "paymentRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pinned catalogue names a payment id only on money-posting and payment-effect commands, and every one of them also carries an amount and a currency. This journey composes none of them. The catalogue has no payment observation read, so a payment reference on this screen is a synthetic observation only.",
  },
  {
    id: "issuance",
    providerField: "issuanceRef",
    status: "not-bound",
    bodyFields: [],
    reason: "No pinned body or receipt names an issuance id. An issuance reference on this screen is a synthetic row only.",
  },
  {
    id: "right",
    providerField: "rightRef",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "ticketId" },
      { action: "prepare_trade", field: "ticketId" },
      { action: "offer_gift", field: "ticketId" },
      { action: "refund_ticket", field: "ticketId" },
    ],
    reason: "The pinned bodies name the right as ticketId. The value here is a synthetic reference and no body is built from it.",
  },
  {
    id: "refund",
    providerField: "refundRef",
    status: "not-bound",
    bodyFields: [],
    reason:
      "refund_ticket is pinned (domain, expectedVersion, ticketId) and never composed. No refund id and no compensation policy are published, so a refund reference here is a synthetic record only.",
  },
  {
    id: "version",
    providerField: "expectedVersion",
    status: "field-named",
    bodyFields: [
      { action: "create_listing", field: "expectedVersion" },
      { action: "prepare_trade", field: "expectedVersion" },
      { action: "refund_ticket", field: "expectedVersion" },
      { action: "offer_gift", field: "expectedVersion" },
    ],
    reason:
      "The pinned bodies carry the version the caller read. The client never raises it. Whether a version is current is the source's decision.",
  },
  {
    id: "amount",
    providerField: "amount",
    status: "not-bound",
    bodyFields: [],
    reason:
      "The pinned money bodies name amount and currency. This screen copies the source's own opaque text and computes nothing; an order with no amount is printed UNDETERMINED.",
  },
];

// ---------------------------------------------------------------------------
// Snapshot and outcome shapes
// ---------------------------------------------------------------------------

export interface ProviderEnvironmentView {
  /** The environment the source declares. Only "sandbox" is ever served. */
  providerEnvironment: "sandbox" | "production";
  /** The source's verdict on the reading actor. It is not an authentication result. */
  account: { actorRef: string; qualification: ProviderQualification };
}

export interface ProviderCheckoutView {
  checkoutRef: string;
  state: "open" | "returned" | "abandoned";
  returnRef: string | null;
}

export interface ProviderPaymentView {
  state: "none" | "pending" | "observed" | "declined";
  paymentRef: string | null;
  callbackRef: string | null;
  note: string;
}

export interface ProviderIssuanceView {
  state: "none" | "issued";
  issuanceRef: string | null;
  rightRef: string | null;
}

export interface ProviderRefundView {
  state: "none" | "recorded";
  refundRef: string | null;
  /** Always false. A recorded refund executes nothing. */
  executed: false;
  note: string;
}

export interface ProviderOrderView {
  orderRef: string;
  /** The source's own opaque whole-unit text, or null. Nothing here computes it. */
  amount: string | null;
  currency: string;
  /** The order generation the caller must copy into a write. Effects and source events raise it. */
  version: number;
  checkout: ProviderCheckoutView | null;
  payment: ProviderPaymentView;
  issuance: ProviderIssuanceView;
  refund: ProviderRefundView;
}

export interface ProviderSnapshot {
  /** Read serial on this port. It orders reads and is not a commit position. */
  snapshotId: number;
  /** Advances on every effect at the source. A label, not a version the client may raise. */
  generation: number;
  watermark: string;
  scenario: ProviderScenario;
  environment: ProviderEnvironmentView;
  orders: readonly ProviderOrderView[];
  nonClaims: ProviderNonClaims;
}

export interface ProviderReceiptRefs {
  orderRef: string;
  checkoutRef: string | null;
  returnRef: string | null;
  paymentRef: string | null;
  callbackRef: string | null;
  issuanceRef: string | null;
  rightRef: string | null;
  refundRef: string | null;
  orderVersion: number | null;
}

export interface ProviderReadRequest {
  contextKey: string;
  actorRef: string;
  watermarkFloor: string | null;
}

interface ProviderWriteBase {
  contextKey: string;
  actorRef: string;
  /** The caller's intent. The source does not de-duplicate on it. */
  intentRef: string;
  /** The environment the caller declares. The source serves sandbox only. */
  declaredEnvironment: "sandbox" | "production";
}

export type ProviderWriteRequest =
  | (ProviderWriteBase & { step: "begin"; orderRef: string; expectedVersion: number })
  | (ProviderWriteBase & { step: "observe"; orderRef: string; checkoutRef: string; expectedVersion: number })
  | (ProviderWriteBase & { step: "issue"; orderRef: string; checkoutRef: string; expectedVersion: number })
  | (ProviderWriteBase & { step: "refund"; orderRef: string; paymentRef: string; expectedVersion: number });

export type ProviderTupleChanged = { kind: "tuple-changed"; field: string; expected: string; actual: string };

export type ProviderRefused = {
  kind: "refused";
  code: ProviderRefusalCode;
  field: string;
  ref: string | null;
  detail: string;
};

export type ProviderReadOutcome =
  | { kind: "ready"; snapshot: ProviderSnapshot }
  | { kind: "empty"; watermark: string; generation: number; snapshotId: number }
  | { kind: "stale"; watermark: string; floor: string }
  | ProviderRefused
  | ProviderTupleChanged
  | { kind: "not-bound"; reason: string }
  | { kind: "unknown"; message: string };

export type ProviderWriteOutcome =
  | {
      kind: "confirmed";
      step: ProviderStep;
      intentRef: string;
      contextKey: string;
      refs: ProviderReceiptRefs;
      nonClaims: ProviderNonClaims;
    }
  | {
      kind: "rejected";
      step: ProviderStep;
      intentRef: string;
      contextKey: string;
      code: ProviderRejectCode;
      detail: string;
    }
  | { kind: "unknown"; step: ProviderStep; intentRef: string; contextKey: string; message: string }
  | { kind: "invalid-request"; step: string; intentRef: string; contextKey: string; code: ProviderInvalidCode; detail: string }
  | (ProviderTupleChanged & { step: string; intentRef: string; contextKey: string })
  | { kind: "not-bound"; reason: string };

/** A source event: the buyer lands back on the return URL. It is not a payment observation. */
export interface ProviderReturnEvent {
  checkoutRef: string;
  orderRef: string;
  returnRef: string;
}

/** A source event: the provider's report for a checkout. The observed result is the source's. */
export interface ProviderCallbackEvent {
  checkoutRef: string;
  orderRef: string;
  callbackRef: string;
  result: "observed" | "declined";
}

/** A source event: the buyer never came back and the provider closed the checkout. */
export interface ProviderAbandonEvent {
  checkoutRef: string;
  orderRef: string;
}

/**
 * A result that reaches the client after the client had already treated the write as
 * unknown. A late delivery is evidence. It does not make the write known.
 */
export interface ProviderLateDelivery {
  intentRef: string;
  contextKey: string;
  step: ProviderStep;
  result: "confirmed" | "rejected";
  code: ProviderRejectCode | null;
}

export interface ProviderJourneyPort {
  readonly environment: "stub" | "integration-http";
  readonly source: "synthetic-provider" | "none";
  readonly scenario: ProviderScenario;
  read(request: ProviderReadRequest): Promise<ProviderReadOutcome>;
  submit(request: ProviderWriteRequest): Promise<ProviderWriteOutcome>;
  /** Synthetic control: the buyer lands back on the return URL. A real provider offers no such call. */
  deliverReturn(checkoutRef: string): ProviderReturnEvent | null;
  /** Synthetic control: the provider's report for a checkout arrives. A real provider offers no such call. */
  deliverCallback(checkoutRef: string): ProviderCallbackEvent | null;
  /** Synthetic control: the provider closes a checkout the buyer never returned to. */
  markAbandoned(checkoutRef: string): ProviderAbandonEvent | null;
  /** Synthetic control: releases responses the held-response scenario is holding. Returns how many. */
  deliverHeld(): number;
  /** Synthetic control: takes the late results that are due. A real provider offers no such call. */
  deliverLate(): readonly ProviderLateDelivery[];
}

export interface StubProviderJourneyOptions {
  scenario?: ProviderScenario;
  /** In observe-late, whether the held observation really applied. Default confirmed. */
  lateResult?: "confirmed" | "rejected";
  /** Expected tuple override. Used to stage a producer change in tests. */
  expectedTuple?: DiscoveryReadTuple;
}

export interface ProviderEffectCounts {
  /** submit calls that reached the source, whatever they returned. */
  submits: number;
  begins: number;
  returns: number;
  callbacks: number;
  abandons: number;
  observations: number;
  issues: number;
  refunds: number;
}

export function createStubProviderJourney(options: StubProviderJourneyOptions = {}): StubProviderJourney {
  return new StubProviderJourney(options);
}

export function createNotBoundProviderJourney(): ProviderJourneyPort {
  const outcome = { kind: "not-bound", reason: PROVIDER_NOT_BOUND_REASON } as const;
  return {
    environment: "integration-http",
    source: "none",
    scenario: "clean",
    read() {
      return Promise.resolve({ ...outcome });
    },
    submit() {
      return Promise.resolve({ ...outcome });
    },
    deliverReturn() {
      return null;
    },
    deliverCallback() {
      return null;
    },
    markAbandoned() {
      return null;
    },
    deliverHeld() {
      return 0;
    },
    deliverLate() {
      return [];
    },
  };
}

export function providerJourneyPortFor(
  environment: "stub" | "integration-http",
  options: StubProviderJourneyOptions = {},
): ProviderJourneyPort {
  if (environment === "stub") {
    return createStubProviderJourney(options);
  }
  return createNotBoundProviderJourney();
}

interface OrderRecord {
  orderRef: string;
  amount: string | null;
  currency: string;
  version: number;
  checkoutRef: string | null;
  checkoutState: "none" | "open" | "returned" | "abandoned";
  returnRef: string | null;
  paymentState: "none" | "pending" | "observed" | "declined";
  paymentRef: string | null;
  callbackRef: string | null;
  issuanceRef: string | null;
  rightRef: string | null;
  refundRef: string | null;
}

const SEED_ORDERS: readonly OrderRecord[] = [
  {
    orderRef: "ord-0001",
    amount: "1200",
    currency: PROVIDER_UNIT,
    version: 4,
    checkoutRef: null,
    checkoutState: "none",
    returnRef: null,
    paymentState: "none",
    paymentRef: null,
    callbackRef: null,
    issuanceRef: null,
    rightRef: null,
    refundRef: null,
  },
  {
    orderRef: "ord-0002",
    amount: null,
    currency: PROVIDER_UNIT,
    version: 2,
    checkoutRef: null,
    checkoutState: "none",
    returnRef: null,
    paymentState: "none",
    paymentRef: null,
    callbackRef: null,
    issuanceRef: null,
    rightRef: null,
    refundRef: null,
  },
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** An amount is an opaque whole-unit string or null. Nothing parses, sums, or scales it. */
export function isProviderAmount(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^[0-9]+$/.test(value));
}

function claimRefusal(field: string, ref: string | null): ProviderRefused {
  return {
    kind: "refused",
    code: "CLAIM",
    field,
    ref,
    detail: `The payload does not state ${field} as false. A synthetic row is never a real payment, a funds movement, an admission grant, an executed refund, a provider integration, or a production environment.`,
  };
}

function invalidNonClaims(nonClaims: ProviderNonClaims): string | null {
  for (const field of PROVIDER_NON_CLAIM_FIELDS) {
    if (nonClaims[field] !== false) {
      return field;
    }
  }
  return null;
}

/**
 * Whole-payload validation before a row is shown. A malformed reference, a
 * wrong-kind reference, a non-whole-unit or wrong-unit amount, an unknown
 * checkout or payment state, an executed refund, a false non-claim that is not
 * the literal false, or a callback or payment reference on an order that never
 * reported refuses the whole payload.
 */
export function refuseProviderSnapshot(snapshot: ProviderSnapshot): ProviderRefused | null {
  const claim = invalidNonClaims(snapshot.nonClaims);
  if (claim !== null) {
    return claimRefusal(claim, null);
  }
  if (snapshot.environment.providerEnvironment !== "sandbox" && snapshot.environment.providerEnvironment !== "production") {
    return {
      kind: "refused",
      code: "CLAIM",
      field: "providerEnvironment",
      ref: null,
      detail: `Provider environment ${String(snapshot.environment.providerEnvironment)} is not a declared environment.`,
    };
  }
  for (const order of snapshot.orders) {
    if (!isProviderRef(order.orderRef, "order")) {
      return { kind: "refused", code: "CLAIM", field: "orderRef", ref: String(order.orderRef), detail: "An order row carries no order reference." };
    }
    if (!isProviderAmount(order.amount) || order.currency !== PROVIDER_UNIT) {
      return {
        kind: "refused",
        code: "CLAIM",
        field: "amount",
        ref: order.orderRef,
        detail: "An order amount is the source's own whole-unit text in mock-unit, or none.",
      };
    }
    if (!Number.isInteger(order.version) || order.version < 0) {
      return { kind: "refused", code: "CLAIM", field: "version", ref: order.orderRef, detail: "An order version is a whole number." };
    }
    if (order.checkout !== null) {
      if (!isProviderRef(order.checkout.checkoutRef, "checkout")) {
        return { kind: "refused", code: "CLAIM", field: "checkoutRef", ref: order.orderRef, detail: "A checkout row carries a checkout reference." };
      }
      if (order.checkout.returnRef !== null && !isProviderRef(order.checkout.returnRef, "return")) {
        return { kind: "refused", code: "CLAIM", field: "returnRef", ref: order.orderRef, detail: "A return landing carries a return reference." };
      }
    }
    if (order.payment.paymentRef !== null && !isProviderRef(order.payment.paymentRef, "payment")) {
      return { kind: "refused", code: "CLAIM", field: "paymentRef", ref: order.orderRef, detail: "A payment observation carries a payment reference." };
    }
    if (order.payment.callbackRef !== null && !isProviderRef(order.payment.callbackRef, "callback")) {
      return { kind: "refused", code: "CLAIM", field: "callbackRef", ref: order.orderRef, detail: "A provider report carries a callback reference." };
    }
    if (order.issuance.state === "issued") {
      if (!isProviderRef(order.issuance.issuanceRef, "issuance") || !isProviderRef(order.issuance.rightRef, "right")) {
        return { kind: "refused", code: "CLAIM", field: "issuanceRef", ref: order.orderRef, detail: "An issuance carries an issuance and a right reference." };
      }
    }
    if (order.refund.state === "recorded") {
      if (!isProviderRef(order.refund.refundRef, "refund")) {
        return { kind: "refused", code: "CLAIM", field: "refundRef", ref: order.orderRef, detail: "A refund record carries a refund reference." };
      }
      if (order.refund.executed !== false) {
        return claimRefusal("refundExecuted", order.orderRef);
      }
    }
  }
  return null;
}

/**
 * Receipt validation. A confirmed receipt that does not state every non-claim
 * as literal false is untrusted, and the caller treats the write as unknown.
 */
export function refuseProviderReceipt(nonClaims: ProviderNonClaims): ProviderRefused | null {
  const claim = invalidNonClaims(nonClaims);
  if (claim !== null) {
    return claimRefusal(claim, null);
  }
  return null;
}

/** Synthetic source. State lives in this object, so a new port is a new session. */
export class StubProviderJourney implements ProviderJourneyPort {
  readonly environment = "stub" as const;
  readonly source = "synthetic-provider" as const;
  readonly scenario: ProviderScenario;
  private readonly lateResult: "confirmed" | "rejected";
  private readonly expectedTuple: DiscoveryReadTuple;
  private readonly providerEnvironment: "sandbox" | "production";
  private readonly orders = new Map<string, OrderRecord>();
  private readonly held: { release: () => void }[] = [];
  private late: ProviderLateDelivery[] = [];
  private generation = 1;
  private snapshotSerial = 0;
  private checkoutSerial = 1;
  private returnSerial = 1;
  private callbackSerial = 1;
  private paymentSerial = 1;
  private issuanceSerial = 1;
  private rightSerial = 1;
  private refundSerial = 1;
  private readonly counts: ProviderEffectCounts = {
    submits: 0,
    begins: 0,
    returns: 0,
    callbacks: 0,
    abandons: 0,
    observations: 0,
    issues: 0,
    refunds: 0,
  };

  constructor(options: StubProviderJourneyOptions) {
    this.scenario = options.scenario ?? "clean";
    this.lateResult = options.lateResult ?? "confirmed";
    this.expectedTuple = options.expectedTuple ?? DISCOVERY_READ_TUPLE_LITERALS;
    this.providerEnvironment = this.scenario === "production-claimed" ? "production" : "sandbox";
    if (this.scenario !== "empty") {
      for (const order of SEED_ORDERS) {
        this.orders.set(order.orderRef, { ...order });
      }
    }
  }

  /** Test seam. Counts of what reached the source. Not part of the port. */
  effects(): ProviderEffectCounts {
    return { ...this.counts };
  }

  read(request: ProviderReadRequest): Promise<ProviderReadOutcome> {
    return Promise.resolve(this.readNow(request));
  }

  deliverReturn(checkoutRef: string): ProviderReturnEvent | null {
    const order = this.orderOfCheckout(checkoutRef);
    if (!order || order.checkoutState !== "open") {
      return null;
    }
    const returnRef = providerRef("return", this.returnSerial);
    this.returnSerial += 1;
    order.checkoutState = "returned";
    order.returnRef = returnRef;
    order.paymentState = "pending";
    order.version += 1;
    this.counts.returns += 1;
    this.generation += 1;
    return { checkoutRef, orderRef: order.orderRef, returnRef };
  }

  deliverCallback(checkoutRef: string): ProviderCallbackEvent | null {
    // In return-only the provider's report never arrives, so there is nothing to deliver.
    if (this.scenario === "return-only") {
      return null;
    }
    const order = this.orderOfCheckout(checkoutRef);
    if (!order || order.paymentState !== "pending" || order.checkoutState === "abandoned") {
      return null;
    }
    const callbackRef = providerRef("callback", this.callbackSerial);
    this.callbackSerial += 1;
    order.callbackRef = callbackRef;
    order.version += 1;
    this.counts.callbacks += 1;
    this.generation += 1;
    if (this.scenario === "declined") {
      order.paymentState = "declined";
      return { checkoutRef, orderRef: order.orderRef, callbackRef, result: "declined" };
    }
    order.paymentState = "observed";
    order.paymentRef = providerRef("payment", this.paymentSerial);
    this.paymentSerial += 1;
    return { checkoutRef, orderRef: order.orderRef, callbackRef, result: "observed" };
  }

  markAbandoned(checkoutRef: string): ProviderAbandonEvent | null {
    const order = this.orderOfCheckout(checkoutRef);
    if (!order || (order.checkoutState !== "open" && order.checkoutState !== "returned")) {
      return null;
    }
    // Once a provider report is recorded the checkout is decided and cannot be abandoned.
    if (order.paymentState !== "none" && order.paymentState !== "pending") {
      return null;
    }
    order.checkoutState = "abandoned";
    order.version += 1;
    this.counts.abandons += 1;
    this.generation += 1;
    return { checkoutRef, orderRef: order.orderRef };
  }

  deliverHeld(): number {
    const releasing = this.held.splice(0, this.held.length);
    for (const entry of releasing) {
      entry.release();
    }
    return releasing.length;
  }

  deliverLate(): readonly ProviderLateDelivery[] {
    const due = this.late;
    this.late = [];
    return due;
  }

  submit(request: ProviderWriteRequest): Promise<ProviderWriteOutcome> {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return Promise.resolve({
        kind: "tuple-changed",
        field: tuple.field,
        expected: tuple.expected,
        actual: tuple.actual,
        step: String(request.step),
        intentRef: request.intentRef,
        contextKey: request.contextKey,
      });
    }
    const invalid = this.validate(request);
    if (invalid !== null) {
      return Promise.resolve(invalid);
    }
    this.counts.submits += 1;
    const outcome = this.apply(request);
    if (this.scenario === "held-response") {
      return new Promise<ProviderWriteOutcome>((resolve) => {
        this.held.push({ release: () => resolve(outcome) });
      });
    }
    return Promise.resolve(outcome);
  }

  private orderOfCheckout(checkoutRef: string): OrderRecord | undefined {
    return [...this.orders.values()].find((order) => order.checkoutRef === checkoutRef);
  }

  private qualified(actorRef: string): boolean {
    if (this.scenario === "unqualified") {
      return false;
    }
    return actorRef === PROVIDER_DESK_ACTOR;
  }

  private readNow(request: ProviderReadRequest): ProviderReadOutcome {
    const tuple = checkDiscoveryReadTuple(this.expectedTuple);
    if (tuple !== null) {
      return { kind: "tuple-changed", field: tuple.field, expected: tuple.expected, actual: tuple.actual };
    }
    this.snapshotSerial += 1;
    const watermark = this.scenario === "stale" ? PROVIDER_STALE_WATERMARK : PROVIDER_AS_OF;
    const floor = request.watermarkFloor ?? (this.scenario === "stale" ? PROVIDER_STALE_FLOOR : null);
    if (floor !== null && Date.parse(watermark) < Date.parse(floor)) {
      return { kind: "stale", watermark, floor };
    }
    if (this.scenario === "empty") {
      return { kind: "empty", watermark, generation: this.generation, snapshotId: this.snapshotSerial };
    }
    const snapshot: ProviderSnapshot = {
      snapshotId: this.snapshotSerial,
      generation: this.generation,
      watermark,
      scenario: this.scenario,
      environment: {
        providerEnvironment: this.providerEnvironment,
        account: {
          actorRef: request.actorRef,
          qualification: this.qualified(request.actorRef) ? "sandbox-qualified" : "unqualified",
        },
      },
      orders: [...this.orders.values()].map((order) => this.orderView(order)),
      nonClaims:
        this.scenario === "claims-real"
          ? ({ ...PROVIDER_NON_CLAIMS, realPayment: true } as unknown as ProviderNonClaims)
          : { ...PROVIDER_NON_CLAIMS },
    };
    const refused = refuseProviderSnapshot(snapshot);
    if (refused !== null) {
      return refused;
    }
    return { kind: "ready", snapshot };
  }

  private invalid(
    request: { step: unknown; intentRef: unknown; contextKey: unknown },
    code: ProviderInvalidCode,
    detail: string,
  ): ProviderWriteOutcome {
    return {
      kind: "invalid-request",
      step: String(request.step),
      intentRef: String(request.intentRef),
      contextKey: String(request.contextKey),
      code,
      detail,
    };
  }

  private validate(request: ProviderWriteRequest): ProviderWriteOutcome | null {
    if (!nonEmpty(request.intentRef) || !nonEmpty(request.contextKey)) {
      return this.invalid(request, "INTENT", "A write carries an intent reference and a context key.");
    }
    if (!(PROVIDER_STEPS as readonly string[]).includes(request.step)) {
      return this.invalid(request, "STEP", `Step ${String(request.step)} is not a provider step.`);
    }
    if (request.declaredEnvironment !== PROVIDER_SANDBOX || this.providerEnvironment !== PROVIDER_SANDBOX) {
      return this.invalid(
        request,
        "ENVIRONMENT",
        "The source serves the sandbox environment only. A write that declares another environment, or a write against a claimed production environment, is refused.",
      );
    }
    if (!Number.isInteger(request.expectedVersion)) {
      return this.invalid(request, "VERSION", "The expected order version is a whole number.");
    }
    if (request.step === "begin" || request.step === "refund") {
      if (!isProviderRef(request.orderRef, "order")) {
        return this.invalid(request, "IDENTITY", `A ${request.step} names an order reference.`);
      }
    } else {
      if (!isProviderRef(request.orderRef, "order") || !isProviderRef(request.checkoutRef, "checkout")) {
        return this.invalid(request, "IDENTITY", `A ${request.step} names an order and a checkout reference.`);
      }
    }
    if (request.step === "refund" && !isProviderRef(request.paymentRef, "payment")) {
      return this.invalid(request, "IDENTITY", "A refund names the payment observation it links.");
    }
    return null;
  }

  private rejected(request: ProviderWriteRequest, code: ProviderRejectCode, detail: string): ProviderWriteOutcome {
    return {
      kind: "rejected",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      code,
      detail,
    };
  }

  private lost(request: ProviderWriteRequest, message: string): ProviderWriteOutcome {
    return {
      kind: "unknown",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      message,
    };
  }

  private apply(request: ProviderWriteRequest): ProviderWriteOutcome {
    switch (request.step) {
      case "begin":
        return this.applyBegin(request);
      case "observe":
        return this.applyObserve(request);
      case "issue":
        return this.applyIssue(request);
      case "refund":
        return this.applyRefund(request);
      default: {
        const exhaustive: never = request;
        return exhaustive;
      }
    }
  }

  private nonClaims(): ProviderNonClaims {
    return this.scenario === "claims-real" || this.scenario === "receipt-claims"
      ? ({ ...PROVIDER_NON_CLAIMS, realPayment: true } as unknown as ProviderNonClaims)
      : { ...PROVIDER_NON_CLAIMS };
  }

  private confirmed(request: ProviderWriteRequest, order: OrderRecord): ProviderWriteOutcome {
    return {
      kind: "confirmed",
      step: request.step,
      intentRef: request.intentRef,
      contextKey: request.contextKey,
      refs: {
        orderRef: order.orderRef,
        checkoutRef: order.checkoutRef,
        returnRef: order.returnRef,
        paymentRef: order.paymentRef,
        callbackRef: order.callbackRef,
        issuanceRef: order.issuanceRef,
        rightRef: order.rightRef,
        refundRef: order.refundRef,
        orderVersion: order.version,
      },
      nonClaims: this.nonClaims(),
    };
  }

  private gateActorAndOrder(request: ProviderWriteRequest): { order: OrderRecord } | ProviderWriteOutcome {
    if (!this.qualified(request.actorRef)) {
      return this.rejected(
        request,
        "ACCOUNT_UNQUALIFIED",
        `The source does not qualify ${request.actorRef} for the sandbox. Without a test account and provider qualification this is synthetic and refused.`,
      );
    }
    const order = this.orders.get(request.orderRef);
    if (!order) {
      return this.rejected(request, "UNKNOWN_REF", `Order ${request.orderRef} is not at the source.`);
    }
    if (order.version !== request.expectedVersion) {
      return this.rejected(request, "VERSION_STALE", `Order ${order.orderRef} is no longer at version ${request.expectedVersion}. Read again.`);
    }
    return { order };
  }

  private applyBegin(request: Extract<ProviderWriteRequest, { step: "begin" }>): ProviderWriteOutcome {
    const gated = this.gateActorAndOrder(request);
    if (!("order" in gated)) {
      return gated;
    }
    const { order } = gated;
    if (this.scenario === "provider-error") {
      return this.rejected(request, "PROVIDER_ERROR", "The provider refused the checkout. Nothing was opened.");
    }
    const checkoutRef = providerRef("checkout", this.checkoutSerial);
    this.checkoutSerial += 1;
    order.checkoutRef = checkoutRef;
    order.checkoutState = "open";
    order.version += 1;
    this.counts.begins += 1;
    this.generation += 1;
    if (this.scenario === "begin-lost") {
      return this.lost(request, "The response to the checkout never arrived. The source may have opened it.");
    }
    return this.confirmed(request, order);
  }

  private applyObserve(request: Extract<ProviderWriteRequest, { step: "observe" }>): ProviderWriteOutcome {
    const gated = this.gateActorAndOrder(request);
    if (!("order" in gated)) {
      return gated;
    }
    const { order } = gated;
    if (order.checkoutRef !== request.checkoutRef) {
      return this.rejected(request, "IDENTITY_MISMATCH", `Checkout ${request.checkoutRef} does not belong to ${order.orderRef}.`);
    }
    if (order.checkoutState === "abandoned") {
      return this.rejected(request, "CHECKOUT_ABANDONED", `The buyer never returned to ${request.checkoutRef} and the provider closed it.`);
    }
    if (order.checkoutState === "open") {
      return this.rejected(request, "CHECKOUT_OPEN", `The buyer has not returned to ${request.checkoutRef}. An open checkout is not a payment.`);
    }
    if (order.paymentState === "declined") {
      return this.rejected(request, "PAYMENT_DECLINED", `The provider declined the payment for ${request.checkoutRef}.`);
    }
    if (order.paymentState !== "observed") {
      return this.rejected(
        request,
        "PAYMENT_PENDING",
        `The buyer returned to ${request.checkoutRef} and no provider report is recorded. A return landing alone is not a payment observation.`,
      );
    }
    this.counts.observations += 1;
    order.version += 1;
    this.generation += 1;
    if (this.scenario === "observe-lost" || this.scenario === "observe-late") {
      if (this.scenario === "observe-late") {
        if (this.lateResult === "rejected") {
          this.late.push({
            intentRef: request.intentRef,
            contextKey: request.contextKey,
            step: "observe",
            result: "rejected",
            code: "PAYMENT_DECLINED",
          });
        } else {
          this.late.push({
            intentRef: request.intentRef,
            contextKey: request.contextKey,
            step: "observe",
            result: "confirmed",
            code: null,
          });
        }
      }
      return this.lost(request, "The response to the observation never arrived. The source may have recorded it.");
    }
    return this.confirmed(request, order);
  }

  private applyIssue(request: Extract<ProviderWriteRequest, { step: "issue" }>): ProviderWriteOutcome {
    const gated = this.gateActorAndOrder(request);
    if (!("order" in gated)) {
      return gated;
    }
    const { order } = gated;
    if (order.checkoutRef !== request.checkoutRef) {
      return this.rejected(request, "IDENTITY_MISMATCH", `Checkout ${request.checkoutRef} does not belong to ${order.orderRef}.`);
    }
    if (order.checkoutState === "abandoned") {
      return this.rejected(request, "CHECKOUT_ABANDONED", `The provider closed ${request.checkoutRef} after the buyer left. Nothing is issued.`);
    }
    if (order.paymentState !== "observed") {
      return this.rejected(request, "PAYMENT_NOT_OBSERVED", `Order ${order.orderRef} has no recorded payment observation. Nothing is issued.`);
    }
    if (order.issuanceRef !== null) {
      return this.rejected(request, "ALREADY_ISSUED", `Order ${order.orderRef} already has an issuance record.`);
    }
    order.issuanceRef = providerRef("issuance", this.issuanceSerial);
    this.issuanceSerial += 1;
    order.rightRef = providerRef("right", this.rightSerial);
    this.rightSerial += 1;
    order.version += 1;
    this.counts.issues += 1;
    this.generation += 1;
    if (this.scenario === "issue-lost") {
      return this.lost(request, "The response to the issuance never arrived. The source may have recorded it.");
    }
    return this.confirmed(request, order);
  }

  private applyRefund(request: Extract<ProviderWriteRequest, { step: "refund" }>): ProviderWriteOutcome {
    const gated = this.gateActorAndOrder(request);
    if (!("order" in gated)) {
      return gated;
    }
    const { order } = gated;
    if (order.checkoutState === "abandoned") {
      return this.rejected(
        request,
        "CHECKOUT_ABANDONED",
        `The provider closed the checkout on ${order.orderRef} after the buyer left. Nothing is refunded and nothing is queued.`,
      );
    }
    if (order.paymentState !== "observed" || order.paymentRef !== request.paymentRef) {
      return this.rejected(
        request,
        "REFUND_UNAVAILABLE",
        `Order ${order.orderRef} has no recorded payment observation ${request.paymentRef}. Nothing is refunded and nothing is queued.`,
      );
    }
    if (order.refundRef !== null) {
      return this.rejected(request, "ALREADY_REFUNDED", `Order ${order.orderRef} already has a refund record.`);
    }
    order.refundRef = providerRef("refund", this.refundSerial);
    this.refundSerial += 1;
    order.version += 1;
    this.counts.refunds += 1;
    this.generation += 1;
    if (this.scenario === "refund-lost") {
      return this.lost(request, "The response to the refund record never arrived. The source may have recorded it.");
    }
    return this.confirmed(request, order);
  }

  private orderView(order: OrderRecord): ProviderOrderView {
    const paymentNote =
      order.paymentState === "observed"
        ? "A provider report records a payment observation. It is a synthetic observation, not a real payment."
        : order.paymentState === "pending"
          ? "The buyer returned and no provider report is recorded yet. A return landing alone is not a payment observation."
          : order.paymentState === "declined"
            ? "The provider declined the payment."
            : "No payment observation is recorded.";
    const refundNote =
      order.refundRef !== null
        ? "A refund record is linked to the payment observation. It executes nothing and returns no funds."
        : "No refund record.";
    return {
      orderRef: order.orderRef,
      amount: order.amount,
      currency: order.currency,
      version: order.version,
      checkout:
        order.checkoutRef === null
          ? null
          : { checkoutRef: order.checkoutRef, state: order.checkoutState as "open" | "returned" | "abandoned", returnRef: order.returnRef },
      payment: {
        state: order.paymentState,
        paymentRef: order.paymentRef,
        callbackRef: order.callbackRef,
        note: paymentNote,
      },
      issuance: {
        state: order.issuanceRef === null ? "none" : "issued",
        issuanceRef: order.issuanceRef,
        rightRef: order.rightRef,
      },
      refund: { state: order.refundRef === null ? "none" : "recorded", refundRef: order.refundRef, executed: false, note: refundNote },
    };
  }
}
