import manifestRaw from "../vendor/kix-sdk-0/compat/manifests/manifest.commerce-fixture-8ba7f6c-1.json?raw";
import { COMMAND_SCHEMAS } from "#kix-sdk-0/catalogue";
import { canonicalStringify } from "#kix-sdk-0/jsonschema";
import { commandFor, FIXTURE_ACTOR, fixtureTemplate, type CommerceJourneyCall, type JourneyProof } from "./commerce-journey-command.js";
import { FSM_COMMANDS } from "./commerce-journey-fixture.js";
import { FIXTURE_CONTEXTS, fixtureTransitions, takeFixtureGrant, type FixtureContext } from "./commerce-journey.js";
import { OPENAPI_INTEGRATION_GATE_PIN } from "./integration-gate-pin.js";
import { CONTRACT_ONLY_LOCAL_CALL_METHOD, CONTRACT_ONLY_LOCAL_CALL_PATH, OPENAPI_CONTRACT_PIN } from "./openapi-contract-pin.js";
import { requireSdkPin } from "./sdk-pin.js";
import { sha256Hex } from "./sha256.js";
import { ProtocolError } from "./types.js";

const FIXTURE_MANIFEST_SHA256 = "76ea72c6249ec0f90cb426dfbb8efda8308610f79c4f0ac6ff0a2445cab59a4f";

// The test derives this commitment independently from the pinned semantic
// manifest's qualification table and vectors. It covers every allowed prior
// step and fixture body, including the two market cancellation states.
export const QUALIFIED_FIXTURE_SHA256 = "a08ba08768a9f522a077f0298c41f127dba8d73fc5269bac1584f403d00de0ca";

function fixtureBody(context: FixtureContext, step: CommerceJourneyCall["step"]) {
  const [action, template] = fixtureTemplate(step);
  const body = step === "cancel-after-payment"
    ? { ...template, reservation_id: context === "booking-resale" ? "reserve-A" : "reserve-B" }
    : template;
  return [action, body] as const;
}

function projectFixtureWrites() {
  return Object.fromEntries(FIXTURE_CONTEXTS.flatMap(context => fixtureTransitions(context).map(([confirmed, step]) => {
    const [action, body] = fixtureBody(context, step);
    const split = action.indexOf("_");
    const schema = sha256Hex(canonicalStringify(COMMAND_SCHEMAS[action]));
    return [`${context}|${confirmed ?? ""}|${step}`, [
      action, action.slice(0, split), action.slice(split + 1), FSM_COMMANDS[action][0], schema,
      FIXTURE_ACTOR, structuredClone(body),
    ] as const] as const;
  })));
}

export function verifiedFixtureWrites(): Readonly<ReturnType<typeof projectFixtureWrites>> {
  if (sha256Hex(manifestRaw) !== FIXTURE_MANIFEST_SHA256) return {};
  const sdk = requireSdkPin();
  const writes = projectFixtureWrites();
  const identity = [
    sdk.producerRepo, sdk.producerMergeSha, OPENAPI_CONTRACT_PIN.openApiFileSha256,
    OPENAPI_INTEGRATION_GATE_PIN.openApiFileSha256, sdk.catalogueSha256,
    CONTRACT_ONLY_LOCAL_CALL_METHOD, CONTRACT_ONLY_LOCAL_CALL_PATH, writes,
  ];
  return OPENAPI_CONTRACT_PIN.protocolMainSha === OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha &&
    OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha === sdk.producerMergeSha &&
    sha256Hex(canonicalStringify(identity)) === QUALIFIED_FIXTURE_SHA256 ? writes : {};
}

let qualifiedWrites: ReturnType<typeof projectFixtureWrites> | undefined;

function notBound(): never {
  throw new ProtocolError("The fixture write is outside the pinned semantic conformance evidence.", "NOT_BOUND");
}

export function qualifiedFixtureCommand(input: CommerceJourneyCall, evidence: WeakMap<CommerceJourneyCall, JourneyProof>) {
  const grant = takeFixtureGrant(input);
  if (!grant) notBound();
  const [context, predecessor] = grant;
  if (predecessor && evidence.get(predecessor.call) !== predecessor.proof) notBound();
  const confirmed = predecessor?.call.step;
  qualifiedWrites ??= verifiedFixtureWrites();
  const row = qualifiedWrites[`${context}|${confirmed ?? ""}|${input.step}`];
  if (!row) notBound();

  const [action, , , , , actor, template] = row;
  const command = commandFor(input);
  if (command.action !== action || command.actor !== actor || command.operationId !== input.operationId ||
      canonicalStringify(command.body) !== canonicalStringify({ ...template, idempotency_key: input.idempotencyKey })) {
    notBound();
  }
  return command;
}
