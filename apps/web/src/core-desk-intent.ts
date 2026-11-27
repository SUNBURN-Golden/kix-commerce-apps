import { CONSENT_COMPOSED, GIFT_COMPOSED, ORGANIZER_COMPOSED } from "../../../packages/protocol-adapter/src/composer-runtime";
import { sha256Hex } from "../../../packages/protocol-adapter/src/sha256";
import type { SessionStorePort } from "../../../packages/protocol-adapter/src/shell-entry";
import { attemptNumber, EVIDENCE_LOST, isCoreIntentScope, persistOwnedIntent, pinDigest, readBookingIntent, type Mode } from "./booking-journey-intent";
import type { COUNTER_EXHAUSTED } from "./desk-attempts";
import type { PageSessionStore } from "./session-store";

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

function keyFor(desk: Desk, mode: Mode, scope: string, intent?: DeskIntent) {
  const target = intent?.step === "issue_invitation" ? `${intent.scopeDigest}:` : "";
  return `kix-${desk}-intent:${mode}:${target}${encodeURIComponent(scope)}`;
}

export function intentScopeDigest(fields: object): string {
  return sha256Hex(JSON.stringify(fields));
}

/** Keep generated fixture inventory IDs and mask arbitrary caller-entered IDs. */
function invitationRef(inventoryId: string): string {
  return /^inv-\d{1,8}$/.test(inventoryId) ? inventoryId : intentScopeDigest([inventoryId]).slice(0, 24);
}

function compactInvitationPrefix(scope: string): string {
  return `orgi:${intentScopeDigest([scope]).slice(0, 32)}:`;
}

export function invitationOperationId(scope: string, attempt: number, inventoryId: string): string {
  const tail = `${attempt}:issue_invitation:${invitationRef(inventoryId)}`;
  const operationId = `org:${scope}:${tail}`;
  return Array.from(operationId).length <= 100 ? operationId : `${compactInvitationPrefix(scope)}${tail}`;
}

function countFor(desk: Desk, scope: string, attempt: Attempt): number {
  if (!(steps[desk] as readonly string[]).includes(attempt.step) || typeof attempt.operationId !== "string") return 0;
  const suffix = attempt.step === "issue_invitation" ? attempt.operationId.slice(attempt.operationId.lastIndexOf(":")) : "";
  if (suffix && !/^:(?:inv-\d{1,8}|[a-f0-9]{24})$/.test(suffix)) return 0;
  return attemptNumber(`${prefixes[desk]}:${scope}:`, attempt, suffix) ||
    (suffix ? attemptNumber(compactInvitationPrefix(scope), attempt, suffix) : 0);
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

export function readCoreDeskIntent(store: SessionStorePort | null, desk: Desk, mode: Mode, scope: string, storageKey?: string) {
  try {
    if (!store) return EVIDENCE_LOST;
    const raw = store.getItem(storageKey ?? keyFor(desk, mode, scope));
    if (raw === null) return null;
    const row = JSON.parse(raw);
    if (Object.keys(row).length === 9 && row.v === 1 && row.pinDigest === pinDigest && row.desk === desk &&
        row.mode === mode && row.scope === scope && validIntent(desk, scope, row)) return row as DeskIntent;
  } catch {
    // An unreadable or incompatible record holds the scope.
  }
  return EVIDENCE_LOST;
}

export function readOrganizerIntent(store: PageSessionStore | null, mode: Mode, eventId: string, inventoryId?: string) {
  if (!store) return EVIDENCE_LOST;
  const core = readBookingIntent(store, mode, eventId);
  if (core === EVIDENCE_LOST || core?.step === "create_event") return core;
  try {
    const prefix = keyFor("organizer", mode, "");
    const inventoryDigest = inventoryId === undefined ? undefined : intentScopeDigest([inventoryId]);
    const eventKey = encodeURIComponent(eventId);
    for (const key of store.keys()) {
      if (!key.startsWith(prefix)) continue;
      const [ref, label, extra] = key.slice(prefix.length).split(":");
      const ownEvent = (label ?? ref) === eventKey;
      if (!ownEvent && (label === undefined ? inventoryId === undefined : ref !== inventoryDigest)) continue;
      if (extra !== undefined) return EVIDENCE_LOST;
      const scope = decodeURIComponent(label ?? ref);
      const history = readCoreDeskIntent(store, "organizer", mode, scope, key);
      if (!history || history === EVIDENCE_LOST) return EVIDENCE_LOST;
      if (ownEvent && label === undefined) return history;
      // Earlier tabs keyed invitations by event and hashed the event together with the inventory.
      if (history.step === "issue_invitation" && history.scopeDigest === (label === undefined ? intentScopeDigest([scope, inventoryId]) : ref)) {
        return ownEvent ? history : { ...history, lastConfirmed: null };
      }
      if (label !== undefined) return EVIDENCE_LOST;
    }
    return null;
  } catch {
    return EVIDENCE_LOST;
  }
}

export function persistCoreDeskIntent(store: SessionStorePort | null, desk: Desk, mode: Mode, scope: string, intent: DeskIntent) {
  if (!validIntent(desk, scope, intent)) throw new Error(EVIDENCE_LOST);
  return persistOwnedIntent(store, keyFor(desk, mode, scope, intent), { v: 1, pinDigest, mode, desk, scope, ...intent });
}

type HistoryRow = {
  step: string; phase: string; operationId: string | null; code: string | null; note: string;
  actor: string | null; requestId: string | null; correlationId: string | null; receipt: unknown;
};

// The rows display history only. The desk's live composer receives no receipt.
export function restoreDeskIntent(
  rows: HistoryRow[],
  history: { step: string; operationId: string; lastConfirmed: Attempt | null } | typeof EVIDENCE_LOST | typeof COUNTER_EXHAUSTED,
  step = rows[0].step,
): Attempt | undefined {
  const pending = typeof history !== "string";
  const prior = pending ? history.lastConfirmed : null;
  if (prior) {
    const confirmed = rows.find(row => row.step === prior.step);
    if (confirmed && confirmed.phase === "pending") {
      confirmed.phase = "confirmed";
      confirmed.operationId = prior.operationId;
      confirmed.actor = confirmed.requestId = confirmed.correlationId = confirmed.receipt = null;
    }
  }
  const row = rows.find(row => row.step === (pending ? history.step : step)) ?? rows[0];
  row.phase = pending ? "unconfirmed" : "not-sent";
  row.code = pending ? "UNKNOWN" : history;
  row.operationId = pending ? history.operationId : null;
  row.note = row.code;
  row.actor = row.requestId = row.correlationId = row.receipt = null;
  return prior ?? undefined;
}

export function lastConfirmedAttempt(rows: { step: string; operationId: string | null; status: string }[]): Attempt | null {
  const row = [...rows].reverse().find(item => item.status === "confirmed" && item.operationId !== null);
  return row?.operationId ? { step: row.step, operationId: row.operationId } : null;
}
