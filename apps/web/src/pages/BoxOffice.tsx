import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Performance, SettlementPreview } from "@kix/protocol-adapter";
import { formatWhen } from "../format";
import { protocol } from "../protocol";

export function BoxOfficePage() {
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);

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
          setError(reason instanceof Error ? reason.message : "Could not load performances.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function showSettlement(eventId: string) {
    setError(null);
    try {
      setPreview(await protocol.settlementPreview(eventId));
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "Could not load the settlement pointer.");
    }
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Wave 4 catalog · Wave 2 rights issued at booking</p>
        <h2>Tonight’s window</h2>
      </header>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {performances === null ? <p className="muted">Loading performances.</p> : null}
      {performances?.length === 0 ? <p className="empty">No performances on this adapter.</p> : null}
      <ul className="program">
        {performances?.map((item) => (
          <li key={item.eventId}>
            <article className="row">
              <div>
                <p className="when">{formatWhen(item.startsAt)}</p>
                <h3>{item.title}</h3>
                <p className="muted">
                  {item.venue} · {item.remainingCapacity} still open
                </p>
              </div>
              <div className="row-actions">
                <button type="button" className="ghost" onClick={() => showSettlement(item.eventId)}>
                  Settlement pointer
                </button>
                <Link className="button" to={`/booking/${item.eventId}`}>
                  Book
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {preview ? (
        <aside className="panel" aria-label="Settlement preview">
          <p className="eyebrow">{preview.surface}</p>
          <h3>Mock settlement reference</h3>
          <p>{preview.note}</p>
          <p className="codes">{preview.references.join(" · ")}</p>
          <p className="muted">Event {preview.eventId}. Mode {preview.mode}.</p>
        </aside>
      ) : null}
    </section>
  );
}
