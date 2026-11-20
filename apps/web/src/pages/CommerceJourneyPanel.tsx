import { useState, useSyncExternalStore } from "react";
import { CommerceJourney, commerceStepAfter, type CommerceJourneyBranch } from "../../../../packages/protocol-adapter/src/commerce-journey";
import { commerceJourneyRead, type CommerceJourneyNotBound, type CommerceJourneyStep } from "../../../../packages/protocol-adapter/src/commerce-journey-command";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { protocol } from "../connectivity/desk-protocol";
import { readDeskAttempt, writeDeskAttempt } from "../desk-attempts";
import { useLocale } from "../i18n/locale-context";
import { messages as desk } from "../i18n/desk-catalogue";
import { messages as copy } from "../i18n/messages/pages--CommerceJourneyPanel";
import { SafeText } from "../safe-text";
import { pageSessionStore } from "../session-store";
import { EVIDENCE_LOST, fsmAttemptScope, persistBookingIntent, readBookingIntent, type ConfirmedAttempt } from "../booking-journey-intent";

interface OpenJourney {
  eventId: string;
  journey: CommerceJourney;
  lastConfirmed: ConfirmedAttempt<CommerceJourneyStep> | null;
  clearIntent?: () => void;
  evidenceLost?: boolean;
}

let active: OpenJourney | undefined;
let revision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const version = () => revision;
function publish() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

function open(eventId: string, branch: CommerceJourneyBranch) {
  if (active || !eventId) return;
  const mode = protocol.describe().environment;
  const store = pageSessionStore();
  if (readBookingIntent(store, mode, commerceStepAfter) !== null) {
    publish();
    return;
  }
  const id = fsmAttemptScope(eventId);
  const session: OpenJourney = { eventId, lastConfirmed: null,
    journey: new CommerceJourney(branch, {
      advanceCommerceJourney: (call) => {
        session.clearIntent = persistBookingIntent(store, {
          mode, eventId, branch, step: call.step, operationId: call.operationId, lastConfirmed: session.lastConfirmed,
        });
        return protocol.advanceCommerceJourney(call);
      },
    }, (step) => {
      const attempt = readDeskAttempt("journey", id) + 1;
      writeDeskAttempt("journey", id, attempt);
      const operationId = `jrn:${id}:${attempt}:${step}`;
      return { operationId, idempotencyKey: `key:${operationId}` };
    }),
  };
  active = session;
  publish();
}

async function send(session: OpenJourney, step: CommerceJourneyStep) {
  if (session.evidenceLost) return;
  const answer = session.journey.run(step);
  publish();
  const outcome = await answer;
  if (outcome && outcome.kind !== "UNKNOWN") {
    try { session.clearIntent?.(); } catch { session.evidenceLost = true; }
    session.clearIntent = undefined;
    if (outcome.kind === "CONFIRMED") session.lastConfirmed = { step, operationId: outcome.operationId };
  }
  publish();
}

export default function CommerceJourneyPanel({ eventId }: { eventId: string }) {
  useSyncExternalStore(subscribe, version, version);
  const { locale } = useLocale();
  const t = copy[locale];
  const session = active?.eventId === eventId ? active : undefined;
  const state = session?.journey.state();
  const stored = active ? null : readBookingIntent(pageSessionStore(), protocol.describe().environment, commerceStepAfter);
  const history = stored && stored !== EVIDENCE_LOST && stored.eventId === eventId ? stored : null;
  const blocked = history && (commerceStepAfter(history.branch, history.lastConfirmed?.step ?? null)?.next ?? history.step);
  const [query, setQuery] = useState<CommerceJourneyNotBound>();
  return (
    <section className="panel" aria-labelledby="commerce-fsm-title">
      <h2 id="commerce-fsm-title">{t.title}</h2>
      <p>{desk[locale]["desk.booking.simulated"]}</p>
      {session && state ? <>
        <dl className="facts" aria-live="polite">
          {Object.entries(state.facts).map(([key, fact]) => <div key={key} data-commerce-fact={key}>
            <dt>{t[key as keyof typeof state.facts]}</dt><dd>{fact.state}</dd>
          </div>)}
        </dl>
        <p>{t.confirmed} <code>{state.confirmed ?? "—"}</code></p>
        <p role="status">
          {session.evidenceLost ? EVIDENCE_LOST : state.pending ? <>{t.pending} <code>{state.pending}</code></> : state.last && state.last.kind !== "CONFIRMED" ? <>
            <strong>{state.last.kind}</strong> · <code>{state.last.code}</code> · <SafeText value={state.last.operationId} />
            {state.last.requestId && <> · <SafeText value={state.last.requestId} /></>}
            {state.fenced && state.next ? <> · {t.blocked} <code>{state.next}</code></> : null}
          </> : null}
        </p>
        <div className="row-actions">
          {[state.next, state.decline].map((step) => step && <ConnectivityWriteButton
            key={step} type="button" data-commerce-step={step} disabled={session.evidenceLost || state.fenced || state.pending !== null} requiresFresh={false}
            onClick={() => void send(session, step)}>{t.steps[step === "settle-resale-capture" || step === "settle-refund-capture" ? "mock-claim" : step]}</ConnectivityWriteButton>)}
        </div>
      </> : history ? <>
        <p>{t[history.branch]} · {t.confirmed} <code>{history.lastConfirmed?.step ?? "—"}</code>
          {history.lastConfirmed && <> · <SafeText value={history.lastConfirmed.operationId} /></>}</p>
        <p role="status"><strong>UNKNOWN</strong> · <code>{history.step}</code> · <SafeText value={history.operationId} /> · {t.blocked} <code>{blocked}</code></p>
      </> : stored === EVIDENCE_LOST ? <p role="status">{stored}</p> :
        active || stored ? <p>{t.openElsewhere}</p> : <div className="row-actions">
        {(["resale", "admission", "refund"] as const).map((branch) =>
          <button key={branch} type="button" data-commerce-branch={branch} onClick={() => open(eventId, branch)}>{t[branch]}</button>)}
      </div>}
      <button type="button" className="ghost" onClick={() => setQuery(commerceJourneyRead("get_booking"))}>{t.read}</button>
      {query && <p role="status"><strong>{query.kind}</strong> · <code>{query.query}</code> · {t.readReason}</p>}
    </section>
  );
}
