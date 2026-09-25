import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Booking, ResaleListing } from "@kix/protocol-adapter";
import { protocol } from "../protocol";

export function ResalePage() {
  const [params] = useSearchParams();
  const [bookingId, setBookingId] = useState(params.get("bookingId") ?? "");
  const [askLabel, setAskLabel] = useState("face (display only)");
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [transfer, setTransfer] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setListings(await protocol.listResale());
  }

  useEffect(() => {
    let cancelled = false;
    protocol
      .listResale()
      .then((rows) => {
        if (!cancelled) {
          setListings(rows);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load listings.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openListing(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setTransfer(null);
    try {
      await protocol.openResale({ bookingId, askLabel });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the listing.");
    } finally {
      setPending(false);
    }
  }

  async function accept(listingId: string) {
    setPending(true);
    setError(null);
    try {
      const result = await protocol.acceptResale(listingId);
      setTransfer(result.booking);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not transfer the listing.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">Resale · R01–R05 · transfer is simulated</p>
        <h2>Listings</h2>
      </header>
      <form className="panel" onSubmit={(event) => void openListing(event)}>
        <label>
          Booking id
          <input value={bookingId} onChange={(event) => setBookingId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          Ask label
          <input
            value={askLabel}
            maxLength={40}
            onChange={(event) => setAskLabel(event.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="muted">The ask label is shown as text. It is not a price and it is not charged.</p>
        <button type="submit" disabled={pending}>
          Open listing
        </button>
      </form>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {listings.length === 0 ? <p className="empty">No listings yet.</p> : null}
      <ul className="program">
        {listings.map((listing) => (
          <li key={listing.listingId}>
            <article className="row">
              <div>
                <h3>{listing.askLabel}</h3>
                <p className="muted">
                  {listing.listingId} · {listing.status} · right {listing.rightsRef}
                </p>
                <p className="muted">
                  Booking {listing.bookingId} · {listing.surface}
                </p>
              </div>
              {listing.status === "open" ? (
                <button type="button" disabled={pending} onClick={() => void accept(listing.listingId)}>
                  Transfer (simulated)
                </button>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
      {transfer ? (
        <article className="ticket">
          <p className="eyebrow">New right after transfer</p>
          <dl>
            <div>
              <dt>Booking</dt>
              <dd>{transfer.bookingId}</dd>
            </div>
            <div>
              <dt>Right</dt>
              <dd>{transfer.rightsRef}</dd>
            </div>
          </dl>
          <Link className="button" to={`/admission?rightsRef=${encodeURIComponent(transfer.rightsRef)}`}>
            Check the new right
          </Link>
        </article>
      ) : null}
    </section>
  );
}
