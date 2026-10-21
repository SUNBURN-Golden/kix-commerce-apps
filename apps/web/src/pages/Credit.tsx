import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--Credit";
import { messages as copy1 } from "../i18n/messages/credit-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { useEffect, useState } from "react";
import { useT } from "../i18n/desk-context";
import type { Performance } from "@kix/protocol-adapter";
import { useCreditDesk } from "../credit-desk";
import { protocol } from "../protocol";
import { deskText } from "../i18n/desk-translate";
import { CreditPanel } from "./CreditPanel";

export function CreditPage() {
  const t = useT(deskCopy, copy0, copy1, copy2);
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
          setLoadError(reason instanceof Error ? reason.message : deskCopy.en["desk.performance.loadError"]);
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
        <p className="eyebrow">{t("desk.credit.eyebrow")}</p>
        <h2>{t("desk.credit.title")}</h2>
        <p className="muted">{t("desk.credit.note")}</p>
      </header>
      {loadError ? (
        <p className="alert" role="alert">
          {deskText(t, loadError)}
        </p>
      ) : null}
      <div className="panel">
        <label>
          {t("desk.credit.event")}
          <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
            {deskText(t, (performances && performances.length > 0
              ? performances
              : [{ eventId: "evt_lanterns", title: copy0.en["e.6"] }]
            ).map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {deskText(t, item.title)}
              </option>
            )))}
          </select>
        </label>
        <p className="muted">{t("desk.credit.bindNote")}</p>
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
