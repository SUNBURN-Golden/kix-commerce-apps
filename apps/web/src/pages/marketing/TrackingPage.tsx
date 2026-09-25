import { useEffect } from "react";
import { clearTracking, documentMeta, track, usePageMeta, useTracking } from "../../marketing";

export function TrackingPage() {
  const records = useTracking();
  usePageMeta(
    documentMeta({
      title: "KIX marketing demo · tracking stub",
      description: "In-session marketing events. Nothing is transmitted. This is not live analytics.",
      canonicalPath: "/marketing/tracking",
    }),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      track({ name: "page_view", campaignId: null, detail: "/marketing/tracking" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const newestFirst = [...records].reverse();

  return (
    <section>
      <header className="section-head">
        <p className="eyebrow">M05 · tracking stub</p>
        <h2>Session log</h2>
        <p className="muted">
          Transport is none. Each row is stub-not-transmitted. Reloading the page clears the log. This is not a
          vendor pixel, a beacon, or a live analytics claim.
        </p>
      </header>
      <p>
        <button type="button" className="ghost" onClick={() => clearTracking()} disabled={records.length === 0}>
          Clear log
        </button>
      </p>
      {newestFirst.length === 0 ? (
        <p className="empty">No events in this session. Open a campaign to record a page view and a slot impression.</p>
      ) : (
        <ol className="mkt-log">
          {newestFirst.map((row) => (
            <li key={row.recordId}>
              <p className="mkt-code">
                {row.name} · {row.disposition}
              </p>
              <p>{row.detail}</p>
              <p className="muted">
                {row.campaignId ?? "no campaign"} · {row.at} · transport {row.transport}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
