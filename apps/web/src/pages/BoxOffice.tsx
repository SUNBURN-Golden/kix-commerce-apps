import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProtocolError, type Performance, type SettlementCaseView } from "@kix/protocol-adapter";
import { formatWhen } from "../format";
import { protocol } from "../protocol";
import { runSettlementCommand, settlementIdFor } from "../settlement-desk";
import { SettlementPanel, type SettlementDeskCommand } from "./SettlementPanel";

export function BoxOfficePage() {
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementCaseView | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  const selected = performances?.find((item) => item.eventId === selectedEventId) ?? null;

  async function refreshCase(eventId: string) {
    try {
      setSettlement(await protocol.viewSettlement(settlementIdFor(eventId)));
    } catch (reason) {
      if (reason instanceof ProtocolError && reason.code === "UNKNOWN_SETTLEMENT") {
        setSettlement(null);
        return;
      }
      throw reason;
    }
  }

  async function openSettlement(eventId: string) {
    setSelectedEventId(eventId);
    setSettlementError(null);
    setPending(true);
    try {
      await refreshCase(eventId);
    } catch (reason) {
      setSettlement(null);
      setSettlementError(message(reason, "Could not read the mock settlement case."));
    } finally {
      setPending(false);
    }
  }

  async function onCommand(command: SettlementDeskCommand) {
    if (!selectedEventId || pending) {
      return;
    }
    const eventId = selectedEventId;
    setPending(true);
    setSettlementError(null);
    try {
      await runSettlementCommand(protocol, command, eventId);
      await refreshCase(eventId);
    } catch (reason) {
      setSettlementError(message(reason, "Mock settlement command was rejected."));
      try {
        await refreshCase(eventId);
      } catch {
        // The command error stays on the panel.
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Wave 4 catalog · Wave 2 rights issued at booking</p>
        <h2>Tonight’s window</h2>
        <p className="muted">
          Booking and admission can open a simulated reservation phase on the adapter stub. Not live admission.
        </p>
      </header>
      {loadError ? (
        <p className="alert" role="alert">
          {loadError}
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
                <button type="button" className="ghost" onClick={() => void openSettlement(item.eventId)}>
                  Mock settlement
                </button>
                <Link className="button" to={`/booking/${item.eventId}`}>
                  Book
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {selectedEventId ? (
        <SettlementPanel
          eventTitle={selected?.title ?? selectedEventId}
          view={settlement}
          error={settlementError}
          pending={pending}
          onCommand={(command) => void onCommand(command)}
          onClose={() => {
            setSelectedEventId(null);
            setSettlement(null);
            setSettlementError(null);
          }}
        />
      ) : null}
    </section>
  );
}

function message(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
