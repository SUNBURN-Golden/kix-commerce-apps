import openApiRaw from "../vendor/kix-protocol.contract-only.openapi.json?raw";
import { isRecord } from "./record.js";
import { sha256Hex } from "./sha256.js";
import { ProtocolError } from "./types.js";

/**
 * Published contract-only OpenAPI pin from BeautifulMind-JT/kix-protocol.
 * The file is the local-call catalogue. It is not a live HTTP server,
 * not a production endpoint, and not a conformance claim.
 * POST on this file's path is an OpenAPI grammar slot, not protocol law.
 * The non-production integration-gate transport is a separate pin.
 */
export const OPENAPI_CONTRACT_PIN = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  protocolMainSha: "a744b0a036d7e1edb48416871af20cd182f23df4",
  openApiPath: "docs/contracts/openapi/kix-protocol.contract-only.openapi.json",
  openApiFileSha256: "fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e",
  infoVersion: "0.3-rc1+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  sourceProtocolContractPath: "reference/v0.3-rc1/protocol_contract.json",
  sourceProtocolContractSha256: "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  contractStatus: "contract-only",
  liveHttpServer: false,
  productionEndpoint: false,
  openApiVersion: "3.1.0",
  title: "KIX protocol local-call catalogue (contract-only)",
} as const;

export const PINNED_PROTOCOL_DOMAIN = "kix:fixture:lifecycle:0.3" as const;

/** Single placeholder path. Not a published HTTP service. */
export const CONTRACT_ONLY_LOCAL_CALL_PATH = "/x-kix-contract-only/local-call" as const;

/** OpenAPI grammar slot on the placeholder path. Not a published protocol method. */
export const CONTRACT_ONLY_LOCAL_CALL_METHOD = "POST" as const;

export const LOCAL_CALL_PARAMETER_NAMES = ["operationId", "actor", "action", "body"] as const;

export const PINNED_ACTIONS = [
  "abort_effect",
  "abort_trade",
  "accept_gift",
  "accept_trade",
  "adjust_pg_cancel",
  "admit",
  "advance_clock",
  "authorize_marketing",
  "cancel_event",
  "cancel_gift",
  "cancel_listing",
  "capture",
  "claim_effect",
  "close_delegation",
  "close_sales",
  "commit_trade",
  "complete_event",
  "create_event",
  "create_listing",
  "delegate",
  "dispatch_effect",
  "expire_trade",
  "finalize_effect",
  "issue_invitation",
  "observe_dispatch_lookup",
  "observe_effect",
  "observe_funding",
  "observe_recovery",
  "observe_return",
  "offer_gift",
  "open_admission",
  "prepare_effect",
  "prepare_trade",
  "refund_ticket",
  "release_inventory",
  "reserve_listing",
  "send_effect",
  "set_consent",
  "settle_capture",
  "void_unissued",
] as const;

export type PinnedAction = (typeof PINNED_ACTIONS)[number];

const PINNED_ACTION_SET: ReadonlySet<string> = new Set(PINNED_ACTIONS);

const TOP_LEVEL_KEYS = [
  "openapi",
  "info",
  "x-kix-contract-status",
  "x-kix-live-http-server",
  "x-kix-production-endpoint",
  "x-kix-omitted-commands",
  "x-kix-source",
  "x-kix-specification-envelope",
  "x-kix-action-body-map",
  "x-kix-local-call-operations",
  "x-kix-reference-receipt-observed",
  "paths",
  "components",
] as const;

let liveDocument: Record<string, unknown> | null = null;

export function isPinnedAction(value: string): value is PinnedAction {
  return PINNED_ACTION_SET.has(value);
}

export function assertOpenApiContractRaw(raw: string): void {
  const digest = sha256Hex(raw);
  if (digest !== OPENAPI_CONTRACT_PIN.openApiFileSha256) {
    throw new ProtocolError(
      `OpenAPI file sha256 mismatch. Expected ${OPENAPI_CONTRACT_PIN.openApiFileSha256}.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProtocolError("OpenAPI pin is not JSON.");
  }
  assertOpenApiContractDocument(parsed);
  if (!liveDocument && isRecord(parsed)) {
    liveDocument = parsed;
  }
}

export function assertOpenApiContractDocument(doc: unknown): void {
  if (!isRecord(doc)) {
    throw new ProtocolError("OpenAPI pin must be an object.");
  }
  if ("servers" in doc) {
    throw new ProtocolError("OpenAPI pin must not publish servers.");
  }
  if ("security" in doc) {
    throw new ProtocolError("OpenAPI pin must not publish an authentication scheme.");
  }
  if (!sameMembers(Object.keys(doc), TOP_LEVEL_KEYS)) {
    throw new ProtocolError("OpenAPI pin top-level keys do not match the published contract-only document.");
  }
  if (doc.openapi !== OPENAPI_CONTRACT_PIN.openApiVersion) {
    throw new ProtocolError("OpenAPI pin openapi version mismatch.");
  }
  if (doc["x-kix-contract-status"] !== OPENAPI_CONTRACT_PIN.contractStatus) {
    throw new ProtocolError("OpenAPI contract status mismatch.");
  }
  if (doc["x-kix-live-http-server"] !== false) {
    throw new ProtocolError("OpenAPI pin must keep x-kix-live-http-server false.");
  }
  if (doc["x-kix-production-endpoint"] !== false) {
    throw new ProtocolError("OpenAPI pin must keep x-kix-production-endpoint false.");
  }
  if (!Array.isArray(doc["x-kix-omitted-commands"]) || doc["x-kix-omitted-commands"].length !== 0) {
    throw new ProtocolError("OpenAPI pin x-kix-omitted-commands must be empty.");
  }

  const info = requireRecord(doc.info, "OpenAPI info");
  if (info.version !== OPENAPI_CONTRACT_PIN.infoVersion) {
    throw new ProtocolError("OpenAPI info.version mismatch.");
  }
  if (info.title !== OPENAPI_CONTRACT_PIN.title) {
    throw new ProtocolError("OpenAPI info.title mismatch.");
  }

  const source = requireRecord(doc["x-kix-source"], "OpenAPI x-kix-source");
  if (source.path !== OPENAPI_CONTRACT_PIN.sourceProtocolContractPath) {
    throw new ProtocolError("OpenAPI source protocol_contract path mismatch.");
  }
  if (source.sha256 !== OPENAPI_CONTRACT_PIN.sourceProtocolContractSha256) {
    throw new ProtocolError("OpenAPI source protocol_contract sha256 mismatch.");
  }
  if (source.domain !== PINNED_PROTOCOL_DOMAIN) {
    throw new ProtocolError("OpenAPI source domain mismatch.");
  }
  if (source.commandCount !== PINNED_ACTIONS.length) {
    throw new ProtocolError("OpenAPI command count mismatch.");
  }
  if (source.unknownFields !== "REJECT") {
    throw new ProtocolError("OpenAPI pin must keep unknownFields REJECT.");
  }

  const envelope = requireRecord(doc["x-kix-specification-envelope"], "OpenAPI specification envelope");
  const pythonCall = requireRecord(envelope.pythonLocalCall, "OpenAPI python local call");
  if (!arrayEquals(pythonCall.parameters, LOCAL_CALL_PARAMETER_NAMES)) {
    throw new ProtocolError("OpenAPI local-call parameters mismatch.");
  }
  const components = requireRecord(doc.components, "OpenAPI components");
  if ("securitySchemes" in components) {
    throw new ProtocolError("OpenAPI pin must not publish an authentication scheme.");
  }
  const schemas = requireRecord(components.schemas, "OpenAPI schemas");
  const envelopeSchema = requireRecord(schemas.LocalCallEnvelope, "LocalCallEnvelope");
  const bodyDomain = requireRecord(envelopeSchema["x-kix-body-domain-check"], "OpenAPI body domain check");
  if (bodyDomain.pinnedDomain !== PINNED_PROTOCOL_DOMAIN) {
    throw new ProtocolError("OpenAPI pinned body domain mismatch.");
  }
  const schemaNames = Object.keys(schemas);
  if (!sameMembers(schemaNames, [...PINNED_ACTIONS, "LocalCallEnvelope"])) {
    throw new ProtocolError("OpenAPI schema set mismatch.");
  }
  assertLocalCallEnvelope(requireRecord(schemas.LocalCallEnvelope, "LocalCallEnvelope"));

  const actionMap = requireRecord(doc["x-kix-action-body-map"], "OpenAPI action body map");
  if (!arrayEquals(Object.keys(actionMap), PINNED_ACTIONS)) {
    throw new ProtocolError("OpenAPI action body map mismatch.");
  }
  for (const action of PINNED_ACTIONS) {
    if (actionMap[action] !== `#/components/schemas/${action}`) {
      throw new ProtocolError(`OpenAPI action body map mismatch for ${action}.`);
    }
  }

  if (!Array.isArray(doc["x-kix-local-call-operations"])) {
    throw new ProtocolError("OpenAPI local-call operations must be a list.");
  }
  if (doc["x-kix-local-call-operations"].length !== PINNED_ACTIONS.length) {
    throw new ProtocolError("OpenAPI command count mismatch.");
  }
  doc["x-kix-local-call-operations"].forEach((entry, index) => {
    const operation = requireRecord(entry, "OpenAPI local-call operation");
    const action = PINNED_ACTIONS[index];
    if (operation.action !== action || operation.operationId !== action) {
      throw new ProtocolError("OpenAPI command set mismatch.");
    }
    if (operation["x-kix-transport"] !== "contract-only-placeholder") {
      throw new ProtocolError("OpenAPI local-call transport must stay contract-only-placeholder.");
    }
    if (operation["x-kix-not-a-published-http-service"] !== true) {
      throw new ProtocolError("OpenAPI local-call operation must stay unpublished.");
    }
    if (!arrayEquals(operation.localCallParameters, LOCAL_CALL_PARAMETER_NAMES)) {
      throw new ProtocolError("OpenAPI local-call parameters mismatch.");
    }
    if (operation.requestBodySchema !== `#/components/schemas/${action}`) {
      throw new ProtocolError(`OpenAPI request body schema mismatch for ${action}.`);
    }
  });

  const paths = requireRecord(doc.paths, "OpenAPI paths");
  const pathNames = Object.keys(paths);
  if (pathNames.length !== 1 || pathNames[0] !== CONTRACT_ONLY_LOCAL_CALL_PATH) {
    throw new ProtocolError("OpenAPI pin must publish only the contract-only local-call placeholder path.");
  }
  const pathItem = requireRecord(paths[CONTRACT_ONLY_LOCAL_CALL_PATH], "OpenAPI placeholder path");
  const pathKeys = Object.keys(pathItem);
  if (pathKeys.length !== 1 || pathKeys[0] !== "post") {
    throw new ProtocolError("OpenAPI placeholder path must expose only the post grammar slot.");
  }
  const post = requireRecord(pathItem.post, "OpenAPI placeholder post");
  if (post.operationId !== "invokeLocalCall") {
    throw new ProtocolError("OpenAPI placeholder operationId mismatch.");
  }
  if (PINNED_ACTION_SET.has(String(post.operationId))) {
    throw new ProtocolError("OpenAPI placeholder operationId must not be a command name.");
  }
  if (post["x-kix-transport"] !== "contract-only-placeholder") {
    throw new ProtocolError("OpenAPI placeholder transport must stay contract-only-placeholder.");
  }
  if (post["x-kix-not-a-published-http-service"] !== true) {
    throw new ProtocolError("OpenAPI placeholder path must stay unpublished.");
  }
  const requestBody = requireRecord(post.requestBody, "OpenAPI placeholder requestBody");
  const content = requireRecord(
    requireRecord(requestBody.content, "OpenAPI placeholder content")["application/json"],
    "OpenAPI placeholder json",
  );
  const requestSchema = requireRecord(content.schema, "OpenAPI placeholder schema");
  if (requestSchema.$ref !== "#/components/schemas/LocalCallEnvelope") {
    throw new ProtocolError("OpenAPI placeholder body must be the local-call envelope.");
  }
  const responses = requireRecord(post.responses, "OpenAPI placeholder responses");
  const defaultResponse = requireRecord(responses.default, "OpenAPI placeholder default response");
  if (defaultResponse["x-kix-transport"] !== "contract-only-placeholder") {
    throw new ProtocolError("OpenAPI placeholder response must stay contract-only.");
  }
  if (defaultResponse["x-kix-http-status"] !== "not-a-transport-contract") {
    throw new ProtocolError("OpenAPI placeholder HTTP status must stay outside the transport contract.");
  }
}

export function requireOpenApiContractPin(): typeof OPENAPI_CONTRACT_PIN {
  if (!liveDocument) {
    throw new ProtocolError("OpenAPI pin is not loaded.");
  }
  if (
    OPENAPI_CONTRACT_PIN.contractStatus !== "contract-only" ||
    OPENAPI_CONTRACT_PIN.liveHttpServer !== false ||
    OPENAPI_CONTRACT_PIN.productionEndpoint !== false
  ) {
    throw new ProtocolError("Refusing to use an OpenAPI pin that is not contract-only.");
  }
  return OPENAPI_CONTRACT_PIN;
}

export function readPinnedOpenApiDocument(): unknown {
  requireOpenApiContractPin();
  return structuredClone(liveDocument);
}

export function pinnedCommandSchemas(): Record<string, unknown> {
  const doc = liveDocument;
  if (!doc) {
    throw new ProtocolError("OpenAPI pin is not loaded.");
  }
  return requireRecord(requireRecord(doc.components, "OpenAPI components").schemas, "OpenAPI schemas");
}

function assertLocalCallEnvelope(schema: Record<string, unknown>): void {
  if (schema.additionalProperties !== false) {
    throw new ProtocolError("Local-call envelope must reject unknown fields.");
  }
  if (!arrayEquals(schema.required, LOCAL_CALL_PARAMETER_NAMES)) {
    throw new ProtocolError("Local-call envelope fields mismatch.");
  }
  const properties = requireRecord(schema.properties, "LocalCallEnvelope properties");
  const action = requireRecord(properties.action, "LocalCallEnvelope action");
  if (!arrayEquals(action.enum, PINNED_ACTIONS)) {
    throw new ProtocolError("OpenAPI command set mismatch.");
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProtocolError(`${label} must be an object.`);
  }
  return value;
}

function sameMembers(actual: string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const seen = new Set(actual);
  return expected.every((key) => seen.has(key));
}

function arrayEquals(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

assertOpenApiContractRaw(openApiRaw);
