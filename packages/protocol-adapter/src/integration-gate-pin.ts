import gateRaw from "../vendor/kix-protocol.integration-gate.openapi.json?raw";
import {
  CONTRACT_ONLY_LOCAL_CALL_METHOD,
  CONTRACT_ONLY_LOCAL_CALL_PATH,
  LOCAL_CALL_PARAMETER_NAMES,
  OPENAPI_CONTRACT_PIN,
  PINNED_ACTIONS,
  PINNED_PROTOCOL_DOMAIN,
} from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
import { sha256Hex } from "./sha256.js";
import { ProtocolError } from "./types.js";

/**
 * Published non-production loopback transport pin from BeautifulMind-JT/kix-protocol.
 * The command catalogue stays in the contract-only file. This document describes
 * the integration-gate process only. It is not a production endpoint and not a public host.
 * Local HTTP success is not production approval.
 */
export const OPENAPI_INTEGRATION_GATE_PIN = {
  protocolRepo: "BeautifulMind-JT/kix-protocol",
  /**
   * Checkout the apps tests start. OpenAPI bytes stay the integration-gate pin
   * from feature 007af902. This tip is the admission-harden merge, which does
   * not add commands.
   */
  protocolMergeSha: "3b6bdd26f61bb828af3781946b63a3a3fa03187b",
  protocolFeatureSha: "007af9021991965d4af79c4f8497061c6daa77eb",
  openApiPath: "docs/contracts/openapi/kix-protocol.integration-gate.openapi.json",
  openApiFileSha256: "94b9559610c8260ce2428a59126ef24e260a6769dbbcf0056d2c861ae85e0f19",
  infoVersion:
    "0.3-rc1-integration-gate+sha256:ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  infoTitle: "KIX integration-gate local-call transport",
  infoSummary: "Non-production loopback integration gate. No production endpoint. No public host.",
  sourceProtocolContractPath: "reference/v0.3-rc1/protocol_contract.json",
  sourceProtocolContractSha256: "ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e",
  sourceProtocolContractGitBlob: "619ae21c82ca3df5661bd3831613f15fa65225ff",
  contractOnlyOpenApiPath: "docs/contracts/openapi/kix-protocol.contract-only.openapi.json",
  contractOnlyOpenApiFileSha256: OPENAPI_CONTRACT_PIN.openApiFileSha256,
  contractStatus: "integration-gate",
  liveHttpServerMode: "non-production-local-integration",
  liveHttpServerProduction: false,
  publicHost: false,
  loopbackOnly: true,
  defaultBindHost: "127.0.0.1",
  productionEndpoint: false,
  localCallPath: CONTRACT_ONLY_LOCAL_CALL_PATH,
  maxBodyBytes: 65536,
  requestTimeoutSeconds: 5,
  headerLimitBytes: 8192,
  commandCount: 40,
} as const;

export const INTEGRATION_GATE_HEALTH_PATH = "/health" as const;
export const INTEGRATION_GATE_READY_PATH = "/ready" as const;
export const INTEGRATION_GATE_TRANSPORT = "integration-gate" as const;
export const INTEGRATION_GATE_LOOPBACK_HOST = "127.0.0.1" as const;

const TOP_LEVEL_KEYS = [
  "openapi",
  "info",
  "x-kix-contract-status",
  "x-kix-live-http-server",
  "x-kix-production-endpoint",
  "x-kix-public-host",
  "x-kix-omitted-commands",
  "x-kix-source",
  "x-kix-limits",
  "x-kix-idempotency",
  "x-kix-external-adapters",
  "x-kix-transport-probes",
  "x-kix-local-call-operations",
  "paths",
] as const;

const RESPONSE_STATUSES = ["200", "400", "404", "405", "408", "411", "413", "415", "422", "503"] as const;

const FORBIDDEN_KEYS = ["servers", "security", "securitySchemes", "url"] as const;

let liveDocument: Record<string, unknown> | null = null;

export function assertIntegrationGateRaw(raw: string): void {
  const digest = sha256Hex(raw);
  if (digest !== OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256) {
    throw new ProtocolError(
      `Integration-gate OpenAPI file sha256 mismatch. Expected ${OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256}.`,
    );
  }
  if (raw.includes("http://") || raw.includes("https://") || raw.toLowerCase().includes("localhost")) {
    throw new ProtocolError("Integration-gate OpenAPI must not publish an endpoint URL.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProtocolError("Integration-gate OpenAPI pin is not JSON.");
  }
  assertIntegrationGateDocument(parsed);
  if (!liveDocument && isRecord(parsed)) {
    liveDocument = parsed;
  }
}

export function assertIntegrationGateDocument(doc: unknown): void {
  if (!isRecord(doc)) {
    throw new ProtocolError("Integration-gate OpenAPI pin must be an object.");
  }
  rejectForbiddenKeys(doc);
  if (!sameMembers(Object.keys(doc), TOP_LEVEL_KEYS)) {
    throw new ProtocolError("Integration-gate OpenAPI top-level keys do not match the published document.");
  }
  if (doc.openapi !== "3.1.0") {
    throw new ProtocolError("Integration-gate OpenAPI version mismatch.");
  }
  if (doc["x-kix-contract-status"] !== OPENAPI_INTEGRATION_GATE_PIN.contractStatus) {
    throw new ProtocolError("Integration-gate contract status mismatch.");
  }
  if (doc["x-kix-production-endpoint"] !== false) {
    throw new ProtocolError("Integration-gate pin must keep x-kix-production-endpoint false.");
  }
  if (doc["x-kix-public-host"] !== false) {
    throw new ProtocolError("Integration-gate pin must keep x-kix-public-host false.");
  }
  if (!Array.isArray(doc["x-kix-omitted-commands"]) || doc["x-kix-omitted-commands"].length !== 0) {
    throw new ProtocolError("Integration-gate pin x-kix-omitted-commands must be empty.");
  }

  const live = requireRecord(doc["x-kix-live-http-server"], "Integration-gate live HTTP server marker");
  if (!sameMembers(Object.keys(live), ["mode", "production", "publicHost", "loopbackOnly", "defaultBindHost"])) {
    throw new ProtocolError("Integration-gate live HTTP server marker mismatch.");
  }
  if (live.mode !== OPENAPI_INTEGRATION_GATE_PIN.liveHttpServerMode) {
    throw new ProtocolError("Integration-gate live HTTP server mode mismatch.");
  }
  if (live.production !== false || live.publicHost !== false || live.loopbackOnly !== true) {
    throw new ProtocolError("Integration-gate live HTTP server marker claims production or a public host.");
  }
  if (live.defaultBindHost !== OPENAPI_INTEGRATION_GATE_PIN.defaultBindHost) {
    throw new ProtocolError("Integration-gate bind host mismatch.");
  }

  const info = requireRecord(doc.info, "Integration-gate info");
  if (info.title !== OPENAPI_INTEGRATION_GATE_PIN.infoTitle) {
    throw new ProtocolError("Integration-gate info.title mismatch.");
  }
  if (info.version !== OPENAPI_INTEGRATION_GATE_PIN.infoVersion) {
    throw new ProtocolError("Integration-gate info.version mismatch.");
  }
  if (info.summary !== OPENAPI_INTEGRATION_GATE_PIN.infoSummary) {
    throw new ProtocolError("Integration-gate info.summary mismatch.");
  }
  if (typeof info.description !== "string") {
    throw new ProtocolError("Integration-gate info.description must be a string.");
  }
  if (
    !info.description.includes("no production endpoint") ||
    !info.description.includes("no public host") ||
    !info.description.includes("not production approval")
  ) {
    throw new ProtocolError("Integration-gate description must deny production approval.");
  }

  const source = requireRecord(doc["x-kix-source"], "Integration-gate source");
  if (source.protocolContract !== OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractPath) {
    throw new ProtocolError("Integration-gate source protocol_contract path mismatch.");
  }
  if (source.sha256 !== OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractSha256) {
    throw new ProtocolError("Integration-gate source protocol_contract sha256 mismatch.");
  }
  if (source.gitBlob !== OPENAPI_INTEGRATION_GATE_PIN.sourceProtocolContractGitBlob) {
    throw new ProtocolError("Integration-gate source protocol_contract git blob mismatch.");
  }
  if (source.domain !== PINNED_PROTOCOL_DOMAIN) {
    throw new ProtocolError("Integration-gate source domain mismatch.");
  }
  if (source.commandCount !== PINNED_ACTIONS.length) {
    throw new ProtocolError("Integration-gate command count mismatch.");
  }
  if (source.contractCatalogue !== OPENAPI_INTEGRATION_GATE_PIN.contractOnlyOpenApiPath) {
    throw new ProtocolError("Integration-gate contract catalogue path mismatch.");
  }
  if (source.localCall !== "reference/v0.3-rc1/core.py Core.execute") {
    throw new ProtocolError("Integration-gate local-call target mismatch.");
  }
  if (source.unknownFields !== "REJECT") {
    throw new ProtocolError("Integration-gate pin must keep unknownFields REJECT.");
  }
  if (source.sourceAuthentication !== "FIXTURE_ONLY") {
    throw new ProtocolError("Integration-gate source authentication must stay FIXTURE_ONLY.");
  }

  const limits = requireRecord(doc["x-kix-limits"], "Integration-gate limits");
  if (
    limits.maxBodyBytes !== OPENAPI_INTEGRATION_GATE_PIN.maxBodyBytes ||
    limits.requestTimeoutSeconds !== OPENAPI_INTEGRATION_GATE_PIN.requestTimeoutSeconds ||
    limits.headerLimitBytes !== OPENAPI_INTEGRATION_GATE_PIN.headerLimitBytes ||
    limits.bindHost !== OPENAPI_INTEGRATION_GATE_PIN.defaultBindHost ||
    limits.durableAcrossRestart !== false
  ) {
    throw new ProtocolError("Integration-gate limits mismatch.");
  }

  const idempotency = requireRecord(doc["x-kix-idempotency"], "Integration-gate idempotency");
  if (
    idempotency.identity !== "envelope.operationId" ||
    idempotency.conflict !== "OPERATION_ID_CONFLICT" ||
    idempotency.durableAcrossRestart !== false ||
    idempotency.httpIdempotencyKeyHeader !== false
  ) {
    throw new ProtocolError("Integration-gate idempotency marker mismatch.");
  }

  const adapters = requireRecord(doc["x-kix-external-adapters"], "Integration-gate external adapters");
  for (const name of ["pg", "kyc", "venue", "bank"] as const) {
    if (adapters[name] !== "forbidden") {
      throw new ProtocolError(`Integration-gate external adapter ${name} must stay forbidden.`);
    }
  }

  const probes = requireRecord(doc["x-kix-transport-probes"], "Integration-gate probes");
  assertProbe(probes.health, INTEGRATION_GATE_HEALTH_PATH);
  assertProbe(probes.ready, INTEGRATION_GATE_READY_PATH);

  if (!Array.isArray(doc["x-kix-local-call-operations"])) {
    throw new ProtocolError("Integration-gate local-call operations must be a list.");
  }
  if (doc["x-kix-local-call-operations"].length !== PINNED_ACTIONS.length) {
    throw new ProtocolError("Integration-gate command count mismatch.");
  }
  doc["x-kix-local-call-operations"].forEach((entry, index) => {
    const operation = requireRecord(entry, "Integration-gate local-call operation");
    const action = PINNED_ACTIONS[index];
    if (operation.action !== action || operation.operationId !== action) {
      throw new ProtocolError("Integration-gate command set mismatch.");
    }
    if (operation["x-kix-transport"] !== INTEGRATION_GATE_TRANSPORT) {
      throw new ProtocolError("Integration-gate command transport mismatch.");
    }
    if (operation["x-kix-production-endpoint"] !== false || operation["x-kix-not-a-public-service"] !== true) {
      throw new ProtocolError("Integration-gate command must stay non-production.");
    }
    if (operation.requestBodySchema !== `kix-protocol.contract-only.openapi.json#/components/schemas/${action}`) {
      throw new ProtocolError(`Integration-gate request body schema mismatch for ${action}.`);
    }
    if (!arrayEquals(operation.localCallParameters, LOCAL_CALL_PARAMETER_NAMES)) {
      throw new ProtocolError("Integration-gate local-call parameters mismatch.");
    }
    if (typeof operation.description !== "string" || !operation.description.includes("Not a production operation.")) {
      throw new ProtocolError("Integration-gate command description must deny a production operation.");
    }
  });

  const paths = requireRecord(doc.paths, "Integration-gate paths");
  const pathNames = Object.keys(paths);
  if (pathNames.length !== 1 || pathNames[0] !== CONTRACT_ONLY_LOCAL_CALL_PATH) {
    throw new ProtocolError("Integration-gate pin must publish only the local-call path.");
  }
  if (INTEGRATION_GATE_HEALTH_PATH in paths || INTEGRATION_GATE_READY_PATH in paths) {
    throw new ProtocolError("Integration-gate probes must not be protocol paths.");
  }
  const pathItem = requireRecord(paths[CONTRACT_ONLY_LOCAL_CALL_PATH], "Integration-gate local-call path");
  const pathKeys = Object.keys(pathItem);
  if (pathKeys.length !== 1 || pathKeys[0] !== "post") {
    throw new ProtocolError("Integration-gate local-call path must expose only POST.");
  }
  const post = requireRecord(pathItem.post, "Integration-gate local-call post");
  if (post.operationId !== "invokeLocalCall") {
    throw new ProtocolError("Integration-gate placeholder operationId mismatch.");
  }
  if (PINNED_ACTIONS.includes(post.operationId as (typeof PINNED_ACTIONS)[number])) {
    throw new ProtocolError("Integration-gate generic operationId must not be a command name.");
  }
  if (post["x-kix-transport"] !== INTEGRATION_GATE_TRANSPORT) {
    throw new ProtocolError("Integration-gate path transport mismatch.");
  }
  if (post["x-kix-production-endpoint"] !== false || post["x-kix-not-a-public-service"] !== true) {
    throw new ProtocolError("Integration-gate path must stay non-production.");
  }
  const requestBody = requireRecord(post.requestBody, "Integration-gate requestBody");
  const content = requireRecord(
    requireRecord(requestBody.content, "Integration-gate content")["application/json"],
    "Integration-gate json",
  );
  const requestSchema = requireRecord(content.schema, "Integration-gate schema");
  if (requestSchema.$ref !== "kix-protocol.contract-only.openapi.json#/components/schemas/LocalCallEnvelope") {
    throw new ProtocolError("Integration-gate body must reference the contract-only local-call envelope.");
  }
  const responses = requireRecord(post.responses, "Integration-gate responses");
  if (!sameMembers(Object.keys(responses), RESPONSE_STATUSES)) {
    throw new ProtocolError("Integration-gate response set mismatch.");
  }
  const ok = requireRecord(responses["200"], "Integration-gate 200 response");
  if (ok["x-kix-production-endpoint"] !== false) {
    throw new ProtocolError("Integration-gate success response must keep production false.");
  }
  const rejected = requireRecord(responses["422"], "Integration-gate 422 response");
  if (typeof rejected.description !== "string" || !rejected.description.includes("Not HTTP 200")) {
    throw new ProtocolError("Integration-gate 422 response must stay a reject, not HTTP 200.");
  }
  if (CONTRACT_ONLY_LOCAL_CALL_METHOD !== "POST") {
    throw new ProtocolError("Integration-gate local-call method must stay POST.");
  }
}

export function requireIntegrationGatePin(): typeof OPENAPI_INTEGRATION_GATE_PIN {
  if (!liveDocument) {
    throw new ProtocolError("Integration-gate OpenAPI pin is not loaded.");
  }
  const pin = OPENAPI_INTEGRATION_GATE_PIN;
  if (
    pin.contractStatus !== "integration-gate" ||
    pin.productionEndpoint !== false ||
    pin.publicHost !== false ||
    pin.liveHttpServerProduction !== false ||
    pin.loopbackOnly !== true ||
    pin.defaultBindHost !== INTEGRATION_GATE_LOOPBACK_HOST ||
    pin.liveHttpServerMode !== "non-production-local-integration"
  ) {
    throw new ProtocolError("Refusing an integration-gate pin that claims production or a public host.");
  }
  if (pin.contractOnlyOpenApiFileSha256 !== OPENAPI_CONTRACT_PIN.openApiFileSha256) {
    throw new ProtocolError("Integration-gate pin does not match the contract-only catalogue digest.");
  }
  if (OPENAPI_CONTRACT_PIN.contractStatus !== "contract-only" || OPENAPI_CONTRACT_PIN.liveHttpServer !== false) {
    throw new ProtocolError("Contract-only catalogue must stay a pin with no live server.");
  }
  return pin;
}

export function readPinnedIntegrationGateDocument(): unknown {
  requireIntegrationGatePin();
  return structuredClone(liveDocument);
}

function assertProbe(value: unknown, path: string): void {
  const probe = requireRecord(value, "Integration-gate probe");
  if (probe.method !== "GET" || probe.path !== path) {
    throw new ProtocolError("Integration-gate probe mismatch.");
  }
  if (typeof probe.meaning !== "string" || probe.meaning.length === 0) {
    throw new ProtocolError("Integration-gate probe meaning mismatch.");
  }
}

function rejectForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectForbiddenKeys);
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.includes(key as (typeof FORBIDDEN_KEYS)[number])) {
      throw new ProtocolError("Integration-gate pin must not publish servers or an authentication scheme.");
    }
    if (key === "x-kix-production-endpoint" && value[key] !== false) {
      throw new ProtocolError("Integration-gate pin must keep x-kix-production-endpoint false.");
    }
    if (key === "production" && value[key] !== false) {
      throw new ProtocolError("Integration-gate pin must keep production false.");
    }
    const child = value[key];
    if (typeof child === "string" && (child.includes("http://") || child.includes("https://") || child.toLowerCase().includes("localhost"))) {
      throw new ProtocolError("Integration-gate pin must not publish an endpoint URL.");
    }
    rejectForbiddenKeys(child);
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

assertIntegrationGateRaw(gateRaw);
