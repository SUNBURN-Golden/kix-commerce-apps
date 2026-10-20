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
 * lives in the guide documents; this page stays English like the other unmigrated screen bodies.
 */
export function HelpPage() {
  return (
    <section className="help" data-guide="status-words" aria-label="Help">
      <header className="section-head">
        <p className="eyebrow">Help</p>
        <h2>Status words and what they mean</h2>
        <p>
          This page is a glossary. Reading a word here changes nothing: no request is sent, no record is written, and no
          result is decided. The same list, Korean first, is in <code>docs/guide/status-glossary-ko.md</code>, and a test
          holds the two equal.
        </p>
        <p>
          UNKNOWN means the result is not known. It is not a failure and not a success; the request may have applied. No
          word on this page claims integration, qualification, acceptance or release.
        </p>
      </header>
      {KIND_ORDER.map((kind) => (
        <section className="panel" key={kind}>
          <h3>{GUIDE_KIND_LABELS[kind]}</h3>
          <div className="handoff-scroll" role="region" aria-label={GUIDE_KIND_LABELS[kind]} tabIndex={0}>
            <table>
              <caption>{GUIDE_KIND_LABELS[kind]}. Each word is printed verbatim and is never translated.</caption>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Meaning</th>
                  <th>What to do</th>
                  <th>Do not read it as</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_WORD_GUIDE.filter((item) => item.kind === kind).map((item) => (
                  <tr key={item.word} data-word={item.word}>
                    <td>
                      <code>{item.word}</code>
                    </td>
                    <td>{item.meaning}</td>
                    <td>{item.doText}</td>
                    <td>{item.dontText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
}
