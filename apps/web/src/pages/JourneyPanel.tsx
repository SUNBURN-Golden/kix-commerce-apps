import { useEffect, useId, useRef, useState } from "react";
import {
  composePrimarySeatJourney, createJourneyDemoCaller, journeyDemoInput,
  JOURNEY_COMPOSED_ACTIONS, JOURNEY_DEMO_SCENARIOS, JOURNEY_UNCOMPOSED,
  OPENAPI_INTEGRATION_GATE_PIN,
  type JourneyDemoScenario, type PrimarySeatJourneyResult,
} from "@kix/protocol-adapter";

const scenarios: Record<JourneyDemoScenario, string> = {
  success: "Accepted prefix", "response-loss": "Response lost after prepare",
  rejected: "Prepare rejected", stale: "Stale response", malformed: "Malformed receipt",
};

export function JourneyReceipts({ result }: { result: PrimarySeatJourneyResult | null }) {
  return <>
    <ol className="journey-steps">
      {JOURNEY_COMPOSED_ACTIONS.map((action) => {
        const step = result?.composed.find((item) => item.action === action);
        const fence = result?.fence?.action === action ? result.fence : null;
        return <li key={action}>
          <strong>{action}</strong> — {step ? "Confirmed in simulation" : fence ? fence.outcome : "Not attempted"}
          {step ? <details><summary>Receipt · {step.operationId}</summary>
            <pre>{JSON.stringify(step.receipt, null, 2)}</pre></details> : null}
          {fence ? <p className="alert">{fence.code} · Request {fence.operationId}.
            {fence.outcome === "REJECTED" ? " Explicit rejection; later writes blocked." : " Outcome unconfirmed; later writes blocked. No retry or replacement request."}
          </p> : null}
        </li>;
      })}
    </ol>
    <p role="status">{result?.fence
      ? `Last confirmed step: ${result.composed.at(-1)?.action ?? "none"}. The journey is stopped.`
      : result ? "Supported prefix accepted. Payment, issuance and admission remain unavailable."
      : "No journey has been run. Choose a scenario to inspect synthetic receipts."}</p>
  </>;
}

export function JourneyPanel({ eventId, environment }: { eventId: string; environment: "stub" | "integration-http" }) {
  const [scenario, setScenario] = useState<JourneyDemoScenario>("success");
  const [result, setResult] = useState<PrimarySeatJourneyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const generation = useRef(0);
  const titleId = useId();
  useEffect(() => () => { generation.current += 1; }, []);

  async function run() {
    if (running.current || environment !== "stub" || !eventId.trim()) return;
    running.current = true;
    const current = ++generation.current;
    setPending(true); setError(null); setResult(null);
    try {
      const { caller } = createJourneyDemoCaller(scenario);
      const next = await composePrimarySeatJourney(caller, journeyDemoInput(eventId));
      if (current === generation.current) setResult(next);
    } catch {
      if (current === generation.current) setError("Simulation unavailable. No completion was confirmed.");
    } finally {
      if (current === generation.current) { running.current = false; setPending(false); }
    }
  }

  return <section className="panel journey-panel" aria-labelledby={titleId}>
    <p className="eyebrow">Wave 6-A · synthetic catalogue journey</p>
    <h3 id={titleId}>Inspect the booking journey</h3>
    <p>Scripted receipts for {eventId || "no selected event"}. This simulation does not book a seat,
      charge a payment, issue a ticket or admit anyone. It is separate from the desk reservation below.</p>
    {environment !== "stub" ? <p className="alert" role="status">
      Browser HTTP journey unavailable. The gate refuses cross-origin calls. No request is sent and no stub fallback is selected.
    </p> : <>
      <label>Simulation scenario
        <select value={scenario} disabled={pending} onChange={(event) => {
          setScenario(event.target.value as JourneyDemoScenario); setResult(null); setError(null);
        }}>
          {JOURNEY_DEMO_SCENARIOS.map((key) => <option key={key} value={key}>{scenarios[key]}</option>)}
        </select>
      </label>
      <button type="button" disabled={pending || !eventId.trim()} onClick={() => void run()}>
        {pending ? "Inspecting simulation…" : "Run selected simulation"}
      </button>
      <p className="muted">Each run is a new isolated fixture, never recovery or retry of an unconfirmed request.
        Reloading discards the simulation; it does not resolve an unknown outcome.</p>
      {error ? <p role="alert">{error}</p> : null}
      {pending ? <p role="status">Awaiting simulation receipts. No completion confirmed.</p> : <JourneyReceipts result={result} />}
    </>}
    <details><summary>Unconnected steps and source</summary>
      <ul>{JOURNEY_UNCOMPOSED.map((step) => <li key={step.action}><strong>{step.action}</strong>: {step.reason}</li>)}</ul>
      <p>Reviewed gate source: <code>{OPENAPI_INTEGRATION_GATE_PIN.protocolMergeSha}</code>.
        Fixture receipts are illustrative, not gate evidence. No payment or admission completion is implied.</p>
    </details>
  </section>;
}
