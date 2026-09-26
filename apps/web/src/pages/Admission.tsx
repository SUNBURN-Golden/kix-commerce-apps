import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdmissionDesk } from "../admission-desk";
import { useReservationDesk } from "../reservation-desk";
import { AdmissionCredentialPanel } from "./AdmissionCredentialPanel";
import { ReservationPanel } from "./ReservationPanel";

export function AdmissionPage() {
  const [params] = useSearchParams();
  const [gateId, setGateId] = useState("gate-main");
  const [eventId, setEventId] = useState(params.get("eventId") ?? "");
  const reservation = useReservationDesk(eventId);
  const admission = useAdmissionDesk(eventId, gateId);

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Admission · P03 · mock credential · zk_gate referenced, not evaluated on chain</p>
        <h2>Mock admission credential</h2>
        <p className="muted">
          The credential state is the adapter label. Not live admission. Not venue production. P03 stays 설계중.
          Loopback HTTP is a transport boundary.
        </p>
      </header>
      <form
        className="panel"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
        }}
      >
        <label>
          Gate argument
          <input value={gateId} onChange={(event) => setGateId(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">The gate string is an adapter argument. This form does not admit.</p>
        {params.get("rightsRef") ? (
          <p className="muted">Linked right reference {params.get("rightsRef")}. The credential label uses the performance case.</p>
        ) : null}
      </form>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          setEventId(eventId.trim());
        }}
      >
        <label>
          Performance id
          <input value={eventId} onChange={(event) => setEventId(event.target.value)} autoComplete="off" />
        </label>
        <button type="submit">Load mock case</button>
      </form>
      <AdmissionCredentialPanel
        title={eventId.trim() || "No performance selected"}
        presentation={admission.presentation}
        error={admission.error}
        pending={admission.pending}
        commands
        onCommand={(command) => void admission.run(command)}
      />
      <ReservationPanel
        variant="admission"
        eventTitle={eventId.trim() || "No performance selected"}
        view={reservation.view}
        showRegistered={reservation.showRegistered}
        eventReady={eventId.trim().length > 0}
        error={reservation.error}
        pending={reservation.pending}
        onCommand={(command) => void reservation.run(command)}
      />
    </section>
  );
}
