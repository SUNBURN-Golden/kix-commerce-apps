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
import { useFormatWhen } from "../i18n/locale-context";
import { protocol } from "../connectivity/desk-protocol";
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
  const formatWhen = useFormatWhen();
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
          setError(reason instanceof Error ? reason.message : "Could not load the performance.");
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
      keepQuantity("Quantity must be a whole number from 1 to 6. The typed value was kept.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setHold(await protocol.placeHold({ eventId, quantity: count }));
      await refreshPerformance();
    } catch (reason) {
      keepQuantity(reason instanceof Error ? reason.message : "Could not place the hold.");
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
      setError(reason instanceof Error ? reason.message : "Could not release the hold.");
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
      setError(reason instanceof Error ? reason.message : "Could not confirm the booking.");
      focusControl("booking-confirm");
      await dropEndedHold(reason);
    } finally {
      setPending(false);
    }
  }

  if (!performance && !error && !resolved) {
    return (
      <section>
        <AsyncState kind="loading" label="Booking"><p>Loading the performance.</p></AsyncState>
        <JourneyPanel variant="booking" model={journey} />
        <RefundReturnPanel live={refundDesk} variant="booking" />
      </section>
    );
  }

  if (!performance) {
    return (
      <section>
        <AsyncState kind={error ? "error" : "empty"} label="Booking">
          <p>{error ?? "That performance is not on this adapter."}</p>
        </AsyncState>
        <p className="muted">
          Requested performance: <SafeText value={eventId} />
        </p>
        <JourneyPanel variant="booking" model={journey} />
        <RefundReturnPanel live={refundDesk} variant="booking" />
        <Link to="/">Back to the window</Link>
      </section>
    );
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Booking · B01–B05 · mock FSM phase · rights issued as a reference</p>
        <h2>{performance.title}</h2>
        <p className="muted">
          {performance.venue} · <time dateTime={performance.startsAt}>{formatWhen(performance.startsAt)}</time> ·{" "}
          {capacityLine(performance.remainingCapacity)}
        </p>
        <AmountNotice />
        <p className="muted">
          The hold form is the Wave 4 pointer. The reservation case is a simulated mock phase. Not live admission.
          B01–B05 stay 설계중.
        </p>
      </header>
      {pending ? (
        <p className="muted" role="status">
          <StatusMark kind="loading" /> One attempt. No retry.
        </p>
      ) : null}
      {error ? (
        <AsyncState id="booking-error" kind="error" label="Booking"><p>{error}</p></AsyncState>
      ) : null}
      {booking ? (
        <article className="ticket">
          <p className="eyebrow">Confirmed in the adapter</p>
          <h3>{performance.title}</h3>
          <dl>
            <div>
              <dt>Booking</dt>
              <dd>{booking.bookingId}</dd>
            </div>
            <div>
              <dt>Right</dt>
              <dd>{booking.rightsRef}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{presentQuantityLine(booking.quantity)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>Simulated — no funds</dd>
            </div>
          </dl>
          <p className="muted">Surfaces: {booking.surfaces.join(", ")}</p>
          <div className="row-actions">
            <Link
              className="button"
              to={`/admission?rightsRef=${encodeURIComponent(booking.rightsRef)}&eventId=${encodeURIComponent(eventId)}`}
            >
              Check admission
            </Link>
            <Link className="ghost button" to={`/resale?bookingId=${encodeURIComponent(booking.bookingId)}`}>
              List for resale
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
            Quantity
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
              Hold <strong>{hold.holdId}</strong> until <DeadlineLine expiresAt={hold.expiresAt} expired={null} />. Surface{" "}
              {hold.surface}. Quantity {presentQuantityLine(hold.quantity)}.
            </p>
          ) : (
            <p className="muted">A hold reserves capacity in the adapter. Confirming does not take payment.</p>
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
                  Release hold
                </ConnectivityWriteButton>
                <ConnectivityWriteButton id="booking-confirm" type="submit" disabled={pending}>
                  Confirm booking
                </ConnectivityWriteButton>
              </>
            ) : (
              <ConnectivityWriteButton id="booking-place" type="submit" disabled={pending}>
                Place hold
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
        title={performance.title}
        presentation={admission.presentation}
        error={admission.error}
        pending={admission.pending}
        commands={false}
      />
      <RefundReturnPanel live={refundDesk} variant="booking" />
      <p>
        <Link to={`/admission?eventId=${encodeURIComponent(eventId)}`}>Mock admission phase</Link>
      </p>
    </section>
  );
}

function isEndedHold(code: string | undefined): boolean {
  return code === "HOLD_EXPIRED" || code === "HOLD_NOT_ACTIVE";
}
