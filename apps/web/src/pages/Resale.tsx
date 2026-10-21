import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--Resale";
import { messages as copy1 } from "../i18n/messages/resale-desk";
import { messages as copy2 } from "../i18n/messages/reservation-desk";
import { messages as copy3 } from "../i18n/messages/storage-allow-list";
import { useEffect, useState, type FormEvent } from "react";
import { useT } from "../i18n/desk-context";
import { Link, useSearchParams } from "react-router-dom";
import type { Booking, Performance, ResaleListing } from "@kix/protocol-adapter";
import { protocol } from "../protocol";
import { deskText } from "../i18n/desk-translate";
import { useResaleDesk } from "../resale-desk";
import { ResalePanel } from "./ResalePanel";

export function ResalePage() {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3);
  const [params] = useSearchParams();
  const [bookingId, setBookingId] = useState(params.get("bookingId") ?? "");
  const [askLabel, setAskLabel] = useState<string>(copy0.en["e.39"]);
  const [listings, setListings] = useState<ResaleListing[]>([]);
  const [transfer, setTransfer] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [eventId, setEventId] = useState("evt_lanterns");
  const resale = useResaleDesk(eventId);

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
          setError(reason instanceof Error ? reason.message : deskCopy.en["desk.resale.loadError"]);
        }
      });
    protocol
      .listPerformances()
      .then((rows) => {
        if (!cancelled) {
          setPerformances(rows);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : deskCopy.en["desk.performance.loadError"]);
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
      setError(reason instanceof Error ? reason.message : deskCopy.en["desk.resale.openError"]);
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
      setError(reason instanceof Error ? reason.message : deskCopy.en["desk.resale.transferError"]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">{t("desk.resale.eyebrow")}</p>
        <h2>{t("desk.resale.title")}</h2>
        <p className="muted">{t("desk.resale.note")}</p>
      </header>
      <form className="panel" onSubmit={(event) => void openListing(event)}>
        <label>
          {t("desk.resale.bookingId")}
          <input value={bookingId} onChange={(event) => setBookingId(event.target.value)} autoComplete="off" />
        </label>
        <label>
          {t("desk.resale.ask")}
          <input
            value={askLabel}
            maxLength={40}
            onChange={(event) => setAskLabel(event.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="muted">{t("desk.resale.askNote")}</p>
        <button type="submit" disabled={pending}>
          {t("desk.resale.open")}
        </button>
      </form>
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      {listings.length === 0 ? <p className="empty">{t("desk.resale.empty")}</p> : null}
      <ul className="program">
        {deskText(t, listings.map((listing) => (
          <li key={listing.listingId}>
            <article className="row">
              <div>
                <h3>{deskText(t, listing.askLabel)}</h3>
                <p className="muted">
                  {deskText(t, listing.listingId)} · {deskText(t, listing.status)} {t("desk.resale.rightSuffix")}{" "}{deskText(t, listing.rightsRef)}
                </p>
                <p className="muted">
                  {t("route.booking")}{" "}{deskText(t, listing.bookingId)} · {deskText(t, listing.surface)}
                </p>
              </div>
              {listing.status === "open" ? (
                <button type="button" disabled={pending} onClick={() => void accept(listing.listingId)}>
                  {t("desk.resale.transfer")}</button>
              ) : null}
            </article>
          </li>
        )))}
      </ul>
      {transfer ? (
        <article className="ticket">
          <p className="eyebrow">{t("desk.resale.newRight")}</p>
          <dl>
            <div>
              <dt>{t("route.booking")}</dt>
              <dd>{transfer.bookingId}</dd>
            </div>
            <div>
              <dt>{t("desk.booking.right")}</dt>
              <dd>{transfer.rightsRef}</dd>
            </div>
          </dl>
          <Link className="button" to={`/admission?rightsRef=${encodeURIComponent(transfer.rightsRef)}`}>
            {t("desk.resale.check")}</Link>
        </article>
      ) : null}
      <div className="panel">
        <label>
          {t("desk.credit.event")}<select value={eventId} onChange={(event) => setEventId(event.target.value)}>
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
        <p className="muted">{t("desk.resale.adoptNote")}</p>
      </div>
      <ResalePanel
        eventTitle={performances?.find((item) => item.eventId === eventId)?.title ?? eventId}
        view={resale.view}
        right={resale.right}
        error={resale.error}
        pending={resale.pending}
        onCommand={(command) => void resale.run(command)}
      />
    </section>
  );
}
