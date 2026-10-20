/**
 * Non-production local-call client for the pinned contract-only catalogue.
 *
 * The caller supplies transport. This module does not open a connection,
 * invent a base URL, read actor as authority, or repeat a call.
 */

import { COMMAND_SCHEMAS, COMMANDS, OPENAPI_PIN, type CommandName } from "../generated/catalogue.ts";
import { CatalogueRejection, type JsonSchema, validateSchema } from "./jsonschema.ts";

const ENVELOPE_KEYS = ["operationId", "actor", "action", "body"] as const;
const IDENT_MAX = 100;

export type LocalCallEnvelope = {
  operationId: string;
  actor: string;
  action: CommandName;
  body: Record<string, unknown>;
};

export type Transport = (envelope: LocalCallEnvelope) => unknown;

export type LocalCallClient = {
  invoke(envelope: unknown): unknown;
};

const COMMAND_SET = new Set<string>(COMMANDS);

function isCommandName(value: string): value is CommandName {
  return COMMAND_SET.has(value);
}

function assertIdent(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new CatalogueRejection("INVALID_ID", label);
  }
  const length = Array.from(value).length;
  if (length === 0 || length > IDENT_MAX || value.trim() !== value) {
    throw new CatalogueRejection("INVALID_ID", label);
  }
}

export function createLocalCallClient(options: { transport: Transport }): LocalCallClient {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new CatalogueRejection("SCHEMA", "options");
  }
  for (const key of Object.keys(options)) {
    if (key !== "transport") {
      throw new CatalogueRejection("UNKNOWN_FIELD", key);
    }
  }
  if (typeof options.transport !== "function") {
    throw new CatalogueRejection("SCHEMA", "transport");
  }
  const transport = options.transport;
  return {
    invoke(raw: unknown): unknown {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        throw new CatalogueRejection("ENVELOPE", "envelope");
      }
      const record = raw as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (!ENVELOPE_KEYS.includes(key as (typeof ENVELOPE_KEYS)[number])) {
          throw new CatalogueRejection("ENVELOPE_EXTRA", key);
        }
      }
      for (const key of ENVELOPE_KEYS) {
        if (!Object.hasOwn(record, key)) {
          throw new CatalogueRejection("ENVELOPE", key);
        }
      }
      assertIdent(record.operationId, "operationId");
      assertIdent(record.actor, "actor");
      if (typeof record.action !== "string" || !isCommandName(record.action)) {
        throw new CatalogueRejection("UNKNOWN_ACTION", "action");
      }
      const action: CommandName = record.action;
      if (record.body === null || typeof record.body !== "object" || Array.isArray(record.body)) {
        throw new CatalogueRejection("WRONG_TYPE", "body");
      }
      const body = record.body as Record<string, unknown>;
      validateSchema(body, COMMAND_SCHEMAS[action] as JsonSchema);
      if (body.domain !== OPENAPI_PIN.domain) {
        throw new CatalogueRejection("DOMAIN_MISMATCH", "body.domain");
      }
      const envelope: LocalCallEnvelope = {
        operationId: record.operationId,
        actor: record.actor,
        action,
        body,
      };
      return transport(envelope);
    },
  };
}
