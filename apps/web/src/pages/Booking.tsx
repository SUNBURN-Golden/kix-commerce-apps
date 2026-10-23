import { formatWhen } from "../format";
import { messages as mergedCopy } from "../i18n/messages/merged-surfaces";
import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--Booking";
import { messages as copy1 } from "../i18n/messages/a11y--present";
import { messages as copy2 } from "../i18n/messages/admission-desk";
import { messages as copy3 } from "../i18n/messages/reservation-desk";
import { messages as copy4 } from "../i18n/messages/storage-allow-list";
import { messages as copy5 } from "../i18n/messages/journey-desk";
import { messages as copy6 } from "../i18n/messages/refund-return";
import { messages as copy7 } from "../i18n/messages/workspace--registry";
import { ConnectivityWriteButton } from "../components/ConnectivityWriteButton";
import { connectedHandler } from "../connectivity/write-guard";
import { ValidatedForm } from "../forms/ValidatedForm";
import { field } from "../forms/validation";
import { AsyncState } from "../components/AsyncState";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProtocolError, type Booking, type Hold, type Performance } from "@kix/protocol-adapter";
import { focusControl, heldAfterError } from "../a11y/focus";
import { AmountNotice, DeadlineLine, StatusMark } from "../a11y/marks";
import { bookingQuantityNumber, capacityLine, presentQuantityLine } from "../a11y/present";
import { useT } from "../i18n/desk-context";
import { useDisplayLocale } from "../i18n/locale-context";
import { protocol } from "../connectivity/desk-protocol";
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

export function BookingPage() {
  const t = useT(mergedCopy, deskCopy, copy0, copy1, copy2, copy3, copy4, copy5, copy6, copy7);
  const clock = useDisplayLocale();
  const { eventId = "" } = useParams();
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [hold, setHold] = useState<Hold | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resolved, setResolved] = useState(false);
  const reservation = useReservationDesk(eventId);
  const admission = useAdmissionDesk(eventId, "gate-main");
  const journey = useJourneyDesk(eventId);
  const refundDesk = useRefundReturnDesk(eventId);

  useEffect(() => {
    let cancelled = false;
    setResolved(false);
    protocol
      .listPerformances()
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setPerformance(rows.find((item) => item.eventId === eventId) ?? null);
        setResolved(true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setPerformance(null);
          setResolved(true);
          setError(reason instanceof Error ? reason.message : deskCopy.en["desk.performance.singleLoadError"]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!error || hold) {
      return;
    }
    focusControl("booking-quantity");
  }, [error, hold]);

  async function refreshPerformance() {
    const rows = await protocol.listPerformances();
    setPerformance(rows.find((item) => item.eventId === eventId) ?? null);
  }

  /**
   * An expired or already-ended hold cannot be confirmed or released again.
   * The form goes back to Place hold and the capacity line is read again.
   */
  async function dropEndedHold(reason: unknown) {
    if (!(reason instanceof ProtocolError) || !isEndedHold(reason.code)) {
      return;
    }
    setHold(null);
    try {
      await refreshPerformance();
    } catch {
      // The hold error stays on the page.
    }
  }

  function keepQuantity(message: string) {
    const held = heldAfterError({ controlId: "booking-quantity", value: quantity, selection: eventId }, true);
    setQuantity(held?.value ?? quantity);
    setError(message);
    focusControl("booking-quantity");
  }

  async function placeHold() {
    if (!connectedHandler()) return;
    const count = bookingQuantityNumber(quantity);
    if (count === null) {
      keepQuantity(deskCopy.en["desk.booking.quantityError"]);
      return;
    }
    setPending(true);
    setError(null);
    try {
      setHold(await protocol.placeHold({ eventId, quantity: count }));
      await refreshPerformance();
    } catch (reason) {
      keepQuantity(reason instanceof Error ? reason.message : deskCopy.en["desk.booking.holdError"]);
    } finally {
      setPending(false);
    }
  }

  async function releaseHold() {
    if (!connectedHandler()) return;
    if (!hold) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await protocol.releaseHold(hold.holdId);
      setHold(null);
      await refreshPerformance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : deskCopy.en["desk.booking.releaseError"]);
      focusControl("booking-release");
      await dropEndedHold(reason);
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!connectedHandler()) return;
    if (!hold) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      setBooking(await protocol.confirmBooking(hold.holdId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : deskCopy.en["desk.booking.confirmError"]);
      focusControl("booking-confirm");
      await dropEndedHold(reason);
    } finally {
      setPending(false);
    }
  }

  if (!performance && !error && !resolved) {
    return (
      <section>
        <AsyncState kind="loading" label={t("merge.booking")}><p>{t("desk.performance.singleLoading")}
        </p></AsyncState>
        <JourneyPanel variant="booking" model={journey} />
        <RefundReturnPanel live={refundDesk} variant="booking" />
      </section>
    );
  }

  if (!performance) {
    return (
      <section>
        <AsyncState kind={error ? "error" : "empty"} label={t("merge.booking")}>
          <p>{error ? deskText(t, error) : t("desk.performance.missing")}</p>
        </AsyncState>
        <p className="muted">
          {t("desk.performance.requested")} <SafeText value={eventId} />
        </p>
        <JourneyPanel variant="booking" model={journey} />
        <RefundReturnPanel live={refundDesk} variant="booking" />
        <Link to="/">{t("desk.performance.back")}</Link>
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
              to={`/admission?rightsRef=${encodeURIComponent(booking.rightsRef)}&eventId=${encodeURIComponent(eventId)}`}
            >
              {t("desk.booking.check")}
            </Link>
            <Link className="ghost button" to={`/resale?bookingId=${encodeURIComponent(booking.bookingId)}`}>
              {t("desk.booking.resale")}
            </Link>
          </div>
        </article>
      ) : (
        <ValidatedForm id="booking-form" busy={pending} fields={[field("booking-quantity", "validation.label.quantity", { kind: "bookingQuantity" })]}
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (hold) {
              void confirm();
            } else {
              void placeHold();
            }
          }}
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
              onChange={(event) => setQuantity(event.target.value)}
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
              <>
                <ConnectivityWriteButton
                  id="booking-release"
                  type="button"
                  className="ghost"
                  disabled={pending}
                  onClick={() => void releaseHold()}
                >
                  {t("desk.booking.release")}
                </ConnectivityWriteButton>
                <ConnectivityWriteButton id="booking-confirm" type="submit" disabled={pending}>
                  {t("desk.booking.confirm")}
                </ConnectivityWriteButton>
              </>
            ) : (
              <ConnectivityWriteButton id="booking-place" type="submit" disabled={pending}>
                {t("desk.booking.place")}
              </ConnectivityWriteButton>
            )}
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

function isEndedHold(code: string | undefined): boolean {
  return code === "HOLD_EXPIRED" || code === "HOLD_NOT_ACTIVE";
}
