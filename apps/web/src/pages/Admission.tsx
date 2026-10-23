import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--Admission";
import { messages as copy1 } from "../i18n/messages/admission-desk";
import { messages as copy2 } from "../i18n/messages/reservation-desk";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import type { ValidationHandle } from "../forms/useFormValidation";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { useRef, useState, type FormEvent } from "react";
import { useT } from "../i18n/desk-context";
import { useSearchParams } from "react-router-dom";
import { useAdmissionDesk } from "../admission-desk";
import { useReservationDesk } from "../reservation-desk";
import { AdmissionCredentialPanel } from "./AdmissionCredentialPanel";
import { SafeText } from "../safe-text";
import { ReservationPanel } from "./ReservationPanel";

export function AdmissionPage() {
  const gateValidation = useRef<ValidationHandle>(null);
  const eventValidation = useRef<ValidationHandle>(null);
  const t = useT(deskCopy, copy0, copy1, copy2, copy3);
  const [params] = useSearchParams();
  const [gateId, setGateId] = useState("gate-main");
  const [eventId, setEventId] = useState(params.get("eventId") ?? "");
  const reservation = useReservationDesk(eventId);
  const admission = useAdmissionDesk(eventId, gateId);

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">{t("desk.admission.eyebrow")}</p>
        <h2>{t("desk.admission.title")}</h2>
        <p className="muted">{t("desk.admission.note")}</p>
      </header>
      <ValidatedForm id="admission-gate-form" validationRef={gateValidation} fields={[field("admission-gate", "validation.label.gate")]} className="panel" onSubmit={(event: FormEvent) => event.preventDefault()}>
        <label>
          {t("desk.admission.gate")}
          <input id="admission-gate" value={gateId} onChange={(event) => setGateId(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">{t("desk.admission.gateNote")}</p>
        {params.get("rightsRef") ? (
          <p className="muted">
            {t("desk.admission.linked")} <SafeText value={params.get("rightsRef")} />{t("desk.admission.linkedNote")}
          </p>
        ) : null}
      </ValidatedForm>
      <ValidatedForm id="admission-event-form" validationRef={eventValidation} fields={[field("admission-event", "validation.label.eventId")]} className="panel" onSubmit={(event) => {
        event.preventDefault();
        setEventId(eventId.trim());
      }}>
        <label>
          {t("desk.performance.id")}
          <input id="admission-event" value={eventId} onChange={(event) => setEventId(event.target.value)} autoComplete="off" />
        </label>
        <button type="submit">{t("desk.performance.loadCase")}</button>
      </ValidatedForm>
      <AdmissionCredentialPanel
        title={eventId.trim() || t("desk.performance.none")}
        presentation={admission.presentation}
        error={admission.error}
        pending={admission.pending}
        commands
        onCommand={(command) => { if (gateValidation.current?.validate() && eventValidation.current?.validate()) void admission.run(command); }}
      />
      <ReservationPanel
        variant="admission"
        eventTitle={eventId.trim() || t("desk.performance.none")}
        view={reservation.view}
        showRegistered={reservation.showRegistered}
        eventReady={eventId.trim().length > 0}
        error={reservation.error}
        pending={reservation.pending}
        onCommand={(command) => { if (eventValidation.current?.validate()) void reservation.run(command); }}
      />
    </section>
  );
}
