/**
 * Consumer-side declarations for the vendored kix-protocol p-sdk-0 generated
 * module sdk/generated/catalogue.ts. The vendored file is byte-identical pin
 * material and is not part of the tsc program; this file only describes its
 * surface. The command literals mirror the pinned manifest's command set.
 */
import type { JsonSchema } from "#kix-sdk-0/jsonschema";

export declare const OPENAPI_PIN: {
  readonly commandCount: number;
  readonly contractStatus: string;
  readonly domain: string;
  readonly gitBlob: string;
  readonly liveHttpServer: boolean;
  readonly openapiPath: string;
  readonly productionEndpoint: boolean;
  readonly sha256: string;
  readonly sourceAuthentication: string;
  readonly sourceGitBlob: string;
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly unknownFields: string;
};

export declare const ENVELOPE_REQUIRED: readonly ["operationId", "actor", "action", "body"];

export declare const COMMANDS: readonly [
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
];

export declare type CommandName = (typeof COMMANDS)[number];

export declare const ACTION_BODY_MAP: { readonly [K in CommandName]: string };

export declare const COMMAND_SCHEMAS: { readonly [K in CommandName]: JsonSchema };
