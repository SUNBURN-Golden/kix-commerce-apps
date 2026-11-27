import { CONSENT_COMPOSED, GIFT_COMPOSED, ORGANIZER_COMPOSED } from "../../../packages/protocol-adapter/src/composer-runtime";
import { sha256Hex } from "../../../packages/protocol-adapter/src/sha256";
import type { SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { attemptNumber, EVIDENCE_LOST, isCoreIntentScope, persistOwnedIntent, pinDigest, type Mode } from "./booking-journey-intent";

const steps = {
  organizer: ORGANIZER_COMPOSED,
  gift: GIFT_COMPOSED,
  consent: CONSENT_COMPOSED,
} as const;
type Desk = keyof typeof steps;
type Attempt = { step: string; operationId: string };
type DeskIntent = Attempt & { lastConfirmed: Attempt | null; scopeDigest: string | null };
const prefixes = { organizer: "org", gift: "gft", consent: "cns" };
const digestPattern = /^[a-f0-9]{64}$/;

function keyFor(desk: Desk, mode: Mode, scope: string) {
  return `kix-${desk}-intent:${mode}:${encodeURIComponent(scope)}`;
}

export function intentScopeDigest(fields: object): string {
  return sha256Hex(JSON.stringify(fields));
}

/** Keep generated fixture inventory IDs and mask arbitrary caller-entered IDs. */
export function invitationRef(inventoryId: string): string {
  return /^inv-\d{1,8}$/.test(inventoryId) ? inventoryId : intentScopeDigest([inventoryId]).slice(0, 24);
}

function countFor(desk: Desk, scope: string, attempt: Attempt): number {
  if (!(steps[desk] as readonly string[]).includes(attempt.step) || typeof attempt.operationId !== "string") return 0;
  const suffix = attempt.step === "issue_invitation" ? attempt.operationId.slice(attempt.operationId.lastIndexOf(":")) : "";
  if (suffix && !/^:(?:inv-\d{1,8}|[a-f0-9]{24})$/.test(suffix)) return 0;
  return attemptNumber(`${prefixes[desk]}:${scope}:`, attempt, suffix);
}

function validIntent(desk: Desk, scope: string, row: DeskIntent): boolean {
  if (!isCoreIntentScope(scope)) return false;
  const count = countFor(desk, scope, row);
  const prev = row.lastConfirmed;
  const prior = prev === null ? 0 : countFor(desk, scope, prev);
  if (!count || (prev !== null && (Object.keys(prev).length !== 2 || !prior || prev.operationId === row.operationId))) return false;
  const needsDigest = desk === "consent" || row.step === "issue_invitation";
  if (needsDigest ? typeof row.scopeDigest !== "string" || !digestPattern.test(row.scopeDigest) : row.scopeDigest !== null) return false;
  if (desk === "gift") return row.step === "offer_gift" ? prev === null : prev?.step === "offer_gift" && prior === count;
  if (desk === "consent") {
    return row.step === "set_consent" ? prior < count : (prev === null || prev.step === "set_consent") && (prior === 0 || prior === count);
  }
  // Organizer lifecycle order belongs to Core. The desk may also issue
  // invitations independently, or issue several for different inventory IDs.
  return row.step !== "create_event" && (prev === null || prior === count);
}

export function readCoreDeskIntent(store: SessionStorePort | null, desk: Desk, mode: Mode, scope: string) {
  try {
    if (!store) return EVIDENCE_LOST;
    const raw = store.getItem(keyFor(desk, mode, scope));
    if (raw === null) return null;
    const row = JSON.parse(raw);
    if (Object.keys(row).length === 9 && row.v === 1 && row.pinDigest === pinDigest && row.desk === desk &&
        row.mode === mode && row.scope === scope && validIntent(desk, scope, row)) return row as DeskIntent;
  } catch {
    // An unreadable or incompatible record holds the scope.
  }
  return EVIDENCE_LOST;
}

export function persistCoreDeskIntent(store: SessionStorePort | null, desk: Desk, mode: Mode, scope: string, intent: DeskIntent) {
  if (!validIntent(desk, scope, intent)) throw new Error(EVIDENCE_LOST);
  return persistOwnedIntent(store, keyFor(desk, mode, scope), { v: 1, pinDigest, mode, desk, scope, ...intent });
}

type HistoryRow = {
  step: string; phase: string; operationId: string | null; code: string | null; note: string;
  actor: string | null; requestId: string | null; correlationId: string | null; receipt: unknown;
};

// The rows display history only. The desk's live composer receives no receipt.
export function restoreDeskIntent(
  rows: HistoryRow[], history: { step: string; operationId: string; lastConfirmed: Attempt | null } | typeof EVIDENCE_LOST,
  step = rows[0].step,
): Attempt | undefined {
  if (history !== EVIDENCE_LOST && history.lastConfirmed) {
    const confirmed = rows.find(row => row.step === history.lastConfirmed?.step);
    if (confirmed && confirmed.phase === "pending") {
      confirmed.phase = "confirmed";
      confirmed.operationId = history.lastConfirmed.operationId;
      confirmed.actor = confirmed.requestId = confirmed.correlationId = confirmed.receipt = null;
    }
  }
  const row = rows.find(row => row.step === (history === EVIDENCE_LOST ? step : history.step)) ?? rows[0];
  row.phase = history === EVIDENCE_LOST ? "not-sent" : "unconfirmed";
  row.code = history === EVIDENCE_LOST ? EVIDENCE_LOST : "UNKNOWN";
  row.operationId = history === EVIDENCE_LOST ? null : history.operationId;
  row.note = row.code;
  row.actor = row.requestId = row.correlationId = row.receipt = null;
  return history === EVIDENCE_LOST ? undefined : history.lastConfirmed ?? undefined;
}

export function lastConfirmedAttempt(rows: { step: string; operationId: string | null; status: string }[]): Attempt | null {
  const row = [...rows].reverse().find(item => item.status === "confirmed" && item.operationId !== null);
  return row?.operationId ? { step: row.step, operationId: row.operationId } : null;
}
