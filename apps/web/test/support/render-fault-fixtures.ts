/** Test-only: hostile things a screen could throw, and a component that throws on purpose. */

export const HOSTILE_TEXT = {
  bearer: "Bearer sk_live_FAKE0123456789abcdef",
  email: "buyer.person@example.test",
  stack: "at renderReceipts (/srv/app/src/pages/Receipts.tsx:41:9)",
  body: '{"detail":"raw response body","token":"tok_FAKE_body_secret"}',
} as const;

export class CarryingError extends Error {
  code = "GATE_UNAVAILABLE";
  requestId = "req_0123456789";
  correlationId = "cor_0123456789";
  constructor() {
    super(`${HOSTILE_TEXT.bearer} ${HOSTILE_TEXT.email} ${HOSTILE_TEXT.body}`);
    this.stack = `Error: leak\n    ${HOSTILE_TEXT.stack}`;
  }
}

/** Thrown values of every shape: errors, strings, null and bare objects. */
export const THROWN_SAMPLES: readonly unknown[] = [
  new CarryingError(),
  new Error(`${HOSTILE_TEXT.bearer} ${HOSTILE_TEXT.email}`),
  HOSTILE_TEXT.stack,
  null,
  undefined,
  { message: HOSTILE_TEXT.body, code: "lower case code with spaces", requestId: HOSTILE_TEXT.bearer },
];

export function ThrowingScreen(): never {
  throw new CarryingError();
}
