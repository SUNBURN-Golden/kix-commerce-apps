/**
 * Render-fault classification for the app shell. App-internal; not a public schema, operation or ID.
 *
 * Only a closed set of fields leaves this module. The error message, the stack and any response text are
 * never copied, so nothing they hold can reach the screen. Duck-typed on purpose: this file does not import
 * the adapter, a desk or any storage.
 */

export interface RenderFault {
  kind: "render-error";
  /** Upper-case code the thrown value carried, when it matched the safe shape. */
  code: string | null;
  requestId: string | null;
  correlationId: string | null;
  /** Local reference for this panel: shell-fault-NNNN. Not a trace id and not sent anywhere. */
  reference: string;
}

const CODE_SHAPE = /^[A-Z][A-Z0-9_]{1,47}$/;
const ID_SHAPE = /^[A-Za-z0-9._:-]{8,64}$/;

let counter = 0;

function safe(value: unknown, shape: RegExp): string | null {
  return typeof value === "string" && shape.test(value) ? value : null;
}

export function classifyFault(thrown: unknown): RenderFault {
  counter += 1;
  const source = typeof thrown === "object" && thrown !== null ? (thrown as Record<string, unknown>) : {};
  return {
    kind: "render-error",
    code: safe(source.code, CODE_SHAPE),
    requestId: safe(source.requestId, ID_SHAPE),
    correlationId: safe(source.correlationId, ID_SHAPE),
    reference: `shell-fault-${String(counter).padStart(4, "0")}`,
  };
}
