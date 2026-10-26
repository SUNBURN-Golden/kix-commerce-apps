import { formatWhen } from "../format";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/a11y--present";
import { messages as copy1 } from "../i18n/messages/journey-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { messages as copy3 } from "../i18n/messages/refund-return";
import { messages as copy4 } from "../i18n/messages/workspace--registry";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProtocolError, type Performance, type SettlementCaseView } from "../../../../packages/protocol-adapter/src/types";
import { capacityLine } from "../a11y/present";
import { StatusMark } from "../a11y/marks";
import { useT } from "../i18n/desk-context";
import { useDisplayLocale } from "../i18n/locale-context";
import { protocol } from "../connectivity/desk-protocol";
import { deskText } from "../i18n/desk-translate";
import { useJourneyDesk } from "../journey-desk";
import { useRefundReturnDesk } from "../refund-return";
import { runSettlementCommand, settlementIdFor } from "../settlement-desk";
import { JourneyPanel } from "./JourneyPanel";
import { RefundReturnPanel } from "./RefundReturnPanel";
import { SettlementPanel, type SettlementDeskCommand } from "./SettlementPanel";

export function BoxOfficePage() {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3, copy4);
  const clock = useDisplayLocale();
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<SettlementCaseView | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const journey = useJourneyDesk("");
  const refundDesk = useRefundReturnDesk(selectedEventId ?? "");

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
          setLoadError(reason instanceof Error ? reason.message : deskCopy.en["desk.performance.loadError"]);
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
      setSettlementError(message(reason, deskCopy.en["desk.boxOffice.readError"]));
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
      setSettlementError(message(reason, deskCopy.en["desk.boxOffice.commandError"]));
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
        <p className="eyebrow">{t("desk.boxOffice.eyebrow")}</p>
        <h2>{t("desk.boxOffice.title")}</h2>
        <p className="muted">{t("desk.boxOffice.note")}</p>
      </header>
      <JourneyPanel variant="box-office" model={journey} />
      {loadError ? (
        <p className="alert" role="alert">
          <StatusMark kind="blocked" /> {deskText(t, loadError)}
        </p>
      ) : null}
      {performances === null ? (
        <p className="muted" role="status">
          <StatusMark kind="loading" /> {t("desk.performance.loading")}
        </p>
      ) : null}
      {performances?.length === 0 ? <p className="empty">{t("desk.performance.empty")}</p> : null}
      <ul className="program">
        {deskText(t, performances?.map((item) => (
          <li key={item.eventId}>
            <article className="row">
              <div>
                <p className="when">
                  <time dateTime={item.startsAt}>{formatWhen(item.startsAt, clock)}</time>
                </p>
                <h3>{deskText(t, item.title)}</h3>
                <p className="muted">
                  {deskText(t, item.venue)} · {deskText(t, capacityLine(item.remainingCapacity))}
                </p>
              </div>
              <div className="row-actions">
                <button type="button" className="ghost" onClick={() => void openSettlement(item.eventId)}>
                  {t("desk.boxOffice.settlement")}
                </button>
                <Link className="button" to={`/booking/${item.eventId}`}>
                  {t("desk.boxOffice.book")}
                </Link>
              </div>
            </article>
          </li>
        )))}
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
      {selectedEventId ? <RefundReturnPanel live={refundDesk} variant="settlement" /> : null}
    </section>
  );
}

function message(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
