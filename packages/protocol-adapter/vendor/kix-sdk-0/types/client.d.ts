/**
 * Consumer-side declarations for the vendored kix-protocol p-sdk-0 module
 * sdk/src/client.ts. The vendored file is byte-identical pin material and is
 * not part of the tsc program; this file only describes its surface.
 */
import type { CommandName } from "#kix-sdk-0/catalogue";

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

export declare function createLocalCallClient(options: { transport: Transport }): LocalCallClient;
