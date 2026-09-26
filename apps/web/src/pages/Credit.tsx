import { useEffect, useState } from "react";
import type { Performance } from "@kix/protocol-adapter";
import { useCreditDesk } from "../credit-desk";
import { protocol } from "../protocol";
import { CreditPanel } from "./CreditPanel";

export function CreditPage() {
  const [eventId, setEventId] = useState("evt_lanterns");
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const credit = useCreditDesk(eventId);

  useEffect(() => {
    let cancelled = false;
    protocol
      .listPerformances()
      .then((rows) => {
        if (!cancelled) {
          setPerformances(rows);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(reason instanceof Error ? reason.message : "Could not load performances.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const title = performances?.find((item) => item.eventId === eventId)?.title ?? eventId;

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Credit · F04 · exposure is simulated</p>
        <h2>Mock credit case</h2>
        <p className="muted">
          The case below is a mock phase on the adapter stub. Not live credit. It does not disburse to a bank and it
          does not change a booking or a resale holder.
        </p>
      </header>
      {loadError ? (
        <p className="alert" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="panel">
        <label>
          Mock case event
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            {(performances && performances.length > 0
              ? performances
              : [{ eventId: "evt_lanterns", title: "North Station Lanterns" }]
            ).map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Bind uses the box-office mock settlement id for this event. A committed mock phase is an observation. It is
          not live funds. Amounts on the case are mock units.
        </p>
      </div>
      <CreditPanel
        eventTitle={title}
        view={credit.view}
        error={credit.error}
        pending={credit.pending}
        onCommand={(command) => void credit.run(command)}
      />
    </section>
  );
}
