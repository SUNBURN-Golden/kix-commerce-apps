import { messages as copy0 } from "../i18n/messages/pages--Organizer";
import { messages as copy1 } from "../i18n/messages/organizer-desk";
import { messages as copy2 } from "../i18n/messages/storage-allow-list";
import { messages as copy3 } from "../i18n/messages/journey-desk";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { useState } from "react";
import {
  ORGANIZER_DEFAULT_ID,
  ORGANIZER_OPERATOR,
  emptyDraft,
  useOrganizerDesk,
  type OrganizerDraft,
} from "../organizer-desk";
import { OrganizerPanel } from "./OrganizerPanel";

export function OrganizerPage() {
  const t = useT(copy0, copy1, copy2, copy3);
  const [eventId, setEventId] = useState("");
  const [draft, setDraft] = useState<OrganizerDraft>(emptyDraft());
  const model = useOrganizerDesk(eventId, draft);
  const created = model.rows.find((row) => row.step === "create_event");
  const createLocked = created !== undefined && created.status !== "ready" && created.status !== "not-started";

  function patch(partial: Partial<OrganizerDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">{t("s165")}</p>
        <h2>{t("s163")}</h2>
        <p className="muted">
          {t("s1j6")}</p>
      </header>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label>
          {t("sis")}<input value={eventId} onChange={(event) => setEventId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          {t("s1ir")}<input
            value={draft.seats}
            disabled={createLocked}
            placeholder={t("sd8")}
            onChange={(event) => patch({ seats: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("soq")}<input
            value={draft.invitationQuota}
            disabled={createLocked}
            inputMode="numeric"
            placeholder={t("sat")}
            onChange={(event) => patch({ invitationQuota: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("son")}<input
            value={draft.inventoryId}
            placeholder={t("sau")}
            onChange={(event) => patch({ inventoryId: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("sk7")}<input
            value={draft.expectedInventoryVersion}
            inputMode="numeric"
            placeholder={t("sas")}
            onChange={(event) => patch({ expectedInventoryVersion: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          {t("s1di")}<input
            value={draft.recipient}
            onChange={(event) => patch({ recipient: event.target.value })}
            autoComplete="off"
          />
        </label>
        <p className="muted">
          {t("s15p")}{" "}{deskText(t, ORGANIZER_OPERATOR)}{t("s161")}{" "}{deskText(t, ORGANIZER_DEFAULT_ID)}{t("s21w")}</p>
      </form>
      <OrganizerPanel model={model} />
    </section>
  );
}
