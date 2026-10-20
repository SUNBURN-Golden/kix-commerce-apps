import { COMMAND_SCHEMAS } from "#kix-sdk-0/catalogue";
import { createLocalCallClient } from "#kix-sdk-0/client";
import { CatalogueRejection } from "#kix-sdk-0/jsonschema";
import { PINNED_PROTOCOL_DOMAIN } from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
import { requireSdkPin } from "./sdk-pin.js";
import { ProtocolError } from "./types.js";

export interface LocalCallInput {
  operationId: string;
  actor: string;
  action: string;
  body: unknown;
}

export interface LocalCallEnvelope {
  operationId: string;
  actor: string;
  action: string;
  body: Record<string, unknown>;
}

requireSdkPin();

/**
 * The generated p-sdk-0 client is the local-call schema check. This transport
 * only returns the validated envelope; the caller sends it. The client does
 * not open a connection, read actor as authority, or repeat a call.
 */
const generatedLocalCallClient = createLocalCallClient({
  transport: (envelope) => envelope,
});

/**
 * Builds Core.execute(operationId, actor, action, body) through the generated
 * client. operationId is the per-invocation id. action is the command name.
 * The actor string is not an authentication result.
 */
export function buildLocalCallEnvelope(input: unknown): LocalCallEnvelope {
  try {
    return generatedLocalCallClient.invoke(input) as LocalCallEnvelope;
  } catch (error) {
    if (error instanceof CatalogueRejection) {
      throw asProtocolError(error, input);
    }
    throw error;
  }
}

function asProtocolError(error: CatalogueRejection, input: unknown): ProtocolError {
  const detail = rejectionDetail(error);
  switch (error.code) {
    case "ENVELOPE":
      if (detail === "operationId" || detail === "actor" || detail === "action" || detail === "body") {
        return new ProtocolError(`Local-call envelope is missing ${detail}.`);
      }
      return new ProtocolError("Local-call envelope must be an object.");
    case "ENVELOPE_EXTRA":
      return new ProtocolError(`Unknown local-call field ${detail}.`);
    case "INVALID_ID":
      return new ProtocolError(
        `${detail} must be a non-empty string of at most 100 characters with no leading or trailing whitespace.`,
      );
    case "UNKNOWN_ACTION":
      return new ProtocolError(`Unknown protocol action${actionLabel(input)}.`);
    case "DOMAIN_MISMATCH":
      return new ProtocolError(`DOMAIN_MISMATCH: body.domain must equal ${PINNED_PROTOCOL_DOMAIN}.`);
    case "UNKNOWN_FIELD":
      return new ProtocolError(`Unknown field ${bodyPath(detail)}.`);
    case "MISSING_REQUIRED":
      return new ProtocolError(`Missing field ${bodyPath(detail)}.`);
    case "WRONG_TYPE": {
      const phrase = expectedPhrase(input, detail);
      if (phrase !== null) {
        return new ProtocolError(`Field ${bodyPath(detail)} ${phrase}.`);
      }
      return new ProtocolError(`Field ${bodyPath(detail)} has a type outside the published command schema.`);
    }
    case "CONSTRAINT":
      return constraintError(detail);
    case "SCHEMA":
      return new ProtocolError(`Unsupported schema in the pinned SDK catalogue (${detail}).`);
    default:
      return new ProtocolError(`Local-call schema rejection (${error.message}).`);
  }
}

function rejectionDetail(error: CatalogueRejection): string {
  const prefix = `${error.code}: `;
  return error.message.startsWith(prefix) ? error.message.slice(prefix.length) : "";
}

function actionLabel(input: unknown): string {
  if (isRecord(input) && typeof input.action === "string") {
    return `: ${input.action.slice(0, 80)}`;
  }
  return "";
}

function bodyPath(detail: string): string {
  if (detail === "$" || detail === "") {
    return "body";
  }
  return detail.startsWith("$.") ? `body.${detail.slice(2)}` : detail;
}

/**
 * Reads the expected schema type at the rejected path so the message matches
 * the wording the hand-kept check used ("must be an integer", "is outside the
 * schema enum"). Returns null when the path cannot be resolved.
 */
function expectedPhrase(input: unknown, detail: string): string | null {
  if (!isRecord(input) || typeof input.action !== "string") {
    return null;
  }
  let schema: unknown = (COMMAND_SCHEMAS as Record<string, unknown>)[input.action];
  if (!isRecord(schema)) {
    return null;
  }
  if (detail !== "body" && detail !== "$" && detail !== "") {
    for (const part of (detail.startsWith("$.") ? detail.slice(2) : detail).split(".")) {
      const properties = isRecord(schema.properties) ? schema.properties : undefined;
      schema = properties?.[part];
      if (!isRecord(schema)) {
        return null;
      }
    }
  }
  if (Array.isArray(schema.enum)) {
    return "is outside the schema enum";
  }
  const type = schema.type;
  if (Array.isArray(type) && type.every((name) => typeof name === "string")) {
    return `must be ${type.join(" or ")}`;
  }
  const phrases: Record<string, string> = {
    object: "an object",
    array: "an array",
    string: "a string",
    integer: "an integer",
    boolean: "a boolean",
    null: "null",
  };
  return typeof type === "string" && phrases[type] !== undefined ? `must be ${phrases[type]}` : null;
}

function constraintError(detail: string): ProtocolError {
  const space = detail.lastIndexOf(" ");
  const path = space === -1 ? detail : detail.slice(0, space);
  const kind = space === -1 ? "" : detail.slice(space + 1);
  const phrases: Record<string, string> = {
    minLength: "is shorter than the schema allows",
    maxLength: "is longer than the schema allows",
    minimum: "is below the schema minimum",
    maximum: "is above the schema maximum",
  };
  const phrase = phrases[kind];
  if (phrase !== undefined) {
    return new ProtocolError(`Field ${bodyPath(path)} ${phrase}.`);
  }
  return new ProtocolError(`Field ${bodyPath(detail)} violates the published command schema.`);
}
