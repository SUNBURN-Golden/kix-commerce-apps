import { useState, useSyncExternalStore } from "react";
import { CommerceJourney, type CommerceJourneyBranch } from "../../../../packages/protocol-adapter/src/commerce-journey";
import { commerceJourneyRead, type CommerceJourneyNotBound, type CommerceJourneyStep } from "../../../../packages/protocol-adapter/src/commerce-journey-command";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { protocol } from "../connectivity/desk-protocol";
import { readDeskAttempt, writeDeskAttempt } from "../desk-attempts";
import { useLocale } from "../i18n/locale-context";
import { messages as desk } from "../i18n/desk-catalogue";
import { messages as copy } from "../i18n/messages/pages--CommerceJourneyPanel";
import { SafeText } from "../safe-text";

let active: { eventId: string; journey: CommerceJourney } | undefined;
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
  if (active) return;
  const id = `fsm:${eventId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}`;
  active = { eventId, journey: new CommerceJourney(branch, protocol, (step) => {
    const attempt = readDeskAttempt("journey", id) + 1;
    writeDeskAttempt("journey", id, attempt);
    const operationId = `jrn:${id}:${attempt}:${step}`;
    return { operationId, idempotencyKey: `key:${operationId}` };
  }) };
  publish();
}

async function send(journey: CommerceJourney, step: CommerceJourneyStep) {
  const answer = journey.run(step);
  publish();
  await answer;
  publish();
}

export default function CommerceJourneyPanel({ eventId }: { eventId: string }) {
  useSyncExternalStore(subscribe, version, version);
  const { locale } = useLocale();
  const t = copy[locale];
  const journey = active?.eventId === eventId ? active.journey : undefined;
  const state = journey?.state();
  const [query, setQuery] = useState<CommerceJourneyNotBound>();
  return (
    <section className="panel" aria-labelledby="commerce-fsm-title">
      <h2 id="commerce-fsm-title">{t.title}</h2>
      <p>{desk[locale]["desk.booking.simulated"]}</p>
      {journey && state ? <>
        <dl className="facts" aria-live="polite">
          {Object.entries(state.facts).map(([key, fact]) => <div key={key} data-commerce-fact={key}>
            <dt>{t[key as keyof typeof state.facts]}</dt><dd>{fact.state}</dd>
          </div>)}
        </dl>
        <p>{t.confirmed} <code>{state.confirmed ?? "—"}</code></p>
        <p role="status">
          {state.pending ? <>{t.pending} <code>{state.pending}</code></> : state.last && state.last.kind !== "CONFIRMED" ? <>
            <strong>{state.last.kind}</strong> · <code>{state.last.code}</code> · <SafeText value={state.last.operationId} />
            {state.last.requestId && <> · <SafeText value={state.last.requestId} /></>}
            {state.fenced && state.next ? <> · {t.blocked} <code>{state.next}</code></> : null}
          </> : null}
        </p>
        <div className="row-actions">
          {[state.next, state.decline].map((step) => step && <ConnectivityWriteButton
            key={step} type="button" data-commerce-step={step} disabled={state.fenced || state.pending !== null} requiresFresh={false}
            onClick={() => void send(journey, step)}>{t.steps[step === "settle-resale-capture" || step === "settle-refund-capture" ? "mock-claim" : step]}</ConnectivityWriteButton>)}
        </div>
      </> : active ? <p>{t.openElsewhere}</p> : <div className="row-actions">
        {(["resale", "admission", "refund"] as const).map((branch) =>
          <button key={branch} type="button" data-commerce-branch={branch} onClick={() => open(eventId, branch)}>{t[branch]}</button>)}
      </div>}
      <button type="button" className="ghost" onClick={() => setQuery(commerceJourneyRead("get_booking"))}>{t.read}</button>
      {query && <p role="status"><strong>{query.kind}</strong> · <code>{query.query}</code> · {t.readReason}</p>}
    </section>
  );
}
