import { useState } from "react";
import { useLocale } from "./locale-context";
import { LOCALES, htmlLang, type Locale } from "./locales";

/**
 * Two buttons, one per language. Each carries its own `lang`, so a screen reader reads the name in that language.
 * The pressed one is also marked with a check mark, so the state is not carried by colour alone.
 * Focus stays on the pressed button; a status line is written after a user change only.
 */
export function LocaleSwitch() {
  const { locale, t, setLocale } = useLocale();
  const [announced, setAnnounced] = useState(false);
  const choose = (next: Locale) => {
    if (next === locale) {
      return;
    }
    setLocale(next);
    setAnnounced(true);
  };
  return (
    <div className="locale-switch" role="group" aria-label={t("locale.label")}>
      <span className="locale-label">{t("locale.label")}</span>
      {LOCALES.map((item) => (
        <button key={item} type="button" lang={htmlLang(item)} aria-pressed={item === locale} data-locale={item} onClick={() => choose(item)}>
          {item === locale ? "✓ " : ""}
          {t(item === "ko" ? "locale.ko" : "locale.en")}
        </button>
      ))}
      <span className="locale-status" role="status">
        {announced ? t("locale.changed") : ""}
      </span>
      {locale === "ko" ? <span className="locale-notice">{t("locale.notice")}</span> : null}
    </div>
  );
}
