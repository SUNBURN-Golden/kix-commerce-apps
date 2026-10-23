import { formatWhen } from "../../format";
import { messages as deskCopy } from "../../i18n/desk-catalogue";
import { messages as copy0 } from "../../i18n/messages/pages--marketing--M02Presale";
import { messages as copy1 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { ConnectivityWriteButton } from "../../components/ConnectivityWriteButton";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Performance } from "@kix/protocol-adapter";
import { useT } from "../../i18n/desk-context";
import { useDisplayLocale } from "../../i18n/locale-context";
import { presaleWindowFor } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { protocol } from "../../connectivity/desk-protocol";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M02Page() {
  const t = useT(deskCopy, copy0, copy1);
  const clock = useDisplayLocale();
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
          setError(errorText(reason, deskCopy.en["desk.performance.loadError"]));
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
      setError(errorText(reason, copy0.en["e.63"]));
    }
  }

  return (
    <MarketingChrome id="M02" onReadAgain={refresh}>
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <article className="panel">
        <p className="eyebrow">{t("sg9")}{" "}{deskText(t, windowState)}</p>
        <h3>{windowState === "open-demo" ? t("s27c") : t("s27b")}</h3>
        <p className="muted">
          {t("sbm")}{windowState === "closed-demo" ? (" " + t("sot")) : null}{" "}
          {t("s15a")}{" "}<Link to="/">{t("sai")}</Link> {t("sls")}</p>
      </article>
      {performances === null && !error ? <p className="muted">{t("desk.performance.loading")}</p> : null}
      {performances?.length === 0 ? <p className="empty">{t("desk.performance.empty")}</p> : null}
      <ul className="program">
        {deskText(t, performances?.map((item) => {
          const interest = snapshot.interests.find((row) => row.eventId === item.eventId);
          return (
            <li key={item.eventId}>
              <article className="row">
                <div>
                  <p className="when">{formatWhen(item.startsAt, clock)}</p>
                  <h3>{deskText(t, item.title)}</h3>
                  <p className="muted">
                    {deskText(t, item.venue)} · {deskText(t, item.remainingCapacity)} {t("s1mo")}</p>
                  {interest ? (
                    <p>
                      {t("soj")}{" "}{formatWhen(interest.recordedAt, clock)} · {deskText(t, interest.window)}
                    </p>
                  ) : null}
                </div>
                <div className="row-actions">
                  <ConnectivityWriteButton
                    type="button"
                    disabled={windowState !== "open-demo" || Boolean(interest)}
                    onClick={() => record(item.eventId)}
                  >
                    {interest ? t("soj") : t("s1dq")}
                  </ConnectivityWriteButton>
                </div>
              </article>
            </li>
          );
        }))}
      </ul>
    </MarketingChrome>
  );
}
