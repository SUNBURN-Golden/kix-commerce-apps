import {
  INTEGRATION_GATE_LOOPBACK_HOST,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
} from "@kix/protocol-adapter";
import {
  BUYER_FLOW_STAGES,
  NEVER_SENT_ACTIONS,
  PLACE_HOLD_RECORD,
  SENDER_ACTIONS,
  WORKSPACE_ROLES,
  WORKSPACE_RULING,
  WORKSPACE_SENDERS,
  WORKSPACE_SURFACES,
  type SurfaceBinding,
  type WorkspaceRole,
  type WorkspaceSender,
} from "../workspace/registry";

/**
 * Local product handoff. Field names and recorded status only.
 * This module does not build a command body and does not call fetch.
 * A screen in the table is not protocol integration.
 *
 * M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce.
 */

export const HANDOFF_RULING = WORKSPACE_RULING;

export const HANDOFF_ROUTE = "/handoff";

export const FEATURE_STATUSES = ["local-command", "synthetic", "unsupported"] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const HANDOFF_NON_CLAIMS = {
  publicServiceComplete: false,
  realPaymentComplete: false,
  realAdmissionComplete: false,
  productionReadiness: false,
  productionConformance: false,
  protocolTruth: false,
  publicDeploy: false,
  releaseState: "NOT_AUTHORIZED",
  qualificationState: "UNQUALIFIED",
} as const;

export const HANDOFF_PINS = {
  contractOpenApiSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
  gateOpenApiSha256: OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256,
  protocolMergeSha: OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha,
  sdkDigest: null,
  manifestDigest: null,
  vectorDigest: null,
  consumedProducerChange: false,
} as const;

export const INTEGRATION_REASON = "A screen does not complete protocol integration.";

export const FIRST_RUN = {
  install: "npm install",
  test: "npm test",
  ciStubTest: "KIX_REQUIRE_GATE=0 npm test",
  dev: "npm run dev",
  port: 5173,
  reload: "A reload clears page-load state and does not send again.",
  ciSkip: "KIX_REQUIRE_GATE=0 skips the live gate. That skip is not a live-gate pass.",
} as const;

export const STUB_MODE = {
  default: true,
  modeValues: ["unset", "stub"],
  environment: "stub",
  baseUrlOpensHttp: false,
  proofMode: "stub",
} as const;

export const LOOPBACK = {
  modes: ["http", "integration-http"],
  environment: "integration-http",
  scheme: "http",
  host: INTEGRATION_GATE_LOOPBACK_HOST,
  exampleBase: `http://${INTEGRATION_GATE_LOOPBACK_HOST}:8765`,
  oneAttempt: true,
  retry: false,
  idempotencyKey: false,
  followRedirects: false,
  stubFallback: false,
  proxy: false,
  browserCors: false,
  thisRepoStartsGate: false,
} as const;

export const GATE_START = {
  repo: "kix-protocol",
  command: "python3 -m integration_gate --port 8765",
  startedByThisRepo: false,
  bindHost: INTEGRATION_GATE_LOOPBACK_HOST,
} as const;

export const STARTUP_FAULTS = [
  {
    id: "missing-base",
    when: "HTTP mode without VITE_KIX_PROTOCOL_API_BASE",
    result: "Startup throws. The desk does not fall back to the stub.",
  },
  {
    id: "public-mode",
    when: "A mode named production, public, or live",
    result: "Refused with PRODUCTION_ENVIRONMENT. The stub is not selected.",
  },
  {
    id: "bad-host",
    when: `The base is https, localhost, a missing port, port 0, or any host other than ${INTEGRATION_GATE_LOOPBACK_HOST}`,
    result: "Rejected before a request.",
  },
  {
    id: "closed-port",
    when: "The loopback port is closed",
    result: "GATE_UNAVAILABLE after one attempt. No stub fallback and no retry.",
  },
  {
    id: "browser-cors",
    when: "The reviewed gate answers no CORS preflight",
    result: "The banner stays unavailable. There is no proxy. A Node loopback run is not a browser pass.",
  },
] as const;

export const OUTCOME_SEPARATION = [
  {
    klass: "UNKNOWN",
    means: "The call may have applied. It is not a rejection and not a success.",
    next: "Fence the next write. Do not retry and do not mint an operation id.",
  },
  {
    klass: "NOT_BOUND",
    means: "The desk method is not sent.",
    next: "Do not map it onto another body.",
  },
  {
    klass: "STALE",
    means: "A stale response does not update the track.",
    next: "Do not retry. Do not treat it as a success.",
  },
  {
    klass: "REJECT",
    means: "The call was rejected.",
    next: "Leave it rejected. Do not relabel it unknown or success.",
  },
] as const;

const DEGRADED_CODES = ["NOT_READY", "OVERLOADED", "CORE_BUSY", "JOURNAL_BUDGET"] as const;

const UNAVAILABLE_CODES = [
  "GATE_UNAVAILABLE",
  "GATE_TRANSPORT",
  "GATE_STATUS",
  "REQUEST_TIMEOUT",
  "STALE_RESPONSE",
  "DURABILITY_DIVERGENCE",
  "PRODUCTION_ENDPOINT",
  "PRODUCTION_ENVIRONMENT",
  "HEADER_TOO_LARGE",
  "BODY_TOO_LARGE",
  "INTERNAL_ERROR",
  "RETRY_FORBIDDEN",
] as const;

export interface TransportDiagnosis {
  readonly code: string;
  readonly transport: "degraded" | "unavailable" | "rejected";
  readonly retry: false;
  readonly fallbackToStub: false;
  readonly confirmsSuccess: false;
  readonly fixtureClass: "STALE" | null;
  readonly note: string;
}

function transportRow(
  code: string,
  transport: TransportDiagnosis["transport"],
  note: string,
  fixtureClass: "STALE" | null = null,
): TransportDiagnosis {
  return {
    code,
    transport,
    retry: false,
    fallbackToStub: false,
    confirmsSuccess: false,
    fixtureClass,
    note,
  };
}

export const TRANSPORT_DIAGNOSES: readonly TransportDiagnosis[] = [
  ...DEGRADED_CODES.map((code) =>
    transportRow(
      code,
      "degraded",
      "The loopback gate is degraded. The client does not retry and does not fall back to the stub. This is not production readiness.",
    ),
  ),
  ...UNAVAILABLE_CODES.map((code) =>
    transportRow(
      code,
      "unavailable",
      code === "STALE_RESPONSE"
        ? "Fixture class STALE. Not a success. A traced protocol error may still show as unknown. Those labels are not collapsed."
        : "The loopback gate is unavailable. The client does not retry and does not fall back to the stub.",
      code === "STALE_RESPONSE" ? "STALE" : null,
    ),
  ),
  transportRow(
    "EVENT_EXISTS",
    "rejected",
    "An explicit reject stays a reject. It is not unknown and not a success. The client does not retry with a new operation id.",
  ),
];

const REFUSED_CLAIMS = [
  "payment complete",
  "admission complete",
  "refund complete",
  "live payment",
  "funds moved",
  "public service",
  "integration complete",
] as const;

export function claimRefused(text: string): boolean {
  const lowered = text.trim().toLowerCase();
  if (lowered.length === 0) {
    return false;
  }
  return REFUSED_CLAIMS.some((phrase) => lowered.includes(phrase));
}

export interface DiagnosisHit {
  readonly kind: "outcome" | "transport";
  readonly title: string;
  readonly detail: string;
  readonly confirmsSuccess: false;
}

export function lookupDiagnosis(code: string): { kind: "empty" } | { kind: "refused" } | { kind: "unknown" } | DiagnosisHit {
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { kind: "empty" };
  }
  if (claimRefused(trimmed)) {
    return { kind: "refused" };
  }
  const outcome = OUTCOME_SEPARATION.find((row) => row.klass === trimmed);
  if (outcome) {
    return {
      kind: "outcome",
      title: outcome.klass,
      detail: `${outcome.means} ${outcome.next}`,
      confirmsSuccess: false,
    };
  }
  const transport = TRANSPORT_DIAGNOSES.find((row) => row.code === trimmed);
  if (transport) {
    const fixture = transport.fixtureClass ? ` Fixture class ${transport.fixtureClass}.` : "";
    return {
      kind: "transport",
      title: `${transport.code} · ${transport.transport}`,
      detail: `${transport.note}${fixture} Retry is off. Stub fallback is off.`,
      confirmsSuccess: false,
    };
  }
  return { kind: "unknown" };
}

export interface PendingProducer {
  readonly id: string;
  readonly catalogue: "pending";
  readonly connected: false;
  readonly implementedHere: false;
  readonly waitingSurface: string | null;
  readonly note: string;
}

export const PENDING_PRODUCERS = [
  {
    id: "bind-list-read",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "box-office-catalog",
    note: "The contract-only catalogue has no list or read command. listPerformances stays on the stub.",
  },
  {
    id: "browser-gate-path",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "operator-transport",
    note: "The browser path to the loopback gate is not open. There is no proxy.",
  },
  {
    id: "bind-settlement-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "box-office-settlement",
    note: "Settlement desk methods stay not-bound. The mock case is not funds.",
  },
  {
    id: "bind-reservation-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "reservation-case",
    note: "Reservation desk methods stay not-bound. Stub phases are not catalogue commands.",
  },
  {
    id: "bind-admission-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "admission-credential",
    note: "admit stays uncomposed. A credential label and a health probe are not entry.",
  },
  {
    id: "bind-resale-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "resale-desk",
    note: "Resale desk methods stay not-bound. This desk is not a live marketplace.",
  },
  {
    id: "bind-credit-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-desk",
    note: "The catalogue has no credit command. drawCredit is not a disbursement.",
  },
  {
    id: "bind-wave4-pointers",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "booking-journey",
    note: "placeHold stays not-bound with consideredAction reserve_listing. This packet does not remap it.",
  },
  {
    id: "primary-price-fee-ui",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "booking-journey",
    note: "Price and fee display stays UNDETERMINED. This packet does not calculate an amount.",
  },
  {
    id: "api-state-distinction",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "refund-return-desk",
    note: "The five order states are shown as separate synthetic cells. The real state distinction over a producer read stays on that pending node.",
  },
  {
    id: "refund-surface",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "refund-return-desk",
    note: "refund_ticket, void_unissued, adjust_pg_cancel, and observe_return are pinned and not sent. The refund desk is a synthetic record. COMPENSATION_UNDEFINED stays visible.",
  },
  {
    id: "c-discovery-live",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "discovery-live-read",
    note: "Synthetic rows are not a live query projection.",
  },
  {
    id: "c-inventory-venue",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "inventory-venue-select",
    note: "Seat and GA selection is a synthetic page. A real inventory and queue read stays on that pending node.",
  },
  {
    id: "c-platform-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-journey-trade",
    note: "The multi-channel trade page is synthetic. A real listing, trade, payment, transfer, and refund connection stays on that pending node.",
  },
  {
    id: "c-async-session-fence",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-journey-trade",
    note: "The write fence and the unknown handling on the trade page live in this page load only. Durable session recovery stays on that pending node.",
  },
  {
    id: "c-merchant-operations",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "merchant-operations",
    note: "The merchant workroom is synthetic. A real event, listing, trade, and settlement-obligation read model and a real producer export stay on that pending node.",
  },
  {
    id: "c-credit-origination",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-origination",
    note: "The origination desk is synthetic. A real claim basis, policy revision, consent, document, review, commitment, and drawdown permission read model and a real producer connection stay on that pending node.",
  },
  {
    id: "c-credit-servicing-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-servicing",
    note: "The servicing desk is synthetic. A real draw, observation, reservation, exposure, schedule, payment, allocation, reversal, adjustment, and case read model and a real producer connection stay on that pending node.",
  },
  {
    id: "c-finance-operations",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "finance-operations",
    note: "The finance desk is synthetic. A real reconciliation case, source cut, payee allocation, unapplied remainder, and accounting export read model and a real producer connection stay on that pending node.",
  },
  {
    id: "c-marketing-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "marketing-journey",
    note: "The benefit journey is synthetic. A real membership eligibility, presale priority, usage count, coupon budget, referral attribution, apply, and reclaim read model and a real producer connection stay on that pending node, which waits on kix-protocol:wave7-marketing-contracts. A full CRM product is not built here.",
  },
  {
    id: "consume-p-sdk-0",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: null,
    note: "No SDK is consumed. SDK, manifest, and vector digests stay null.",
  },
  {
    id: "c-delegated-assistant",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "delegated-assistant",
    note: "The delegation assistant is synthetic. A real grant, proposal, approval, and command read model and a real producer connection stay on that pending node, which waits on kix-protocol:ai-delegation-execution-decision and kix-protocol:k-authority-qualification. Nothing here transfers, refunds, or signs.",
  },
  {
    id: "delegation-surface",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "delegated-assistant",
    note: "The delegation screen on /assistant is synthetic query/propose scope. Execution delegation stays unadopted. Nothing here transfers, refunds, or signs.",
  },
  {
    id: "c-tenant-permissions",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "tenant-permissions",
    note: "The permissions desk is synthetic. A real organization, role assignment, resource scope, maker/checker, revocation, account change, sensitive export, and audit read model and a real producer connection stay on that pending node, which waits on kix-protocol:k-operator-contract. A hidden control is never enforcement, and nothing here grants a real permission.",
  },
  {
    id: "c-notification-inbox",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "notification-inbox",
    note: "The notification inbox is synthetic. A real contracted-event feed, dedupe, read state, offered-action resolve, and support-inquiry read model and a real producer connection stay on that pending node, which waits on kix-protocol:k-operator-contract. An arrival confirms no economic effect, and no external send or provider API is wired.",
  },
  {
    id: "c-provider-connected-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "provider-connected-journey",
    note: "The provider journey is synthetic. A real approved-provider checkout, payment observation, issuance, and refund connection stays on that pending node, which waits on kix-protocol:k-provider-sandbox and kix-protocol:k-authority-qualification. A return landing is not a payment observation, a sandbox success is not a real payment, and a refund record executes nothing.",
  },
  {
    id: "c-marketplace-performance",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "marketplace-performance-bench",
    note: "The marketplace scale bench is synthetic. A real large-marketplace read, queue, device measurement, and producer load qualification stays on that pending node, which waits on kix-protocol:ps-07-scale-qualification. Browser-boundary measurements are never a producer load figure, and an emulated device is never real mobile evidence.",
  },
  {
    id: "c-installable-mobile",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "installable-mobile-shell",
    note: "The installable mobile shell is synthetic. A real packaging, install, update, session, vault, presentation, and device read model and a real producer connection stay on that pending node. A stored item is a copy that mints no admission, the device clock never decides validity, and an app resume re-executes no uncertain write.",
  },
  {
    id: "c-platform-operational-qualification",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-operational-qualification",
    note: "The qualification packet is a synthetic record of stub journeys. A real platform, finance, and marketing operational qualification stays on that pending node, which waits on kix-protocol:ps-07-scale-qualification, kix-protocol:cr-10-credit-qualification, and the unpromoted commerce-integration-closeout. A per-call confirmed is not a journey close, and the packet is never a public deployment, a real-money approval, or a service qualification.",
  },
  {
    id: "c-journey-identity",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "journey-identity",
    note: "The journey context desk is synthetic. A real context-bound identity registry and a real read-projection evidence contract stay on that pending node, which waits on kix-protocol:protocol-runtime-boundary-register, protocol-canonical-identity-conformance, protocol-read-projection-evidence, and contract-compatibility-profile. The context key here is app-internal and is never a public identifier.",
  },
  {
    id: "c-platform-release",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-release",
    note: "The release candidate packet is a synthetic record scoped to the live tuple. A real final review, user acceptance, RELEASE gate, and operations handoff stays on that pending node, which waits on kix-protocol:k-platform-release and the user RELEASE decision. Nothing is released, deployed, or operated.",
  },
] as const satisfies readonly PendingProducer[];

const UNSUPPORTED_SURFACE_IDS = new Set(["operator-transport", "accessibility-baseline"]);

export function featureStatusFor(surface: {
  id: string;
  binding: SurfaceBinding;
  actions: readonly string[];
  sender: WorkspaceSender | null;
}): FeatureStatus {
  if (UNSUPPORTED_SURFACE_IDS.has(surface.id) || surface.binding === "not-bound" || surface.binding === "planned") {
    return "unsupported";
  }
  if (surface.binding === "published-bound" && surface.sender !== null && surface.actions.length > 0) {
    return "local-command";
  }
  if (surface.binding === "stub-only" || surface.binding === "no-published-command") {
    return "synthetic";
  }
  return "unsupported";
}

export interface FeatureRow {
  readonly id: string;
  readonly route: string;
  readonly role: WorkspaceRole;
  readonly status: FeatureStatus;
  readonly screenExists: boolean;
  readonly protocolIntegrationComplete: false;
  readonly integrationReason: string;
  readonly commands: readonly string[];
  readonly deskMethods: readonly string[];
  readonly pendingProducers: readonly string[];
  readonly evidenceTask: string;
  readonly note: string;
}

export const FEATURE_ROWS: readonly FeatureRow[] = WORKSPACE_SURFACES.map((surface) => {
  const status = featureStatusFor(surface);
  return {
    id: surface.id,
    route: surface.route,
    role: surface.role,
    status,
    screenExists: surface.implemented && surface.pageControl && surface.route.startsWith("/"),
    protocolIntegrationComplete: false,
    integrationReason: INTEGRATION_REASON,
    commands: status === "local-command" ? surface.actions : [],
    deskMethods: surface.deskMethods,
    pendingProducers: PENDING_PRODUCERS.filter((row) => row.waitingSurface === surface.id).map((row) => row.id),
    evidenceTask: surface.taskId,
    note: surface.provenanceNote,
  };
});

export function featureById(id: string): FeatureRow | undefined {
  return FEATURE_ROWS.find((row) => row.id === id);
}

export const LOCAL_COMMAND_SCREENS = FEATURE_ROWS.filter((row) => row.status === "local-command");

export const UNCONNECTED_SCREENS = FEATURE_ROWS.filter((row) => row.screenExists && row.status !== "local-command");

export interface SupportedCommand {
  readonly action: string;
  readonly sender: WorkspaceSender;
  readonly surfaces: readonly string[];
  readonly localOnly: true;
  readonly protocolIntegrationComplete: false;
}

export const SUPPORTED_COMMANDS: readonly SupportedCommand[] = WORKSPACE_SENDERS.flatMap((sender) =>
  SENDER_ACTIONS[sender].map((action) => ({
    action,
    sender,
    surfaces: FEATURE_ROWS.filter((row) => {
      const surface = WORKSPACE_SURFACES.find((item) => item.id === row.id);
      return row.commands.includes(action) && surface?.sender === sender;
    }).map((row) => row.id),
    localOnly: true as const,
    protocolIntegrationComplete: false as const,
  })),
);

export interface RoleStep {
  readonly id: string;
  readonly role: WorkspaceRole;
  readonly route: string;
  readonly link: string | null;
  readonly surfaces: readonly string[];
  readonly statuses: readonly FeatureStatus[];
  readonly protocolIntegrationComplete: false;
  readonly note: string;
}

function stepFromSurfaces(id: string, role: WorkspaceRole, surfaces: readonly string[], note: string): RoleStep {
  const rows = surfaces.map((surfaceId) => featureById(surfaceId));
  const routes = [...new Set(rows.map((row) => row?.route ?? "(none)"))];
  const only = routes.length === 1 ? routes[0] : null;
  const link = only && only.startsWith("/") && !only.includes(":") ? only : null;
  return {
    id,
    role,
    route: routes.join(", ") || "(none)",
    link,
    surfaces,
    statuses: rows.map((row) => row?.status ?? "unsupported"),
    protocolIntegrationComplete: false,
    note,
  };
}

export const ROLE_JOURNEYS = {
  buyer: [
    ...BUYER_FLOW_STAGES.map((stage) => stepFromSurfaces(stage.id, "buyer", stage.surfaces, stage.note)),
    stepFromSurfaces(
      "marketing",
      "buyer",
      ["marketing-hub", "marketing-m01", "marketing-m02", "marketing-m03", "marketing-m04", "marketing-m05", "marketing-journey"],
      "M01–M04 stay session stubs. M05 posts set_consent and authorize_marketing. The label stays 미착수. CRM send stays none. The benefit journey is synthetic: a notice or an application confirms no purchase and pays no reward, and it reads consent without posting it.",
    ),
    stepFromSurfaces(
      "delegated-assistant",
      "buyer",
      ["delegated-assistant"],
      "Synthetic delegation assistant. Request text is untrusted intent and never authority, a proposal is not an approval, and only the approve control on a recorded open proposal sends one synthetic command once. An unadopted execution delegation stays in query/propose mode, and nothing here moves funds, transfers a right, or signs.",
    ),
  ],
  organizer: [
    stepFromSurfaces(
      "organizer-console",
      "organizer",
      ["organizer-console"],
      "Six local commands, each its own request. The operator actor string is not an authentication result.",
    ),
    stepFromSurfaces(
      "organizer-workspace",
      "organizer",
      ["organizer-workspace"],
      "Preview, then one send. The list is not one atomic transaction.",
    ),
    stepFromSurfaces(
      "box-office-settlement",
      "organizer",
      ["box-office-settlement"],
      "Mock settlement case. Shares are not computed. This is not funds.",
    ),
    stepFromSurfaces(
      "merchant-operations",
      "organizer",
      ["merchant-operations"],
      "Synthetic merchant read and export. A sales figure stays an observation, never a settled or lendable figure.",
    ),
    stepFromSurfaces(
      "credit-origination",
      "organizer",
      ["credit-origination"],
      "Synthetic credit origination. A submission is not a decision, an approval is not a commitment, and a recorded request is not a disbursement.",
    ),
  ],
  operator: [
    stepFromSurfaces(
      "operator-transport",
      "operator",
      ["operator-transport"],
      "The banner is a probe. A probe is not payment, issuance, or admission. Browser HTTP stays unavailable.",
    ),
    stepFromSurfaces(
      "receipt-explorer",
      "operator",
      ["receipt-explorer"],
      "Explains receipts already on this page load. Unknown stays unknown. The page does not post.",
    ),
    stepFromSurfaces(
      "credit-desk",
      "operator",
      ["credit-desk"],
      "Mock credit case. No disbursement and no catalogue credit command.",
    ),
    stepFromSurfaces(
      "credit-servicing",
      "operator",
      ["credit-servicing"],
      "Synthetic credit servicing. A draw instruction is not a disbursement, a partial repayment restores no limit, and a case closure extinguishes no debt.",
    ),
    stepFromSurfaces(
      "finance-operations",
      "operator",
      ["finance-operations"],
      "Synthetic finance queue and export. A mismatch is reviewed against its original trade, a proposal and an approval change no economic state, and nothing forces a ledger to match.",
    ),
    stepFromSurfaces(
      "tenant-permissions",
      "operator",
      ["tenant-permissions"],
      "Synthetic role workspaces. A hidden control is never enforcement, a proposal and an approval are records, and a role switch mixes no old session rows.",
    ),
    stepFromSurfaces(
      "notification-inbox",
      "operator",
      ["notification-inbox"],
      "Synthetic notification inbox and support material. An arrival confirms no economic effect, a stale-issued row's action resolves nothing, and dedupe drops a second delivery once.",
    ),
    stepFromSurfaces(
      "marketplace-performance-bench",
      "operator",
      ["marketplace-performance-bench"],
      "Synthetic scale bench. A bounded window over a lazy stream, queue admission as browse access only, dropped stale answers, and browser-boundary measurements that never claim a real device or a producer load share.",
    ),
    stepFromSurfaces(
      "installable-mobile-shell",
      "operator",
      ["installable-mobile-shell"],
      "Synthetic mobile shell. Stored items stay copies that mint no admission, the device clock never decides validity, and an app resume re-executes no uncertain write.",
    ),
    stepFromSurfaces(
      "platform-operational-qualification",
      "operator",
      ["platform-operational-qualification"],
      "Synthetic qualification packet. A per-call confirmed is not a journey close, the five denominators never merge, and the packet is never promoted to a deployment or a real-money approval.",
    ),
    stepFromSurfaces(
      "platform-release",
      "operator",
      ["platform-release"],
      "Synthetic release candidate. The packet is scoped to the live tuple, decides nothing, and never starts a public deploy, real money, or real operations before the user RELEASE decision.",
    ),
    stepFromSurfaces(
      "accessibility-baseline",
      "operator",
      ["accessibility-baseline"],
      "Presentation only. No added route and no command. Price and fee display stays UNDETERMINED.",
    ),
    {
      id: "local-handoff",
      role: "operator" as const,
      route: HANDOFF_ROUTE,
      link: HANDOFF_ROUTE,
      surfaces: [],
      statuses: ["unsupported"] as const,
      protocolIntegrationComplete: false as const,
      note: "This page is the local handoff. It does not post. A screen here is not protocol integration.",
    },
  ],
} as const satisfies Record<WorkspaceRole, readonly RoleStep[]>;

export interface PreservedEvidence {
  readonly id: string;
  readonly doc: string;
  readonly anchor: string;
}

/** The original ten program nodes. This packet cites them and does not replace them. */
export const ORIGINAL10_EVIDENCE = [
  {
    id: "w6a-journey-map",
    doc: "docs/wave-6a-journey-map-apps-bind.md",
    anchor: "does not map `refund_ticket`",
  },
  {
    id: "w6a-journey-adapter",
    doc: "docs/wave-6a-journey-adapter-apps-bind.md",
    anchor: "Wave 7 stays shut until `w6a-evidence` merges",
  },
  {
    id: "w6a-journey-test",
    doc: "docs/wave-6a-journey-test-apps-bind.md",
    anchor: "live loopback journey test and the stub step-sequence parity",
  },
  {
    id: "w6a-ui-skeleton",
    doc: "docs/wave-6a-ui-skeleton-apps-bind.md",
    anchor: "This screen does not add a command, a read, a retry, or a desk binding.",
  },
  {
    id: "w6a-evidence",
    doc: "docs/wave-6a-evidence-apps-bind.md",
    anchor: "It is not a purchase-to-admission journey.",
  },
  {
    id: "organizer-admin-console",
    doc: "docs/organizer-admin-console-apps-bind.md",
    anchor: "organizer event lifecycle",
  },
  {
    id: "gift-surface",
    doc: "docs/gift-surface-apps-bind.md",
    anchor: "P02 transfer",
  },
  {
    id: "doc-m05-label",
    doc: "docs/wave7-marketing-m01-m05.md",
    anchor: "M05 stays **미착수**",
  },
  {
    id: "w7-marketing-align",
    doc: "docs/wave7-marketing-align-apps-bind.md",
    anchor: "M01–M05 stub sits against the published contract-only catalogue",
  },
  {
    id: "w7-m05-consent-bind",
    doc: "docs/m05-consent-bind-apps-bind.md",
    anchor: "CRM campaign editing stays out",
  },
] as const satisfies readonly PreservedEvidence[];

export const LOCAL_SURFACE_EVIDENCE = [
  {
    id: "c-workspace-design",
    doc: "docs/workspace-design-apps-bind.md",
    anchor: "발견 → 선택 → 예약 → 결제 상태 → 권리 → 입장 → 환불",
  },
  {
    id: "c-buyer-workspace",
    doc: "docs/c-buyer-workspace-apps-bind.md",
    anchor: "read-only buyer workspace at `/buyer`",
  },
  {
    id: "c-organizer-workspace",
    doc: "docs/c-organizer-workspace-apps-bind.md",
    anchor: "sends one command at a time",
  },
  {
    id: "c-receipt-explorer",
    doc: "docs/c-receipt-explorer-apps-bind.md",
    anchor: "redacted support export",
  },
  {
    id: "c-discovery-prototype",
    doc: "docs/c-discovery-prototype-apps-bind.md",
    anchor: "The rows are a fixture.",
  },
  {
    id: "c-accessibility-baseline",
    doc: "docs/c-accessibility-baseline-apps-bind.md",
    anchor: "It adds no route and no command.",
  },
  {
    id: "c-contract-fixture-library",
    doc: "docs/c-contract-fixture-library-apps-bind.md",
    anchor: "A failed live call is not replaced with a stub success.",
  },
  {
    id: "c-discovery-live-stub",
    doc: "docs/c-discovery-live-stub-apps-bind.md",
    anchor: "A projection row confirms no sale, no ownership, and no payment.",
  },
  {
    id: "c-inventory-venue-stub",
    doc: "docs/c-inventory-venue-stub-apps-bind.md",
    anchor: "the page shows counts, never amounts.",
  },
  {
    id: "c-platform-journey-stub",
    doc: "docs/c-platform-journey-stub-apps-bind.md",
    anchor: "Its writes land on an in-process synthetic source, which is a stand-in for the producer.",
  },
  {
    id: "c-merchant-operations-stub",
    doc: "docs/c-merchant-operations-stub-apps-bind.md",
    anchor: "no client-side sum is the financial truth",
  },
  {
    id: "c-credit-origination-stub",
    doc: "docs/c-credit-origination-stub-apps-bind.md",
    anchor: "an approval is not a commitment",
  },
  {
    id: "c-credit-servicing-journey-stub",
    doc: "docs/c-credit-servicing-journey-stub-apps-bind.md",
    anchor: "a case closure is not an extinguished debt",
  },
  {
    id: "c-finance-operations-stub",
    doc: "docs/c-finance-operations-stub-apps-bind.md",
    anchor: "no actor on this desk holds the authority to change economic state",
  },
  {
    id: "c-marketing-journey-stub",
    doc: "docs/c-marketing-journey-stub-apps-bind.md",
    anchor: "an application confirms no purchase and pays no reward",
  },
  {
    id: "c-delegated-assistant-stub",
    doc: "docs/c-delegated-assistant-stub-apps-bind.md",
    anchor: "a sentence is never authority",
  },
  {
    id: "c-tenant-permissions-stub",
    doc: "docs/c-tenant-permissions-stub-apps-bind.md",
    anchor: "a hidden control is never enforcement",
  },
  {
    id: "c-notification-inbox-stub",
    doc: "docs/c-notification-inbox-stub-apps-bind.md",
    anchor: "an arrival confirms no economic effect",
  },
  {
    id: "c-provider-connected-journey-stub",
    doc: "docs/c-provider-connected-journey-stub-apps-bind.md",
    anchor: "a return landing is never a payment observation",
  },
  {
    id: "c-marketplace-performance-stub",
    doc: "docs/c-marketplace-performance-stub-apps-bind.md",
    anchor: "an emulated device is never real mobile evidence",
  },
  {
    id: "c-installable-mobile-stub",
    doc: "docs/c-installable-mobile-stub-apps-bind.md",
    anchor: "an app resume re-executes nothing",
  },
  {
    id: "c-platform-operational-qualification-stub",
    doc: "docs/c-platform-operational-qualification-stub-apps-bind.md",
    anchor: "a per-call confirmed is never an end-to-end journey close",
  },
  {
    id: "c-platform-release-stub",
    doc: "docs/c-platform-release-stub-apps-bind.md",
    anchor: "an approval under a different source or contract tuple is never reused",
  },
  {
    id: "c-refund-return-states-stub",
    doc: "docs/c-refund-return-states-stub-apps-bind.md",
    anchor: "Return-required is its own state",
  },
  {
    id: "c-journey-identity-stub",
    doc: "docs/c-journey-identity-stub-apps-bind.md",
    anchor: "a receipt minted under another context is never this journey's evidence",
  },
] as const satisfies readonly PreservedEvidence[];

export function filterFeatures(query: string): readonly FeatureRow[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return FEATURE_ROWS;
  }
  return FEATURE_ROWS.filter((row) => {
    const haystack = [row.id, row.route, row.role, row.status, row.evidenceTask, ...row.commands, ...row.pendingProducers, row.note]
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export interface HandoffView {
  readonly state: "loading" | "ready" | "empty" | "error";
  readonly focusId: "handoff-query" | "handoff-code" | null;
  readonly error: string | null;
  readonly features: readonly FeatureRow[];
  readonly diagnosis: DiagnosisHit | null;
  readonly role: WorkspaceRole;
  readonly steps: readonly RoleStep[];
}

const UNKNOWN_CODE = "This code is not in the local diagnosis list. It is not a success.";
const REFUSED_TEXT = "This handoff refuses that completion claim. A screen is not protocol integration.";

export function buildHandoffView(input: {
  phase: "loading" | "settled";
  query: string;
  code: string;
  role: WorkspaceRole;
}): HandoffView {
  const steps = ROLE_JOURNEYS[input.role];
  if (input.phase === "loading") {
    return {
      state: "loading",
      focusId: null,
      error: null,
      features: [],
      diagnosis: null,
      role: input.role,
      steps: [],
    };
  }
  if (claimRefused(input.query)) {
    return {
      state: "error",
      focusId: "handoff-query",
      error: REFUSED_TEXT,
      features: [],
      diagnosis: null,
      role: input.role,
      steps,
    };
  }
  const found = lookupDiagnosis(input.code);
  if (found.kind === "refused") {
    return {
      state: "error",
      focusId: "handoff-code",
      error: REFUSED_TEXT,
      features: [],
      diagnosis: null,
      role: input.role,
      steps,
    };
  }
  if (found.kind === "unknown") {
    return {
      state: "error",
      focusId: "handoff-code",
      error: UNKNOWN_CODE,
      features: filterFeatures(input.query),
      diagnosis: null,
      role: input.role,
      steps,
    };
  }
  const features = filterFeatures(input.query);
  return {
    state: features.length === 0 ? "empty" : "ready",
    focusId: null,
    error: null,
    features,
    diagnosis: found.kind === "empty" ? null : found,
    role: input.role,
    steps,
  };
}

export function nextRole(role: WorkspaceRole, key: string): WorkspaceRole | null {
  const index = WORKSPACE_ROLES.indexOf(role);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return WORKSPACE_ROLES[(index + 1) % WORKSPACE_ROLES.length] ?? null;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return WORKSPACE_ROLES[(index - 1 + WORKSPACE_ROLES.length) % WORKSPACE_ROLES.length] ?? null;
  }
  if (key === "Home") {
    return WORKSPACE_ROLES[0] ?? null;
  }
  if (key === "End") {
    return WORKSPACE_ROLES[WORKSPACE_ROLES.length - 1] ?? null;
  }
  return null;
}

export const PLACE_HOLD_HANDOFF = PLACE_HOLD_RECORD;

export const NEVER_SENT_HANDOFF = NEVER_SENT_ACTIONS;
