import { messages as copy0 } from "../../i18n/messages/pages--marketing--Hub";
import { messages as copy1 } from "../../i18n/messages/marketing--contracts";
import { messages as copy2 } from "../../i18n/messages/marketing--labels";
import { messages as copy3 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { useT } from "../../i18n/desk-context";
import { ConnectivityWriteButton } from "../../components/ConnectivityWriteButton";
import { Link } from "react-router-dom";
import { MARKETING_CONTRACT_IDS, marketingPublishedLine } from "../../marketing/contracts";
import { MARKETING_SURFACES } from "../../marketing/labels";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { MarketingChrome } from "./MarketingChrome";

export function MarketingHubPage() {
  const t = useT(copy0, copy1, copy2, copy3);
  const { snapshot, refresh } = useMarketingSnapshot();
  const boundary = snapshot.boundary;
  const tier = snapshot.membership?.tier ?? "guest";

  return (
    <MarketingChrome onReadAgain={refresh}>
      <header className="section-head">
        <p className="eyebrow">{t("s26f")}</p>
        <h2>{t("shell.eyebrow.marketing")}</h2>
        <p lang="ko">{t("s27g")}</p>
        <p className="muted">
          {t("sln")}</p>
      </header>
      <article className="ticket" aria-label={t("sry")}>
        <p className="eyebrow">{t("s1jv")}</p>
        <h3>{t("s23b")}</h3>
        <dl>
          <div>
            <dt>{t("s1mu")}</dt>
            <dd>{boundary.status}</dd>
          </div>
          <div>
            <dt>{t("s19y")}</dt>
            <dd>{deskText(t, boundary.protocolBinding)}</dd>
          </div>
          <div>
            <dt>{t("s14v")}</dt>
            <dd>{boundary.openApiBound ? t("s277") : t("stt")}</dd>
          </div>
          <div>
            <dt>{t("s244")}</dt>
            <dd>{deskText(t, tier)}</dd>
          </div>
          <div>
            <dt>{t("s18u")}</dt>
            <dd>{deskText(t, snapshot.interests.length)}</dd>
          </div>
          <div>
            <dt>{t("seq")}</dt>
            <dd>{deskText(t, snapshot.coupons.length)}</dd>
          </div>
          <div>
            <dt>{t("s1h8")}</dt>
            <dd>{deskText(t, snapshot.rewardMarkers)}</dd>
          </div>
          <div>
            <dt>{t("sdo")}</dt>
            <dd>{snapshot.consent.state}</dd>
          </div>
          <div>
            <dt>{t("sm8")}</dt>
            <dd>{deskText(t, boundary.fundsMovement)}</dd>
          </div>
          <div>
            <dt>{t("s16e")}</dt>
            <dd>{deskText(t, boundary.outboundSend)}</dd>
          </div>
        </dl>
        <div className="row-actions">
          <ConnectivityWriteButton
            type="button"
            className="ghost"
            onClick={() => {
              marketingSession.reset();
              refresh();
            }}
          >
            {t("s1gb")}</ConnectivityWriteButton>
        </div>
      </article>
      <article className="panel" aria-label={t("s1ac")}>
        <p className="eyebrow">{t("s1ac")}</p>
        <h3>{t("sbn")}</h3>
        <p className="muted">
          {t("sl4")}</p>
        <ul className="program">
          {deskText(t, MARKETING_CONTRACT_IDS.map((id) => (
            <li key={id}>
              <p>
                <strong>{deskText(t, id)}</strong> {marketingPublishedLine(id)}
              </p>
            </li>
          )))}
        </ul>
      </article>
      <ul className="hub">
        {deskText(t, MARKETING_SURFACES.map((item) => (
          <li key={item.id}>
            <Link className="panel hub-card" to={item.path}>
              <p className="eyebrow">
                {deskText(t, item.id)} · {deskText(t, item.status)}
              </p>
              <h3 lang="ko">{deskText(t, item.titleKo)}</h3>
              <p>{deskText(t, item.titleEn)}</p>
              <p className="muted">{deskText(t, item.blurbEn)}</p>
            </Link>
          </li>
        )))}
      </ul>
      <p className="muted">
        <Link to="/marketing/journey">{t("s9u")}</Link>{t("sgp")}</p>
    </MarketingChrome>
  );
}
