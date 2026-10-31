import { AsyncStateFrame } from "../../components/AsyncStateFrame";
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
import { useSettledFocus } from "../../a11y/focus";

export function M02Page() {
  const t = useT(deskCopy, copy0, copy1);
  const clock = useDisplayLocale();
  const { snapshot, refresh } = useMarketingSnapshot();
  const [performances, setPerformances] = useState<Performance[] | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tier = snapshot.membershipKnowledge === "unknown" ? "unknown" : snapshot.membership?.tier ?? "guest";
  const windowState = tier === "unknown" ? "unknown" : presaleWindowFor(tier);
  const [recorded, setRecorded] = useState<string | null>(null);
  const settled = recorded !== null && snapshot.interests.some((row) => row.eventId === recorded);
  useSettledFocus(settled ? `${recorded}:${snapshot.interests.find((row) => row.eventId === recorded)?.state}` : null, recorded === null ? null : `m02-interest-${recorded}`);

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
          setReadError(errorText(reason, deskCopy.en["desk.performance.loadError"]));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function record(eventId: string, withdraw = false) {
    setError(null);
    try {
      if (withdraw) marketingSession.withdrawInterest(eventId);
      else marketingSession.recordInterest(eventId);
      setRecorded(eventId);
      refresh();
    } catch (reason) {
      setError(errorText(reason, copy0.en["e.63"]));
    }
  }

  return (
    <MarketingChrome id="M02" onReadAgain={refresh} headingDescribedBy="m02-window-note">
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      {windowState === "unknown" ? <AsyncStateFrame kind="unknown" word="UNKNOWN" label="" note={t("marketing.membershipUnknown")} /> : null}
      <article className="panel">
        <p className="eyebrow">{t("sg9")}{" "}{deskText(t, windowState)}</p>
        <h3>{windowState === "unknown" ? t("marketing.windowUnknown") : windowState === "open-demo" ? t("s27c") : t("s27b")}</h3>
        <p className="muted" id="m02-window-note">
          {windowState === "unknown" ? t("marketing.membershipUnknown") : t("sbm")}{windowState === "closed-demo" ? (" " + t("sot")) : null}{" "}
          {t("s15a")}{" "}<Link to="/">{t("sai")}</Link> {t("sls")}</p>
      </article>
      {performances === null && !readError ? <p className="muted">{t("desk.performance.loading")}</p> : null}
      {readError ? <AsyncStateFrame kind="error" word={t("marketing.readError")} label="" note={deskText(t, readError)} /> : null}
      {performances?.length === 0 ? <p className="empty">{t("desk.performance.empty")}</p> : null}
      <ul className="program">
        {deskText(t, performances?.map((item) => {
          const interest = snapshot.interests.find((row) => row.eventId === item.eventId);
          const active = interest?.state === "recorded";
          const eventWindow = marketingSession.presaleWindow(item.eventId);
          return (
            <li key={item.eventId}>
              <article className="row">
                <div>
                  <p className="when">{formatWhen(item.startsAt, clock)}</p>
                  <h3>{deskText(t, item.title)}</h3>
                  <p className="muted">
                    {deskText(t, item.venue)} · {deskText(t, item.remainingCapacity)} {t("s1mo")}</p>
                  <div id={`m02-interest-${item.eventId}`} tabIndex={-1} aria-live="polite">
                    {interest ? (
                      <p>
                        {active ? t("soj") : t("marketing.withdrawn")}{" "}{formatWhen(interest.recordedAt, clock)} · {deskText(t, interest.tier)} · {deskText(t, interest.window)}
                        {interest.withdrawnAt ? <> · {formatWhen(interest.withdrawnAt, clock)}</> : null}
                      </p>
                    ) : null}
                  </div>
                  {windowState === "open-demo" && eventWindow === "unknown" ? <AsyncStateFrame id={`m02-window-${item.eventId}`} kind="unknown" word="UNKNOWN" label="" note={t("marketing.windowUnknown")} /> : null}
                  {windowState === "open-demo" && eventWindow === "closed-demo" ? <p id={`m02-window-${item.eventId}`} className="muted">{t("marketing.windowClosed")}</p> : null}
                </div>
                <div className="row-actions">
                  <ConnectivityWriteButton
                    type="button"
                    disabled={eventWindow !== "open-demo" || active}
                    aria-describedby={active ? `m02-interest-${item.eventId}` : windowState !== "open-demo" ? "m02-window-note" : eventWindow !== "open-demo" ? `m02-window-${item.eventId}` : undefined}
                    onClick={() => record(item.eventId)}
                  >
                    {active ? t("soj") : t("s1dq")}
                  </ConnectivityWriteButton>
                  {active ? <ConnectivityWriteButton type="button" onClick={() => record(item.eventId, true)}>{t("marketing.withdraw")}</ConnectivityWriteButton> : null}
                </div>
              </article>
            </li>
          );
        }))}
      </ul>
    </MarketingChrome>
  );
}
