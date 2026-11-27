import { ProtocolError, type SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { JOURNEY_COMPOSED, type JourneyStep } from "../../../packages/protocol-adapter/src/booking-journey";
import type { CommerceJourneyBranch } from "../../../packages/protocol-adapter/src/commerce-journey";
import type { CommerceJourneyStep } from "../../../packages/protocol-adapter/src/commerce-journey-command";
import { assertAllowedStorageKey } from "./storage-allow-list";

export type OwnedIntent = ReturnType<typeof persistOwnedIntent>;
export type Mode = "stub" | "integration-http";
type Step = JourneyStep | CommerceJourneyStep;
export type ConfirmedAttempt<S extends Step> = { step: S; operationId: string };
type Scope<B> = { mode: Mode; eventId: string; branch: B };
type Intent<S extends Step, B> = Scope<B> & ConfirmedAttempt<S> & {
  v: 1;
  pinDigest: string;
  lastConfirmed: ConfirmedAttempt<S> | null;
};
type CoreIntent = Intent<JourneyStep, null>;
type FsmIntent = Intent<CommerceJourneyStep, CommerceJourneyBranch>;
type BookingIntent = CoreIntent | FsmIntent;
type FsmOrder = (branch: CommerceJourneyBranch, confirmed: CommerceJourneyStep | null) =>
  { next?: CommerceJourneyStep; decline?: CommerceJourneyStep } | null;
export const EVIDENCE_LOST = "SESSION_EVIDENCE_LOST";
export const pinDigest = __KIX_BUILD_IDENTITY__.pinDigest;

export function isCoreIntentScope(scope: string): boolean {
  // Keep the caller's exact ID in the encoded key. Lone surrogates cannot be URI-encoded.
  return /^(?!\s*$)[^\uD800-\uDFFF]{1,100}$/u.test(scope);
}

export function fsmAttemptScope(eventId: string): string {
  return `fsm:${eventId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}`;
}

function keyFor(mode: Mode, coreEventId?: string): string {
  const key = coreEventId === undefined ? `kix-journey-intent:fsm:${mode}` :
    `kix-journey-intent:core:${mode}:${encodeURIComponent(coreEventId)}`;
  assertAllowedStorageKey(key);
  return key;
}

export function attemptNumber(prefix: string, attempt: { step: string; operationId: string }, suffix = ""): number {
  const { operationId, step } = attempt;
  if (typeof operationId !== "string" || typeof step !== "string" ||
      Array.from(operationId).length > 100 ||
      !operationId.startsWith(prefix) || !operationId.endsWith(`:${step}${suffix}`)) return 0;
  const digits = operationId.slice(prefix.length, -(step.length + 1 + suffix.length));
  const count = Number(digits);
  return /^[1-9]\d*$/.test(digits) && Number.isSafeInteger(count) ? count : 0;
}

export function readBookingIntent(store: SessionStorePort | null, mode: Mode, scope: string): CoreIntent | typeof EVIDENCE_LOST | null;
export function readBookingIntent(store: SessionStorePort | null, mode: Mode, scope: FsmOrder): FsmIntent | typeof EVIDENCE_LOST | null;
export function readBookingIntent(store: SessionStorePort | null, mode: Mode, scope: string | FsmOrder): BookingIntent | typeof EVIDENCE_LOST | null {
  const coreEventId = typeof scope === "string" ? scope : undefined;
  try {
    if (!store) return EVIDENCE_LOST;
    const raw = store.getItem(keyFor(mode, coreEventId));
    if (raw === null) return null;
    const row: BookingIntent = JSON.parse(raw);
    if (row.v !== 1 || row.mode !== mode || row.pinDigest !== pinDigest ||
        typeof row.eventId !== "string" || !row.eventId || Object.keys(row).length !== 8 ||
        (row.lastConfirmed !== null && Object.keys(row.lastConfirmed).length !== 2)) return EVIDENCE_LOST;
    const prefix = `jrn:${row.branch === null ? row.eventId : fsmAttemptScope(row.eventId)}:`;
    const count = attemptNumber(prefix, row) || (row.branch === null && row.step === "create_event" && row.lastConfirmed === null
      ? attemptNumber(`org:${row.eventId}:`, row) : 0);
    const previous = row.lastConfirmed === null ? 0 : attemptNumber(prefix, row.lastConfirmed);
    if (!count || (row.lastConfirmed !== null && !previous)) return EVIDENCE_LOST;
    if (row.branch === null) {
      const index = row.lastConfirmed === null ? -1 : JOURNEY_COMPOSED.indexOf(row.lastConfirmed.step);
      if (row.eventId === coreEventId && (index >= 0 || row.lastConfirmed === null) &&
          (previous === 0 || previous === count) && JOURNEY_COMPOSED[index + 1] === row.step) return row;
    } else if (typeof scope === "function" && previous < count &&
        (row.branch === "resale" || row.branch === "admission" || row.branch === "refund")) {
      const plan = scope(row.branch, row.lastConfirmed?.step ?? null);
      if (row.step === plan?.next || row.step === plan?.decline) return row;
    }
  } catch {
    // Keep the fence when the tab cannot read or validate its history.
  }
  return EVIDENCE_LOST;
}

export function persistBookingIntent(
  store: SessionStorePort | null, intent: Omit<BookingIntent, "v" | "pinDigest">,
) {
  if (intent.branch === null && (!isCoreIntentScope(intent.eventId) ||
      !attemptNumber(`${intent.operationId.startsWith("org:") && intent.step === "create_event" ? "org" : "jrn"}:${intent.eventId}:`, intent))) {
    throw new ProtocolError(EVIDENCE_LOST, EVIDENCE_LOST);
  }
  return persistOwnedIntent(store, keyFor(intent.mode, intent.branch === null ? intent.eventId : undefined),
    { v: 1, pinDigest, ...intent });
}

export function persistOwnedIntent(store: SessionStorePort | null, key: string, record: object) {
  try {
    assertAllowedStorageKey(key);
    if (!store || store.getItem(key) !== null) throw new Error();
    const raw = JSON.stringify(record);
    store.setItem(key, raw);
    if (store.getItem(key) !== raw) throw new Error();
    const verify = () => {
      const current = store.getItem(key);
      if (current === raw) return;
      // Keep a deleted intent fenced on reload without replacing another record.
      if (current === null) store.setItem(key, EVIDENCE_LOST);
      throw new Error(EVIDENCE_LOST);
    };
    return Object.assign(() => {
      verify();
      store.removeItem(key);
      if (store.getItem(key) !== null) throw new Error(EVIDENCE_LOST);
    }, { verify });
  } catch {
    throw new ProtocolError(EVIDENCE_LOST, EVIDENCE_LOST);
  }
}
