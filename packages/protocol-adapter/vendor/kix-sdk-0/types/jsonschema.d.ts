/**
 * Consumer-side declarations for the vendored kix-protocol p-sdk-0 module
 * sdk/src/jsonschema.ts. The vendored file is byte-identical pin material and
 * is not part of the tsc program; this file only describes its surface.
 */
export declare class StrictJsonError extends Error {
  readonly reason: string;
  constructor(reason: string);
}

export declare class CatalogueRejection extends Error {
  readonly code: string;
  constructor(code: string, detail?: string);
}

export type JsonSchema = {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly enum?: readonly unknown[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
};

export declare function compareCodePoints(left: string, right: string): number;
export declare function codePointLength(value: string): number;
export declare function parseStrict(input: Uint8Array | string): unknown;
export declare function canonicalStringify(value: unknown): string;
export declare function validateSchema(value: unknown, schema: JsonSchema, path?: string): void;
