import { messages as copy0 } from "../../i18n/messages/pages--marketing--M03Coupons";
import { messages as copy1 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { useState, type FormEvent } from "react";
import { COUPON_FIXTURES } from "../../marketing/desk";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { useT } from "../../i18n/desk-context";
import { useFormatWhen } from "../../i18n/locale-context";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M03Page() {
  const t = useT(copy0, copy1);
  const formatWhen = useFormatWhen();
  const { snapshot, refresh } = useMarketingSnapshot();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      marketingSession.applyCoupon(code);
      setCode("");
      refresh();
    } catch (reason) {
      setError(errorText(reason, copy0.en["e.64"]));
    }
  }

  return (
    <MarketingChrome id="M03">
      {error ? (
        <p className="alert" role="alert">
          {deskText(t, error)}
        </p>
      ) : null}
      <form className="panel" onSubmit={onSubmit}>
        <label>
          {t("sg6")}<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">{t("s32")}</p>
        <div className="row-actions">
          <button type="submit">{t("s5l")}</button>
        </div>
      </form>
      <ul className="program">
        {deskText(t, COUPON_FIXTURES.map((item) => {
          const applied = snapshot.coupons.find((row) => row.code === item.code);
          return (
            <li key={item.code}>
              <article className="row">
                <div>
                  <p className="eyebrow">{deskText(t, item.code)}</p>
                  <h3 lang="ko">{deskText(t, item.titleKo)}</h3>
                  <p className="muted">{deskText(t, item.titleEn)}</p>
                </div>
                <p className="muted">{applied ? t("s8y", { v1: formatWhen(applied.appliedAt) }) : deskText(t, item.marker)}</p>
              </article>
            </li>
          );
        }))}
      </ul>
    </MarketingChrome>
  );
}
