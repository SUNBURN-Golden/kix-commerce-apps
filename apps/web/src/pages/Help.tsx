import { messages as copy0 } from "../i18n/messages/pages--Help";
import { messages as copy1 } from "../i18n/messages/guide--status-words";
import { messages as copy3 } from "../i18n/messages/marketing--labels";
import { messages as copy4 } from "../i18n/messages/handoff--packet";
import { messages as copy5 } from "../i18n/messages/workspace--registry";
import { deskText } from "../i18n/desk-translate";
import { useT } from "../i18n/desk-context";
import { GUIDE_KIND_LABELS, STATUS_WORD_GUIDE, type StatusWordGuideEntry } from "../guide/status-words";

const KIND_ORDER: readonly StatusWordGuideEntry["kind"][] = [
  "outcome",
  "fixture",
  "status-mark",
  "transport",
  "binding",
  "feature",
  "admission",
  "facet",
  "journey",
  "code",
  "policy",
  "environment",
];

/**
 * The help page is a glossary copy of docs/guide/status-glossary-ko.md (English). It explains words;
 * it is not a status surface, and nothing on it is sent, recorded or decided. The Korean-first text
 * lives in the guide documents; the screen uses the selected display locale and keeps each glossary word verbatim.
 */
export function HelpPage() {
  const t = useT(copy0, copy1, copy3, copy4, copy5);
  return (
    <section className="help" data-guide="status-words" aria-label={t("route.help")}>
      <header className="section-head">
        <p className="eyebrow">{t("route.help")}</p>
        <h2>{t("s1ml")}</h2>
        <p>
          {t("s239")}{" "}<code>{t("sh0")}</code>{t("s3r")}</p>
        <p>
          {t("s25b")}</p>
      </header>
      {deskText(t, KIND_ORDER.map((kind) => (
        <section className="panel" key={kind}>
          <h3>{deskText(t, GUIDE_KIND_LABELS[kind])}</h3>
          <div className="handoff-scroll" role="region" aria-label={deskText(t, GUIDE_KIND_LABELS[kind])} tabIndex={0}>
            <table>
              <caption>{deskText(t, GUIDE_KIND_LABELS[kind])}{t("si6")}</caption>
              <thead>
                <tr>
                  <th>{t("s26w")}</th>
                  <th>{t("ssd")}</th>
                  <th>{t("s26j")}</th>
                  <th>{t("sh8")}</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_WORD_GUIDE.filter((item) => item.kind === kind).map((item) => (
                  <tr key={item.word} data-word={item.word}>
                    <td>
                      <code>{deskText(t, item.word)}</code>
                    </td>
                    <td>{deskText(t, item.meaning)}</td>
                    <td>{deskText(t, item.doText)}</td>
                    <td>{deskText(t, item.dontText)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )))}
    </section>
  );
}
