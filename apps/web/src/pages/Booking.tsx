import { formatWhen } from "../format";
import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy1 } from "../i18n/messages/a11y--present";
import { messages as copy2 } from "../i18n/messages/admission-desk";
import { messages as copy3 } from "../i18n/messages/reservation-desk";
import { messages as copy4 } from "../i18n/messages/storage-allow-list";
import { messages as copy5 } from "../i18n/messages/journey-desk";
import { messages as copy6 } from "../i18n/messages/refund-return";
import { messages as copy7 } from "../i18n/messages/workspace--registry";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { bookingContextStore, useBookingContext, type BookingContextStore } from "../booking-context";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { AsyncState } from "../components/AsyncState";
import { Link, useParams } from "react-router-dom";
import { AmountNotice, DeadlineLine, StatusMark } from "../a11y/marks";
import { capacityLine, presentQuantityLine } from "../a11y/present";
import { useT } from "../i18n/desk-context";
import { useDisplayLocale } from "../i18n/locale-context";
import { deskText } from "../i18n/desk-translate";
import { SafeText } from "../safe-text";
import { useAdmissionDesk } from "../admission-desk";
import { useJourneyDesk } from "../journey-desk";
import { useRefundReturnDesk } from "../refund-return";
import { useReservationDesk } from "../reservation-desk";
import { AdmissionCredentialPanel } from "./AdmissionCredentialPanel";
import { JourneyPanel } from "./JourneyPanel";
import { RefundReturnPanel } from "./RefundReturnPanel";
import { ReservationPanel } from "./ReservationPanel";

export function BookingPage({ store = bookingContextStore }: { store?: BookingContextStore }) {
  const { eventId = "" } = useParams();
  return <BookingEventPage key={eventId} eventId={eventId} store={store} />;
}

function BookingEventPage({ eventId, store }: { eventId: string; store: BookingContextStore }) {
  const t = useT(mergedCopy, deskCopy, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const clock = useDisplayLocale();
  const { performance, quantity, hold, booking, writeError: error, readError, readState, pending: operation, blocked } = useBookingContext(eventId, store);
  const pending = Boolean(operation) || blocked;
  const reservation = useReservationDesk(eventId);
  const admission = useAdmissionDesk(eventId, "gate-main");
  const journey = useJourneyDesk(eventId);
  const refundDesk = useRefundReturnDesk(eventId);

  if (!performance) {
    const loading = readState === "idle" || readState === "loading";
    return (
      <section>
        <AsyncState kind={loading ? "loading" : readError ? "error" : "empty"} label={t("merge.booking")}>
          <p>{loading ? t("desk.performance.singleLoading") : readError ? deskText(t, readError) : t("desk.performance.missing")}</p>
        </AsyncState>
        {loading ? null : <p className="muted">{t("desk.performance.requested")} <SafeText value={eventId} /></p>}
        <JourneyPanel variant="booking" model={journey} />
        <RefundReturnPanel live={refundDesk} variant="booking" />
        {loading ? null : <Link to="/">{t("desk.performance.back")}</Link>}
      </section>
    );
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">{t("desk.booking.eyebrow")}</p>
        <h2>{deskText(t, performance.title)}</h2>
        <p className="muted">
          {deskText(t, performance.venue)} · <time dateTime={performance.startsAt}>{deskText(t, formatWhen(performance.startsAt, clock))}</time> ·{" "}
          {deskText(t, capacityLine(performance.remainingCapacity))}
        </p>
        <AmountNotice />
        <p className="muted">{t("desk.booking.note")}</p>
      </header>
      {pending ? (
        <p className="muted" role="status">
          <StatusMark kind="loading" /> {t("desk.booking.oneAttempt")}</p>
      ) : null}
      {readError ? <AsyncState kind="error" label={t("merge.booking")}><p>{deskText(t, readError)}</p></AsyncState> : null}
      {error ? (
        <AsyncState id="booking-error" kind="error" label={t("merge.booking")}><p>{deskText(t, error)}</p></AsyncState>
      ) : null}
      {booking ? (
        <article className="ticket">
          <p className="eyebrow">{t("desk.booking.confirmed")}</p>
          <h3>{deskText(t, performance.title)}</h3>
          <dl>
            <div>
              <dt>{t("desk.booking.label")}</dt>
              <dd>{booking.bookingId}</dd>
            </div>
            <div>
              <dt>{t("desk.booking.right")}</dt>
              <dd>{booking.rightsRef}</dd>
            </div>
            <div>
              <dt>{t("desk.booking.quantity")}</dt>
              <dd>{deskText(t, presentQuantityLine(booking.quantity))}</dd>
            </div>
            <div>
              <dt>{t("desk.booking.payment")}</dt>
              <dd>{t("desk.booking.simulated")}</dd>
            </div>
          </dl>
          <p className="muted">{t("desk.booking.surfaces")} {deskText(t, booking.surfaces.join(", "))}</p>
          <div className="row-actions">
            <Link
              className="button"
              to={`/admission?rightsRef=${encodeURIComponent(booking.rightsRef)}&eventId=${encodeURIComponent(booking.eventId)}`}
            >
              {t("desk.booking.check")}
            </Link>
            <Link className="ghost button" to={`/resale?bookingId=${encodeURIComponent(booking.bookingId)}`}>
              {t("desk.booking.resale")}
            </Link>
          </div>
        </article>
      ) : (
        <ValidatedForm key={eventId} id="booking-form" busy={pending} fields={[field("booking-quantity", "validation.label.quantity", { kind: "bookingQuantity" })]}
          className="panel"
          onSubmit={() => { void (hold ? store.confirm(eventId) : store.placeHold(eventId)); }}
        >
          <label htmlFor="booking-quantity">
            {t("desk.booking.quantity")}
            <input
              id="booking-quantity"
              inputMode="numeric"
              autoComplete="off"
              value={quantity}
              disabled={Boolean(hold) || pending}
              aria-invalid={error !== null}
              aria-describedby={error ? "booking-error" : undefined}
              onChange={(event) => store.setQuantity(eventId, event.target.value)}
            />
          </label>
          {hold ? (
            <p>
              {t("desk.booking.hold")} <strong>{deskText(t, hold.holdId)}</strong> {t("desk.booking.until")} <DeadlineLine expiresAt={hold.expiresAt} expired={null} />{t("desk.booking.surface")}{" "}
              {deskText(t, hold.surface)}{t("desk.booking.quantitySuffix")} {deskText(t, presentQuantityLine(hold.quantity))}.
            </p>
          ) : (
            <p className="muted">{t("desk.booking.holdNote")}</p>
          )}
          <div className="row-actions">
            {hold ? (
              <ConnectivityWriteButton id="booking-release" type="button" className="ghost" disabled={pending}
                onClick={() => void store.releaseHold(eventId)}>{t("desk.booking.release")}</ConnectivityWriteButton>
            ) : null}
            <ConnectivityWriteButton id={hold ? "booking-confirm" : "booking-place"} type="submit" disabled={pending}>
              {t(hold ? "desk.booking.confirm" : "desk.booking.place")}
            </ConnectivityWriteButton>
          </div>
        </ValidatedForm>
      )}
      <JourneyPanel variant="booking" model={journey} />
      <ReservationPanel
        variant="booking"
        eventTitle={performance.title}
        view={reservation.view}
        showRegistered={reservation.showRegistered}
        eventReady={eventId.trim().length > 0}
        error={reservation.error}
        pending={reservation.pending}
        onCommand={(command) => void reservation.run(command)}
      />
      <AdmissionCredentialPanel
        title={deskText(t, performance.title)}
        presentation={admission.presentation}
        error={admission.error}
        pending={admission.pending}
        commands={false}
      />
      <RefundReturnPanel live={refundDesk} variant="booking" />
      <p>
        <Link to={`/admission?eventId=${encodeURIComponent(eventId)}`}>{t("desk.booking.admission")}</Link>
      </p>
    </section>
  );
}
