import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdmissionDecision } from "@kix/protocol-adapter";
import { protocol } from "../protocol";

export function AdmissionPage() {
  const [params] = useSearchParams();
  const [rightsRef, setRightsRef] = useState(params.get("rightsRef") ?? "");
  const [gateId, setGateId] = useState("gate-main");
  const [decision, setDecision] = useState<AdmissionDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setDecision(null);
    try {
      if (!rightsRef.trim()) {
        throw new Error("Enter a right reference.");
      }
      setDecision(await protocol.checkAdmission({ rightsRef, gateId }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admission check failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Admission · P03 · zk_gate referenced, not evaluated on chain</p>
        <h2>Gate check</h2>
      </header>
      <form className="panel" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Right reference
          <input value={rightsRef} onChange={(event) => setRightsRef(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Gate
          <input value={gateId} onChange={(event) => setGateId(event.target.value)} autoComplete="off" />
        </label>
        <button type="submit" disabled={pending}>
          Check admission
        </button>
      </form>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {decision ? (
        <article className={decision.admitted ? "stamp ok" : "stamp deny"} aria-live="polite">
          <p className="stamp-word">{decision.admitted ? "Admit" : "Deny"}</p>
          <p>{decision.detail}</p>
          <p className="muted">
            {decision.surface} · {decision.zkSurface} · {decision.proofMode} · gate {decision.gateId || "—"}
          </p>
        </article>
      ) : null}
    </section>
  );
}
