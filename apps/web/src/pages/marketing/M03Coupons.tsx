import { AsyncStateFrame } from "../../components/AsyncStateFrame";
import { formatWhen } from "../../format";
import { messages as copy0 } from "../../i18n/messages/pages--marketing--M03Coupons";
import { messages as copy1 } from "../../i18n/messages/marketing--desk";
import { deskText } from "../../i18n/desk-translate";
import { ConnectivityWriteButton } from "../../components/ConnectivityWriteButton";
import { RefusalScope } from "../../connectivity/refusal";
import { ValidatedForm } from "../../forms/ValidatedForm";
import { field } from "../../forms/validation";
import { useState, type FormEvent } from "react";
import { marketingSession } from "../../marketing/session";
import { useMarketingSnapshot } from "../../marketing/useMarketingSnapshot";
import { useT } from "../../i18n/desk-context";
import { useDisplayLocale } from "../../i18n/locale-context";
import { errorText, MarketingChrome } from "./MarketingChrome";

export function M03Page() {
  const t = useT(copy0, copy1);
  const clock = useDisplayLocale();
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
    <MarketingChrome id="M03" onReadAgain={refresh}>
      {error ? (
        <p className="alert" role="alert" id="coupon-refusal">
          {deskText(t, error)}
        </p>
      ) : null}
      <RefusalScope reason={error ? "coupon-refusal" : null}>
      <ValidatedForm id="coupon-form" fields={[field("coupon-code", "validation.label.code")]} className="panel" onSubmit={onSubmit}>
        <label>
          {t("sg6")}<input id="coupon-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
        </label>
        <p className="muted">{t("s32")}</p>
        <div className="row-actions">
          <ConnectivityWriteButton type="submit">{t("s5l")}</ConnectivityWriteButton>
        </div>
      </ValidatedForm>
      </RefusalScope>
      <p className="muted">{t("marketing.fixtureNote")}</p>
      {snapshot.coupons.length === 0 ? <p className="empty">{t("marketing.noCoupons")}</p> : null}
      {snapshot.fixtures.coupons.length === 0 ? <p className="empty">{t("marketing.noFixtures")}</p> : null}
      <ul className="program">
        {deskText(t, snapshot.fixtures.coupons.map((item) => {
          const applied = snapshot.coupons.find((row) => row.code === item.code);
          const state = snapshot.couponStates[item.code];
          return (
            <li key={item.code}>
              <article className="row">
                <div>
                  <p className="eyebrow">{deskText(t, item.code)}</p>
                  <h3 lang="ko">{deskText(t, item.titleKo)}</h3>
                  <p className="muted">{deskText(t, item.titleEn)}</p>
                  <p className="muted">{item.validFrom ?? t("marketing.unbounded")} · {item.expiresAt ?? t("marketing.unbounded")} · {item.conflictGroup}</p>
                  {item.validity === "unknown" ? <AsyncStateFrame kind="unknown" word="UNKNOWN" label="" note={t("marketing.coupon.unknown")} /> : null}
                </div>
                <div aria-live="polite"><p className="muted">{applied ? t("s8y", { v1: formatWhen(applied.appliedAt, clock) }) : deskText(t, item.marker)}</p>{state ? <p data-coupon-state={state}>{t(`marketing.coupon.${state}`)}</p> : null}</div>
              </article>
            </li>
          );
        }))}
      </ul>
    </MarketingChrome>
  );
}
