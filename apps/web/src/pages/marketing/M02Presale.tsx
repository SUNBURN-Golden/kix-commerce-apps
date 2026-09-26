import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Performance } from "@kix/protocol-adapter";
import { formatWhen } from "../../format";
import { presaleWindowFor } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { protocol } from "../../protocol";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M02Page() {
  const { snapshot, refresh } = useMarketingSnapshot();
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tier = snapshot.membership?.tier ?? "guest";
  const windowState = presaleWindowFor(tier);

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
          setError(errorText(reason, "Could not load performances."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function record(eventId: string) {
    setError(null);
    try {
      marketingSession.recordInterest(eventId);
      refresh();
    } catch (reason) {
      setError(errorText(reason, "Could not record demo interest."));
    }
  }

  return (
    <MarketingChrome id="M02">
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <article className="panel">
        <p className="eyebrow">Demo window · {windowState}</p>
        <h3>{windowState === "open-demo" ? "데모 창 열림 · Open" : "데모 창 닫힘 · Closed"}</h3>
        <p className="muted">
          Catalog titles are read from the protocol adapter for display. Recording interest writes only this marketing
          stub.
          {windowState === "closed-demo"
            ? " Issue a fan or member card on M01 to open the demo window."
            : null}{" "}
          Open the <Link to="/">box office</Link> for the separate Wave 6 booking desk.
        </p>
      </article>
      {performances === null && !error ? <p className="muted">Loading performances.</p> : null}
      {performances?.length === 0 ? <p className="empty">No performances on this adapter.</p> : null}
      <ul className="program">
        {performances?.map((item) => {
          const interest = snapshot.interests.find((row) => row.eventId === item.eventId);
          return (
            <li key={item.eventId}>
              <article className="row">
                <div>
                  <p className="when">{formatWhen(item.startsAt)}</p>
                  <h3>{item.title}</h3>
                  <p className="muted">
                    {item.venue} · {item.remainingCapacity} still open on the catalog
                  </p>
                  {interest ? (
                    <p>
                      Interest recorded {formatWhen(interest.recordedAt)} · {interest.window}
                    </p>
                  ) : null}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    disabled={windowState !== "open-demo" || Boolean(interest)}
                    onClick={() => record(item.eventId)}
                  >
                    {interest ? "Interest recorded" : "Record demo interest"}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </MarketingChrome>
  );
}
