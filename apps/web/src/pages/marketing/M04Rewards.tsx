import { messages as copy0 } from "../../i18n/messages/pages--marketing--M04Rewards";
import { messages as copy1 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { useT } from "../../i18n/desk-context";
import { useState, type FormEvent } from "react";
import { PARTNER_REFERRAL_CODES } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M04Page() {
  const t = useT(copy0, copy1);
  const { snapshot, refresh } = useMarketingSnapshot();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.acceptReferral(code);
      setCode("");
      refresh();
    } catch (reason) {
      setError(errorText(reason, copy0.en["e.65"]));
    }
  }

  return (
    <MarketingChrome id="M04">
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <article className="ticket">
        <p className="eyebrow">{t("s1jn")}</p>
        <h3>{deskText(t, snapshot.referralCode)}</h3>
        <dl>
          <div>
            <dt>{t("sg7")}</dt>
            <dd>{deskText(t, snapshot.rewardMarkers)}</dd>
          </div>
          <div>
            <dt>{t("sey")}</dt>
            <dd>{deskText(t, snapshot.boundary.creditDisbursement)}</dd>
          </div>
        </dl>
        <p className="muted">{t("srt")}</p>
      </article>
      <form className="panel" onSubmit={onSubmit}>
        <label>
          {t("s17a")}<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">{t("slm")}{" "}{deskText(t, PARTNER_REFERRAL_CODES.join(", "))}.</p>
        <div className="row-actions">
          <button type="submit">{t("sem")}</button>
        </div>
      </form>
      {snapshot.acceptedReferrals.length > 0 ? (
        <p className="panel">{t("seo")}{" "}{deskText(t, snapshot.acceptedReferrals.join(", "))}</p>
      ) : (
        <p className="empty">{t("swr")}</p>
      )}
    </MarketingChrome>
  );
}
