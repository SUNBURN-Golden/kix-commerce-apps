import { messages as sourceCopy } from "../i18n/messages/handoff--packet";
import { sourceMessage } from "../i18n/source-message";
import {
  INTEGRATION_GATE_LOOPBACK_HOST,
  KIX_SDK_0_PIN,
  OPENAPI_CONTRACT_PIN,
  OPENAPI_INTEGRATION_GATE_PIN,
  KIX_SDK_0_CONSUMPTION_DIGESTS,
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
  ...KIX_SDK_0_CONSUMPTION_DIGESTS,
  consumedProducerChange: true,
} as const;

export const INTEGRATION_REASON = sourceCopy.en["s7x"];

export const FIRST_RUN = {
  install: sourceCopy.en["s13c"],
  test: sourceCopy.en["s13e"],
  ciStubTest: sourceCopy.en["spt"],
  dev: sourceCopy.en["s13d"],
  port: 5173,
  reload: sourceCopy.en["s6u"],
  ciSkip: sourceCopy.en["spu"],
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
  command: sourceCopy.en["s1ah"],
  startedByThisRepo: false,
  bindHost: INTEGRATION_GATE_LOOPBACK_HOST,
} as const;

export const STARTUP_FAULTS = [
  {
    id: "missing-base",
    when: sourceCopy.en["snj"],
    result: sourceCopy.en["s1mh"],
  },
  {
    id: "public-mode",
    when: sourceCopy.en["s35"],
    result: sourceCopy.en["s1ev"],
  },
  {
    id: "bad-host",
    when: sourceMessage(sourceCopy.en["p.t182"], { v1: INTEGRATION_GATE_LOOPBACK_HOST }),
    result: sourceCopy.en["s1ey"],
  },
  {
    id: "closed-port",
    when: sourceCopy.en["s1u9"],
    result: sourceCopy.en["smd"],
  },
  {
    id: "browser-cors",
    when: sourceCopy.en["s1x9"],
    result: sourceCopy.en["s1qg"],
  },
] as const;

export const OUTCOME_SEPARATION = [
  {
    klass: "UNKNOWN",
    means: sourceCopy.en["s1qo"],
    next: sourceCopy.en["skz"],
  },
  {
    klass: "NOT_BOUND",
    means: sourceCopy.en["s1rq"],
    next: sourceCopy.en["sh7"],
  },
  {
    klass: "STALE",
    means: sourceCopy.en["s8e"],
    next: sourceCopy.en["sh9"],
  },
  {
    klass: "REJECT",
    means: sourceCopy.en["s1qp"],
    next: sourceCopy.en["sql"],
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
      sourceCopy.en["s1u7"],
    ),
  ),
  ...UNAVAILABLE_CODES.map((code) =>
    transportRow(
      code,
      "unavailable",
      code === "STALE_RESPONSE"
        ? sourceCopy.en["sll"]
        : sourceCopy.en["s1u8"],
      code === "STALE_RESPONSE" ? "STALE" : null,
    ),
  ),
  transportRow(
    "EVENT_EXISTS",
    "rejected",
    sourceCopy.en["s45"],
  ),
];

const REFUSED_CLAIMS = [
  sourceCopy.en["s17h"],
  sourceCopy.en["s1l"],
  sourceCopy.en["s1ep"],
  sourceCopy.en["src"],
  sourceCopy.en["sma"],
  sourceCopy.en["s1aa"],
  sourceCopy.en["soc"],
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
    const fixture = transport.fixtureClass ? sourceMessage(sourceCopy.en["p.t183"], { v1: transport.fixtureClass }) : "";
    return {
      kind: "transport",
      title: `${transport.code} · ${transport.transport}`,
      detail: sourceMessage(sourceCopy.en["p.t184"], { v1: transport.note, v2: fixture }),
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

/**
 * A producer change this repo consumed. The p-sdk-0 BOOTSTRAP tuple is vendored
 * under packages/protocol-adapter/vendor/kix-sdk-0 and pin-checked at load time
 * (consume-p-sdk-0, PR #86). Consuming it moved no catalogue, gate, or OpenAPI
 * pin. BOOTSTRAP grants catalogue-schema binding only; it is not semantic
 * conformance, not a live HTTP server, and not production qualification.
 */
export interface ConsumedProducer {
  readonly id: "consume-p-sdk-0";
  readonly catalogue: "program";
  readonly pr: 86;
  readonly producerRepo: string;
  readonly producerMergeSha: string;
  readonly manifestSha256: string;
  readonly catalogueSha256: string;
  readonly profileSha256: string;
  readonly profileKind: string;
  readonly profileRevision: string;
  readonly grants: string;
  readonly connected: false;
  readonly implementedHere: true;
  readonly semanticConformance: false;
  readonly liveHttpServer: false;
  readonly productionEndpoint: false;
  readonly protocolTruth: false;
  readonly productionConformance: false;
  readonly note: string;
}

export const CONSUMED_PRODUCERS = [
  {
    id: "consume-p-sdk-0",
    catalogue: "program",
    pr: 86,
    producerRepo: KIX_SDK_0_PIN.producerRepo,
    producerMergeSha: KIX_SDK_0_PIN.producerMergeSha,
    manifestSha256: KIX_SDK_0_PIN.manifestSha256,
    catalogueSha256: KIX_SDK_0_PIN.catalogueSha256,
    profileSha256: KIX_SDK_0_PIN.profileSha256,
    profileKind: KIX_SDK_0_PIN.profileKind,
    profileRevision: KIX_SDK_0_PIN.profileRevision,
    grants: KIX_SDK_0_PIN.grants,
    connected: false,
    implementedHere: true,
    semanticConformance: false,
    liveHttpServer: false,
    productionEndpoint: false,
    protocolTruth: false,
    productionConformance: false,
    note: sourceCopy.en["merge.sdkNote"],
  },
] as const satisfies readonly ConsumedProducer[];

export const PENDING_PRODUCERS = [
  {
    id: "bind-list-read",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "box-office-catalog",
    note: sourceCopy.en["s1r6"],
  },
  {
    id: "browser-gate-path",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "operator-transport",
    note: sourceCopy.en["s1qk"],
  },
  {
    id: "bind-settlement-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "box-office-settlement",
    note: sourceCopy.en["s1k1"],
  },
  {
    id: "bind-reservation-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "reservation-case",
    note: sourceCopy.en["s1g6"],
  },
  {
    id: "bind-admission-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "admission-credential",
    note: sourceCopy.en["s1p"],
  },
  {
    id: "bind-resale-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "resale-desk",
    note: sourceCopy.en["s1g1"],
  },
  {
    id: "bind-credit-fsm",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-desk",
    note: sourceCopy.en["s1qt"],
  },
  {
    id: "bind-wave4-pointers",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "booking-journey",
    note: sourceCopy.en["s18d"],
  },
  {
    id: "primary-price-fee-ui",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "booking-journey",
    note: sourceCopy.en["s194"],
  },
  {
    id: "api-state-distinction",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "refund-return-desk",
    note: sourceCopy.en["s1su"],
  },
  {
    id: "refund-surface",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "refund-return-desk",
    note: sourceCopy.en["s1el"],
  },
  {
    id: "c-discovery-live",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "discovery-live-read",
    note: sourceCopy.en["s1p1"],
  },
  {
    id: "c-inventory-venue",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "inventory-venue-select",
    note: sourceCopy.en["s1iq"],
  },
  {
    id: "c-platform-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-journey-trade",
    note: sourceCopy.en["s1uf"],
  },
  {
    id: "c-async-session-fence",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-journey-trade",
    note: sourceCopy.en["s22s"],
  },
  {
    id: "c-cross-surface-journeys",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "cross-surface-journeys",
    note: sourceCopy.en["s1tg"],
  },
  {
    id: "c-merchant-operations",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "merchant-operations",
    note: sourceCopy.en["s1ue"],
  },
  {
    id: "c-credit-origination",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-origination",
    note: sourceCopy.en["s1uu"],
  },
  {
    id: "c-credit-servicing-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "credit-servicing",
    note: sourceCopy.en["s1xv"],
  },
  {
    id: "c-finance-operations",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "finance-operations",
    note: sourceCopy.en["s1ss"],
  },
  {
    id: "c-marketing-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "marketing-journey",
    note: sourceCopy.en["s1qh"],
  },
  {
    id: "c-delegated-assistant",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "delegated-assistant",
    note: sourceCopy.en["s1ri"],
  },
  {
    id: "delegation-surface",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "delegated-assistant",
    note: sourceCopy.en["s1rj"],
  },
  {
    id: "c-tenant-permissions",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "tenant-permissions",
    note: sourceCopy.en["s1v5"],
  },
  {
    id: "c-notification-inbox",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "notification-inbox",
    note: sourceCopy.en["s1ul"],
  },
  {
    id: "c-provider-connected-journey",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "provider-connected-journey",
    note: sourceCopy.en["s1vl"],
  },
  {
    id: "c-marketplace-performance",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "marketplace-performance-bench",
    note: sourceCopy.en["s1uc"],
  },
  {
    id: "c-installable-mobile",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "installable-mobile-shell",
    note: sourceCopy.en["s1t9"],
  },
  {
    id: "c-platform-operational-qualification",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-operational-qualification",
    note: sourceCopy.en["s1vq"],
  },
  {
    id: "c-journey-identity",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "journey-identity",
    note: sourceCopy.en["s1tf"],
  },
  {
    id: "c-platform-release",
    catalogue: "pending",
    connected: false,
    implementedHere: false,
    waitingSurface: "platform-release",
    note: sourceCopy.en["s1wx"],
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
      sourceCopy.en["s1og"],
    ),
  ],
  organizer: [
    stepFromSurfaces(
      "organizer-console",
      "organizer",
      ["organizer-console"],
      sourceCopy.en["s1kz"],
    ),
    stepFromSurfaces(
      "organizer-workspace",
      "organizer",
      ["organizer-workspace"],
      sourceCopy.en["s192"],
    ),
    stepFromSurfaces(
      "box-office-settlement",
      "organizer",
      ["box-office-settlement"],
      sourceCopy.en["st6"],
    ),
    stepFromSurfaces(
      "merchant-operations",
      "organizer",
      ["merchant-operations"],
      sourceCopy.en["s1om"],
    ),
    stepFromSurfaces(
      "credit-origination",
      "organizer",
      ["credit-origination"],
      sourceCopy.en["s1ob"],
    ),
  ],
  operator: [
    stepFromSurfaces(
      "operator-transport",
      "operator",
      ["operator-transport"],
      sourceCopy.en["s1qf"],
    ),
    stepFromSurfaces(
      "receipt-explorer",
      "operator",
      ["receipt-explorer"],
      sourceCopy.en["skg"],
    ),
    stepFromSurfaces(
      "credit-desk",
      "operator",
      ["credit-desk"],
      sourceCopy.en["ssw"],
    ),
    stepFromSurfaces(
      "credit-servicing",
      "operator",
      ["credit-servicing"],
      sourceCopy.en["s1od"],
    ),
    stepFromSurfaces(
      "finance-operations",
      "operator",
      ["finance-operations"],
      sourceCopy.en["s1oi"],
    ),
    stepFromSurfaces(
      "tenant-permissions",
      "operator",
      ["tenant-permissions"],
      sourceCopy.en["s1p0"],
    ),
    stepFromSurfaces(
      "notification-inbox",
      "operator",
      ["notification-inbox"],
      sourceCopy.en["s1oq"],
    ),
    stepFromSurfaces(
      "marketplace-performance-bench",
      "operator",
      ["marketplace-performance-bench"],
      sourceCopy.en["s1p4"],
    ),
    stepFromSurfaces(
      "installable-mobile-shell",
      "operator",
      ["installable-mobile-shell"],
      sourceCopy.en["s1oo"],
    ),
    stepFromSurfaces(
      "platform-operational-qualification",
      "operator",
      ["platform-operational-qualification"],
      sourceCopy.en["s1ov"],
    ),
    stepFromSurfaces(
      "platform-release",
      "operator",
      ["platform-release"],
      sourceCopy.en["s1oz"],
    ),
    stepFromSurfaces(
      "accessibility-baseline",
      "operator",
      ["accessibility-baseline"],
      sourceCopy.en["s18x"],
    ),
    {
      id: "local-handoff",
      role: "operator" as const,
      route: HANDOFF_ROUTE,
      link: HANDOFF_ROUTE,
      surfaces: [],
      statuses: ["unsupported"] as const,
      protocolIntegrationComplete: false as const,
      note: sourceCopy.en["s23a"],
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
    anchor: sourceCopy.en["sh3"],
  },
  {
    id: "w6a-journey-adapter",
    doc: "docs/wave-6a-journey-adapter-apps-bind.md",
    anchor: sourceCopy.en["s26g"],
  },
  {
    id: "w6a-journey-test",
    doc: "docs/wave-6a-journey-test-apps-bind.md",
    anchor: sourceCopy.en["srb"],
  },
  {
    id: "w6a-ui-skeleton",
    doc: "docs/wave-6a-ui-skeleton-apps-bind.md",
    anchor: sourceCopy.en["s23k"],
  },
  {
    id: "w6a-evidence",
    doc: "docs/wave-6a-evidence-apps-bind.md",
    anchor: sourceCopy.en["sp5"],
  },
  {
    id: "organizer-admin-console",
    doc: "docs/organizer-admin-console-apps-bind.md",
    anchor: sourceCopy.en["s166"],
  },
  {
    id: "gift-surface",
    doc: "docs/gift-surface-apps-bind.md",
    anchor: sourceCopy.en["s16q"],
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
    anchor: sourceCopy.en["sf1"],
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
    anchor: sourceCopy.en["s1bx"],
  },
  {
    id: "c-organizer-workspace",
    doc: "docs/c-organizer-workspace-apps-bind.md",
    anchor: sourceCopy.en["s1j9"],
  },
  {
    id: "c-receipt-explorer",
    doc: "docs/c-receipt-explorer-apps-bind.md",
    anchor: sourceCopy.en["s1ec"],
  },
  {
    id: "c-discovery-prototype",
    doc: "docs/c-discovery-prototype-apps-bind.md",
    anchor: sourceCopy.en["s1xg"],
  },
  {
    id: "c-accessibility-baseline",
    doc: "docs/c-accessibility-baseline-apps-bind.md",
    anchor: sourceCopy.en["sp0"],
  },
  {
    id: "c-contract-fixture-library",
    doc: "docs/c-contract-fixture-library-apps-bind.md",
    anchor: sourceCopy.en["s1z"],
  },
  {
    id: "c-discovery-live-stub",
    doc: "docs/c-discovery-live-stub-apps-bind.md",
    anchor: sourceCopy.en["s62"],
  },
  {
    id: "c-inventory-venue-stub",
    doc: "docs/c-inventory-venue-stub-apps-bind.md",
    anchor: sourceCopy.en["s1ux"],
  },
  {
    id: "c-platform-journey-stub",
    doc: "docs/c-platform-journey-stub-apps-bind.md",
    anchor: sourceCopy.en["sp8"],
  },
  {
    id: "c-merchant-operations-stub",
    doc: "docs/c-merchant-operations-stub-apps-bind.md",
    anchor: sourceCopy.en["sun"],
  },
  {
    id: "c-credit-origination-stub",
    doc: "docs/c-credit-origination-stub-apps-bind.md",
    anchor: sourceCopy.en["s3i"],
  },
  {
    id: "c-credit-servicing-journey-stub",
    doc: "docs/c-credit-servicing-journey-stub-apps-bind.md",
    anchor: sourceCopy.en["sa"],
  },
  {
    id: "c-finance-operations-stub",
    doc: "docs/c-finance-operations-stub-apps-bind.md",
    anchor: sourceCopy.en["stv"],
  },
  {
    id: "c-marketing-journey-stub",
    doc: "docs/c-marketing-journey-stub-apps-bind.md",
    anchor: sourceCopy.en["s3d"],
  },
  {
    id: "c-delegated-assistant-stub",
    doc: "docs/c-delegated-assistant-stub-apps-bind.md",
    anchor: sourceCopy.en["s80"],
  },
  {
    id: "c-tenant-permissions-stub",
    doc: "docs/c-tenant-permissions-stub-apps-bind.md",
    anchor: sourceCopy.en["s2c"],
  },
  {
    id: "c-notification-inbox-stub",
    doc: "docs/c-notification-inbox-stub-apps-bind.md",
    anchor: sourceCopy.en["s3k"],
  },
  {
    id: "c-provider-connected-journey-stub",
    doc: "docs/c-provider-connected-journey-stub-apps-bind.md",
    anchor: sourceCopy.en["s7b"],
  },
  {
    id: "c-marketplace-performance-stub",
    doc: "docs/c-marketplace-performance-stub-apps-bind.md",
    anchor: sourceCopy.en["s41"],
  },
  {
    id: "c-installable-mobile-stub",
    doc: "docs/c-installable-mobile-stub-apps-bind.md",
    anchor: sourceCopy.en["s3f"],
  },
  {
    id: "c-platform-operational-qualification-stub",
    doc: "docs/c-platform-operational-qualification-stub-apps-bind.md",
    anchor: sourceCopy.en["s55"],
  },
  {
    id: "c-platform-release-stub",
    doc: "docs/c-platform-release-stub-apps-bind.md",
    anchor: sourceCopy.en["s3j"],
  },
  {
    id: "c-refund-return-states-stub",
    doc: "docs/c-refund-return-states-stub-apps-bind.md",
    anchor: sourceCopy.en["s1gs"],
  },
  {
    id: "c-journey-identity-stub",
    doc: "docs/c-journey-identity-stub-apps-bind.md",
    anchor: sourceCopy.en["s1de"],
  },
  {
    id: "c-session-recovery-stub",
    doc: "docs/c-session-recovery-stub-apps-bind.md",
    anchor: sourceCopy.en["s4r"],
  },
  {
    id: "c-cross-surface-journeys-stub",
    doc: "docs/c-cross-surface-journeys-stub-apps-bind.md",
    anchor: sourceCopy.en["s4u"],
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

const UNKNOWN_CODE = sourceCopy.en["s22v"];
const REFUSED_TEXT = sourceCopy.en["s232"];

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
  if (key === sourceCopy.en["s7p"] || key === sourceCopy.en["s7n"]) {
    return WORKSPACE_ROLES[(index + 1) % WORKSPACE_ROLES.length] ?? null;
  }
  if (key === sourceCopy.en["s7o"] || key === sourceCopy.en["s7q"]) {
    return WORKSPACE_ROLES[(index - 1 + WORKSPACE_ROLES.length) % WORKSPACE_ROLES.length] ?? null;
  }
  if (key === sourceCopy.en["sni"]) {
    return WORKSPACE_ROLES[0] ?? null;
  }
  if (key === sourceCopy.en["sid"]) {
    return WORKSPACE_ROLES[WORKSPACE_ROLES.length - 1] ?? null;
  }
  return null;
}

export const PLACE_HOLD_HANDOFF = PLACE_HOLD_RECORD;

export const NEVER_SENT_HANDOFF = NEVER_SENT_ACTIONS;
