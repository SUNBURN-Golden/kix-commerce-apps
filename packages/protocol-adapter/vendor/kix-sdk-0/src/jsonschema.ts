/**
 * Strict JSON subset and the command-schema checks used by the 0.x client.
 *
 * Canonical form is compact UTF-8 JSON: code-point key order, no insignificant
 * whitespace, no trailing bytes, no duplicate keys. Numbers are canonical
 * decimal integers inside the safe-integer range. This is not a transport
 * or retry contract.
 */

export class StrictJsonError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "StrictJsonError";
    this.reason = reason;
  }
}

export class CatalogueRejection extends Error {
  readonly code: string;

  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "CatalogueRejection";
    this.code = code;
  }
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

const SAFE_MAX = 9007199254740991;
const MAX_DEPTH = 32;

export function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const count = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < count; index += 1) {
    const delta = leftPoints[index].codePointAt(0)! - rightPoints[index].codePointAt(0)!;
    if (delta !== 0) {
      return delta;
    }
  }
  return leftPoints.length - rightPoints.length;
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

function isWhitespace(character: string): boolean {
  return character === " " || character === "\n" || character === "\r" || character === "\t";
}

class Parser {
  private readonly text: string;
  private index = 0;
  private depth = 0;

  constructor(text: string) {
    this.text = text;
  }

  eof(): boolean {
    return this.index >= this.text.length;
  }

  parseValue(): unknown {
    if (this.eof()) {
      throw new StrictJsonError("truncated");
    }
    const character = this.text[this.index];
    if (isWhitespace(character)) {
      throw new StrictJsonError("whitespace");
    }
    if (character === "{") {
      return this.parseObject();
    }
    if (character === "[") {
      return this.parseArray();
    }
    if (character === '"') {
      return this.parseString();
    }
    if (character === "t") {
      return this.parseLiteral("true", true);
    }
    if (character === "f") {
      return this.parseLiteral("false", false);
    }
    if (character === "n") {
      return this.parseLiteral("null", null);
    }
    if (character === "-" || (character >= "0" && character <= "9")) {
      return this.parseNumber();
    }
    throw new StrictJsonError("non-canonical");
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) {
      throw new StrictJsonError("depth");
    }
  }

  private leave(): void {
    this.depth -= 1;
  }

  private parseLiteral(word: string, value: unknown): unknown {
    if (this.text.slice(this.index, this.index + word.length) !== word) {
      throw new StrictJsonError("truncated");
    }
    this.index += word.length;
    return value;
  }

  private parseNumber(): number {
    const start = this.index;
    if (this.text[this.index] === "-") {
      this.index += 1;
    }
    if (this.eof()) {
      throw new StrictJsonError("truncated");
    }
    const digit = this.text[this.index];
    if (digit === "0") {
      this.index += 1;
      const follower = this.text[this.index] ?? "";
      if (follower >= "0" && follower <= "9") {
        throw new StrictJsonError("non-integer");
      }
    } else if (digit >= "1" && digit <= "9") {
      while ((this.text[this.index] ?? "") >= "0" && (this.text[this.index] ?? "") <= "9") {
        this.index += 1;
      }
    } else {
      throw new StrictJsonError("non-integer");
    }
    const token = this.text.slice(start, this.index);
    const next = this.text[this.index] ?? "";
    if (next === "." || next === "e" || next === "E") {
      throw new StrictJsonError("non-integer");
    }
    if (token === "-" || token === "-0" || !/^-?(0|[1-9][0-9]*)$/.test(token)) {
      throw new StrictJsonError("non-integer");
    }
    const value = Number(token);
    if (!Number.isSafeInteger(value) || value < -SAFE_MAX || value > SAFE_MAX) {
      throw new StrictJsonError("integer-range");
    }
    return value;
  }

  private parseString(): string {
    const start = this.index;
    if (this.text[this.index] !== '"') {
      throw new StrictJsonError("non-canonical");
    }
    this.index += 1;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      this.index += 1;
      if (character === '"') {
        try {
          const value = JSON.parse(this.text.slice(start, this.index));
          if (typeof value !== "string") {
            throw new StrictJsonError("invalid-string");
          }
          return value;
        } catch (error) {
          if (error instanceof StrictJsonError) {
            throw error;
          }
          throw new StrictJsonError("invalid-string");
        }
      }
      if (character === "\\") {
        if (this.index >= this.text.length) {
          throw new StrictJsonError("truncated");
        }
        this.index += 1;
      } else if (character.charCodeAt(0) < 0x20) {
        throw new StrictJsonError("invalid-string");
      }
    }
    throw new StrictJsonError("truncated");
  }

  private parseObject(): Record<string, unknown> {
    this.enter();
    this.index += 1;
    const object = Object.create(null) as Record<string, unknown>;
    let previous: string | undefined;
    if (this.text[this.index] === "}") {
      this.index += 1;
      this.leave();
      return object;
    }
    for (;;) {
      if (this.eof()) {
        throw new StrictJsonError("truncated");
      }
      if (isWhitespace(this.text[this.index])) {
        throw new StrictJsonError("whitespace");
      }
      if (this.text[this.index] !== '"') {
        throw new StrictJsonError("non-canonical");
      }
      const key = this.parseString();
      if (this.eof()) {
        throw new StrictJsonError("truncated");
      }
      if (isWhitespace(this.text[this.index])) {
        throw new StrictJsonError("whitespace");
      }
      if (this.text[this.index] !== ":") {
        throw new StrictJsonError("non-canonical");
      }
      this.index += 1;
      const value = this.parseValue();
      if (Object.hasOwn(object, key)) {
        throw new StrictJsonError("duplicate-key");
      }
      if (previous !== undefined && compareCodePoints(previous, key) > 0) {
        throw new StrictJsonError("unsorted-keys");
      }
      object[key] = value;
      previous = key;
      if (this.eof()) {
        throw new StrictJsonError("truncated");
      }
      if (isWhitespace(this.text[this.index])) {
        throw new StrictJsonError("whitespace");
      }
      if (this.text[this.index] === ",") {
        this.index += 1;
        continue;
      }
      if (this.text[this.index] === "}") {
        this.index += 1;
        this.leave();
        return object;
      }
      throw new StrictJsonError("non-canonical");
    }
  }

  private parseArray(): unknown[] {
    this.enter();
    this.index += 1;
    const values: unknown[] = [];
    if (this.text[this.index] === "]") {
      this.index += 1;
      this.leave();
      return values;
    }
    for (;;) {
      if (this.eof()) {
        throw new StrictJsonError("truncated");
      }
      if (isWhitespace(this.text[this.index])) {
        throw new StrictJsonError("whitespace");
      }
      values.push(this.parseValue());
      if (this.eof()) {
        throw new StrictJsonError("truncated");
      }
      if (isWhitespace(this.text[this.index])) {
        throw new StrictJsonError("whitespace");
      }
      if (this.text[this.index] === ",") {
        this.index += 1;
        continue;
      }
      if (this.text[this.index] === "]") {
        this.index += 1;
        this.leave();
        return values;
      }
      throw new StrictJsonError("non-canonical");
    }
  }
}

export function parseStrict(input: Uint8Array | string): unknown {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new StrictJsonError("invalid-utf8");
  }
  const parser = new Parser(text);
  const value = parser.parseValue();
  if (!parser.eof()) {
    throw new StrictJsonError("trailing-bytes");
  }
  return value;
}

function encodeString(value: string): string {
  return JSON.stringify(value);
}

export function canonicalStringify(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (typeof value === "number") {
    if (Object.is(value, -0) || !Number.isSafeInteger(value)) {
      throw new StrictJsonError("non-integer");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodePoints);
    const fields = keys.map((key) => `${encodeString(key)}:${canonicalStringify(record[key])}`);
    return `{${fields.join(",")}}`;
  }
  throw new StrictJsonError("unsupported-value");
}

function typeNames(schema: JsonSchema): readonly string[] | undefined {
  if (schema.type === undefined) {
    return undefined;
  }
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function matchesType(value: unknown, typeName: string): boolean {
  if (typeName === "string") {
    return typeof value === "string";
  }
  if (typeName === "integer") {
    return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0);
  }
  if (typeName === "boolean") {
    return typeof value === "boolean";
  }
  if (typeName === "array") {
    return Array.isArray(value);
  }
  if (typeName === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  if (typeName === "null") {
    return value === null;
  }
  throw new CatalogueRejection("SCHEMA", `unsupported type ${typeName}`);
}

function sameEnumMember(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  try {
    return canonicalStringify(left) === canonicalStringify(right);
  } catch {
    return false;
  }
}

export function validateSchema(value: unknown, schema: JsonSchema, path = "$"): void {
  if (schema.enum !== undefined && !schema.enum.some((item) => sameEnumMember(item, value))) {
    throw new CatalogueRejection("WRONG_TYPE", path);
  }
  const types = typeNames(schema);
  if (types !== undefined && !types.some((typeName) => matchesType(value, typeName))) {
    throw new CatalogueRejection("WRONG_TYPE", path);
  }
  if (typeof value === "string") {
    const length = codePointLength(value);
    if (schema.minLength !== undefined && length < schema.minLength) {
      throw new CatalogueRejection("CONSTRAINT", `${path} minLength`);
    }
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      throw new CatalogueRejection("CONSTRAINT", `${path} maxLength`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new CatalogueRejection("CONSTRAINT", `${path} minimum`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new CatalogueRejection("CONSTRAINT", `${path} maximum`);
    }
  }
  if (types?.includes("object") && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(record, key)) {
        throw new CatalogueRejection("MISSING_REQUIRED", `${path}.${key}`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!Object.hasOwn(properties, key)) {
          throw new CatalogueRejection("UNKNOWN_FIELD", `${path}.${key}`);
        }
      }
    } else if (schema.additionalProperties !== undefined) {
      throw new CatalogueRejection("SCHEMA", "additionalProperties must be false when present");
    }
    for (const key of Object.keys(record)) {
      const child = properties[key];
      if (child !== undefined) {
        validateSchema(record[key], child, `${path}.${key}`);
      }
    }
  }
}
