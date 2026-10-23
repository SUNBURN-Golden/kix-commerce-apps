import { messages as copy0 } from "../../i18n/messages/pages--marketing--M01Membership";
import { messages as copy1 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { useT } from "../../i18n/desk-context";
import { ConnectivityWriteButton } from "../../components/ConnectivityWriteButton";
import { ValidatedForm } from "../../forms/ValidatedForm";
import { field } from "../../forms/validation";
import { useState, type FormEvent } from "react";
import type { MemberTier } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M01Page() {
  const t = useT(copy0, copy1);
  const { snapshot, refresh } = useMarketingSnapshot();
  const [displayName, setDisplayName] = useState(snapshot.membership?.displayName ?? "");
  const [tier, setTier] = useState<MemberTier>(snapshot.membership?.tier ?? "fan");
  const [error, setError] = useState<string | null>(null);
  const card = snapshot.membership;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.join({ displayName, tier });
      refresh();
    } catch (reason) {
      setError(errorText(reason, copy0.en["e.62"]));
    }
  }

  function leave() {
    setError(null);
    marketingSession.leave();
    refresh();
  }

  return (
    <MarketingChrome id="M01" onReadAgain={refresh}>
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <ValidatedForm id="membership-form" fields={[field("membership-name", "validation.label.displayName", { maxLength: 40 })]} className="panel" onSubmit={onSubmit}>
        <label>
          {t("sgx")}<input id="membership-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
            maxLength={40}
          />
        </label>
        <label>
          {t("sg8")}<select value={tier} onChange={(event) => setTier(event.target.value as MemberTier)}>
            <option value="fan">{t("s27f")}</option>
            <option value="member">{t("s27d")}</option>
          </select>
        </label>
        <p className="muted">{t("s1qr")}</p>
        <div className="row-actions">
          <ConnectivityWriteButton type="submit">{t("sow")}</ConnectivityWriteButton>
          <ConnectivityWriteButton type="button" className="ghost" onClick={leave} disabled={!card}>
            {t("sco")}</ConnectivityWriteButton>
        </div>
      </ValidatedForm>
      {card ? (
        <article className="ticket">
          <p className="eyebrow">{t("s1jm")}{" "}{card.status}</p>
          <h3>{deskText(t, card.displayName)}</h3>
          <dl>
            <div>
              <dt>{t("srm")}</dt>
              <dd>{deskText(t, card.memberRef)}</dd>
            </div>
            <div>
              <dt>{t("s244")}</dt>
              <dd>{card.tier === "fan" ? t("s27f") : t("s27d")}</dd>
            </div>
            <div>
              <dt>{t("s1mj")}</dt>
              <dd>{card.status}</dd>
            </div>
          </dl>
          <p className="muted">{deskText(t, card.note)}</p>
        </article>
      ) : (
        <p className="empty">{t("sv3")}</p>
      )}
    </MarketingChrome>
  );
}
