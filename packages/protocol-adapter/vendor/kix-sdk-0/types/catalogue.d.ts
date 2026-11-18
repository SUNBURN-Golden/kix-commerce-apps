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
  readonly coreCommandCount: number;
  readonly domain: string;
  readonly fsmCommandCount: number;
  readonly fsmSourceGitBlob: string;
  readonly fsmSourcePath: string;
  readonly fsmSourceSha256: string;
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
  "settlement_initiate",
  "settlement_authorize",
  "settlement_capture",
  "settlement_commit",
  "settlement_fail",
  "settlement_cancel",
  "settlement_observe_statement",
  "settlement_distribute",
  "settlement_bind_refund",
  "settlement_observe_mock_cancel_acceptance",
  "reservation_set_clock",
  "reservation_register_show",
  "reservation_hold",
  "reservation_release",
  "reservation_confirm",
  "reservation_cancel",
  "reservation_observe_payment",
  "reservation_bind_settlement",
  "reservation_issue",
  "reservation_authorize_admission",
  "reservation_consume",
  "resale_set_clock",
  "resale_adopt_issued",
  "resale_list_resale",
  "resale_hold_buy",
  "resale_release_hold",
  "resale_cancel_listing",
  "resale_observe_resale_payment",
  "resale_bind_settlement",
  "resale_accept_resale",
  "resale_close",
  "admission_set_clock",
  "admission_adopt_issued",
  "admission_authorize_admission",
  "admission_consume",
  "credit_offer",
  "credit_approve",
  "credit_reject",
  "credit_cancel",
  "credit_bind_settlement",
  "credit_draw",
  "credit_repay",
  "credit_close",
  "credit_default",
];

export declare type CommandName = (typeof COMMANDS)[number];

export declare const ACTION_BODY_MAP: { readonly [K in CommandName]: string };

export declare const COMMAND_SCHEMAS: { readonly [K in CommandName]: JsonSchema };
