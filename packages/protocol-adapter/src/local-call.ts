import {
  isPinnedAction,
  LOCAL_CALL_PARAMETER_NAMES,
  PINNED_PROTOCOL_DOMAIN,
  pinnedCommandSchemas,
} from "./openapi-contract-pin.js";
import { isRecord } from "./record.js";
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

/**
 * Builds Core.execute(operationId, actor, action, body).
 * operationId is the per-invocation id. action is the command name.
 * The actor string is not an authentication result.
 */
export function buildLocalCallEnvelope(input: unknown): LocalCallEnvelope {
  if (!isRecord(input)) {
    throw new ProtocolError("Local-call envelope must be an object.");
  }
  for (const key of Object.keys(input)) {
    if (!LOCAL_CALL_PARAMETER_NAMES.includes(key as (typeof LOCAL_CALL_PARAMETER_NAMES)[number])) {
      throw new ProtocolError(`Unknown local-call field ${key}.`);
    }
  }
  const operationId = assertIdent(input.operationId, "operationId");
  const actor = assertIdent(input.actor, "actor");
  if (typeof input.action !== "string" || !isPinnedAction(input.action)) {
    const label = typeof input.action === "string" ? `: ${input.action.slice(0, 80)}` : "";
    throw new ProtocolError(`Unknown protocol action${label}.`);
  }
  const schema = pinnedCommandSchemas()[input.action];
  validateSchema(schema, input.body, "body");
  if (!isRecord(input.body) || input.body.domain !== PINNED_PROTOCOL_DOMAIN) {
    throw new ProtocolError(`DOMAIN_MISMATCH: body.domain must equal ${PINNED_PROTOCOL_DOMAIN}.`);
  }
  return {
    operationId,
    actor,
    action: input.action,
    body: input.body,
  };
}

function assertIdent(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100 || value !== value.trim()) {
    throw new ProtocolError(
      `${field} must be a non-empty string of at most 100 characters with no leading or trailing whitespace.`,
    );
  }
  return value;
}

function validateSchema(schema: unknown, value: unknown, path: string): void {
  if (!isRecord(schema)) {
    throw new ProtocolError(`Unreadable schema at ${path}.`);
  }
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.startsWith("#/components/schemas/")
      ? schema.$ref.slice("#/components/schemas/".length)
      : "";
    const resolved = name ? pinnedCommandSchemas()[name] : undefined;
    if (!isRecord(resolved)) {
      throw new ProtocolError(`Unresolved schema ref at ${path}.`);
    }
    validateSchema(resolved, value, path);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throw new ProtocolError(`Field ${path} is outside the schema enum.`);
  }
  const type = schema.type;
  if (type === "object") {
    if (!isRecord(value)) {
      throw new ProtocolError(`Field ${path} must be an object.`);
    }
    const properties = isRecord(schema.properties) ? schema.properties : {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          throw new ProtocolError(`Unknown field ${path}.${key}.`);
        }
      }
    } else if (schema.additionalProperties !== undefined && schema.additionalProperties !== true) {
      throw new ProtocolError(`Unsupported schema at ${path}.`);
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (typeof key !== "string" || !(key in value)) {
        throw new ProtocolError(`Missing field ${path}.${String(key)}.`);
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (key in value) {
        validateSchema(child, value[key], `${path}.${key}`);
      }
    }
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) {
      throw new ProtocolError(`Field ${path} must be an array.`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => validateSchema(schema.items, item, `${path}[${index}]`));
    }
    return;
  }
  if (type === "string") {
    if (typeof value !== "string") {
      throw new ProtocolError(`Field ${path} must be a string.`);
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      throw new ProtocolError(`Field ${path} is shorter than the schema allows.`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      throw new ProtocolError(`Field ${path} is longer than the schema allows.`);
    }
    return;
  }
  if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new ProtocolError(`Field ${path} must be an integer.`);
    }
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      throw new ProtocolError(`Field ${path} is below the schema minimum.`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      throw new ProtocolError(`Field ${path} is above the schema maximum.`);
    }
    return;
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") {
      throw new ProtocolError(`Field ${path} must be a boolean.`);
    }
    return;
  }
  if (type === undefined && Array.isArray(schema.enum)) {
    return;
  }
  throw new ProtocolError(`Unsupported schema at ${path}.`);
}
