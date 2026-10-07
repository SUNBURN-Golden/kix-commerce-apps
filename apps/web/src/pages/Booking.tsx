import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProtocolError, type Booking, type Hold, type Performance } from "@kix/protocol-adapter";
import { formatWhen } from "../format";
import { protocol } from "../protocol";
import { useAdmissionDesk } from "../admission-desk";
import { useReservationDesk } from "../reservation-desk";
import { AdmissionCredentialPanel } from "./AdmissionCredentialPanel";
import { ReservationPanel } from "./ReservationPanel";

import { JourneyPanel } from "./JourneyPanel";

export function BookingPage() {
  const { eventId = "" } = useParams();
  return <BookingForEvent key={eventId} eventId={eventId} />;
}

function BookingForEvent({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [hold, setHold] = useState<Hold | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reservation = useReservationDesk(eventId);
  const admission = useAdmissionDesk(eventId, "gate-main");

  useEffect(() => {
    let cancelled = false;
    protocol
      .listPerformances()
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setPerformance(rows.find((item) => item.eventId === eventId) ?? null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load the performance.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

  async function placeHold() {
    setPending(true);
    setError(null);
    try {
      setHold(await protocol.placeHold({ eventId, quantity }));
      await refreshPerformance();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not place the hold.");
    } finally {
      setPending(false);
    }
  }

  async function releaseHold() {
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
      await dropEndedHold(reason);
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!hold) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      setBooking(await protocol.confirmBooking(hold.holdId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not confirm the booking.");
      await dropEndedHold(reason);
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading the performance.</p>;
  }

  if (!performance) {
    return (
      <section>
        <p className="alert" role="alert">
          {error ?? "That performance is not on this adapter."}
        </p>
        <JourneyPanel eventId={eventId} environment={protocol.describe().environment} key={eventId} />
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
          {performance.venue} · {formatWhen(performance.startsAt)} · {performance.remainingCapacity} still open
        </p>
        <p className="muted">
          The hold form is the Wave 4 pointer. The reservation case is a simulated mock phase. Not live admission.
          B01–B05 stay 설계중.
        </p>
      </header>
      <JourneyPanel eventId={eventId} environment={protocol.describe().environment} key={eventId} />
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
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
              <dd>{booking.quantity}</dd>
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
        <form
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
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={6}
              value={quantity}
              disabled={Boolean(hold) || pending}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          {hold ? (
            <p>
              Hold <strong>{hold.holdId}</strong> until {formatWhen(hold.expiresAt)}. Surface {hold.surface}.
            </p>
          ) : (
            <p className="muted">A hold reserves capacity in the adapter. Confirming does not take payment.</p>
          )}
          <div className="row-actions">
            {hold ? (
              <>
                <button type="button" className="ghost" disabled={pending} onClick={() => void releaseHold()}>
                  Release hold
                </button>
                <button type="submit" disabled={pending}>
                  Confirm booking
                </button>
              </>
            ) : (
              <button type="submit" disabled={pending}>
                Place hold
              </button>
            )}
          </div>
        </form>
      )}
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
      <p>
        <Link to={`/admission?eventId=${encodeURIComponent(eventId)}`}>Mock admission phase</Link>
      </p>
    </section>
  );
}

function isEndedHold(code: string | undefined): boolean {
  return code === "HOLD_EXPIRED" || code === "HOLD_NOT_ACTIVE";
}
