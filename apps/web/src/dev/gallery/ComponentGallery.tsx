import { messages as mergedCopy } from "../../i18n/messages/gallery";
import { useT } from "../../i18n/desk-context";
import type { ReactNode } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "../../components/Shell";
import { useLocale } from "../../i18n/locale-context";
import { protocol } from "../../protocol";
import { GALLERY_CASES } from "./cases";
import "./gallery.css";

const chrome = {
  en: {
    title: "Component gallery", note: "Development only. Synthetic specimens; no command is sent. UNKNOWN, NOT_BOUND, STALE and UNDETERMINED retain their meanings.",
    settings: "Use browser display preferences for light, dark, forced colours, reduced motion and print. Each preview has its own document to isolate landmarks and focus.",
    preview: "Open isolated preview", missing: "No specimen matches this value.", back: "All specimens",
    refused: "Gallery requires the already selected stub adapter. HTTP selection is refused; the adapter is unchanged.",
  },
  ko: {
    title: "컴포넌트 갤러리", note: "개발 전용 합성 예시입니다. 명령은 전송되지 않습니다. UNKNOWN, NOT_BOUND, STALE, UNDETERMINED의 의미는 유지됩니다.",
    settings: "브라우저 표시 설정으로 밝게, 어둡게, 강제 색상, 움직임 감소, 인쇄를 확인하세요. 각 미리보기는 랜드마크와 포커스를 분리한 문서입니다.",
    preview: "분리된 미리보기 열기", missing: "해당 값의 예시가 없습니다.", back: "모든 예시",
    refused: "갤러리는 이미 선택된 stub 어댑터에서만 표시됩니다. HTTP 선택은 거부되며 어댑터는 바뀌지 않습니다.",
  },
} as const;

export function ComponentGallery() {
  const { locale } = useLocale();
  const t = useT(mergedCopy);
  const text = chrome[locale];
  const query = new URLSearchParams(useLocation().search);
  const specimen = query.get("specimen");
  // Refuse before mounting Shell (whose HTTP transport observation would otherwise run).
  if (protocol.describe().environment !== "stub") {
    return <main id="desk-main" tabIndex={-1}><h1>{text.title}</h1><p role="alert">{text.refused}</p></main>;
  }
  if (specimen !== null) {
    const entry = GALLERY_CASES.find((candidate) => candidate.id === specimen);
    return <SpecimenLocation key={specimen} samplePath={entry?.samplePath ?? "/unmatched-specimen"}>
      {entry?.ownsShell ? entry.render() : <main id="desk-main" className="gallery-preview" tabIndex={-1}>
        <h1>{entry ? t("merge.specimenTitle", { component: entry.component, state: entry.state }) : text.title}</h1>
        <p>{text.note}</p><a href={`/dev/gallery?lang=${locale}`}>{text.back}</a>
        <div data-gallery-specimen={specimen}>{entry ? entry.render() : <p role="status">{text.missing}</p>}</div>
      </main>}
    </SpecimenLocation>;
  }
  return <Shell><section className="component-gallery" aria-labelledby="gallery-title">
    <h2 id="gallery-title" tabIndex={-1}>{text.title}</h2><p>{text.note}</p><p>{text.settings}</p>
    <ul className="gallery-index">
      {GALLERY_CASES.map((entry) => <li key={entry.id} data-gallery-case={entry.id}>
        <h3>{entry.component}</h3><p>{entry.state}</p>
        <a href={`/dev/gallery?specimen=${entry.id}&lang=${locale}`}>{text.preview}: {entry.id}</a>
        <iframe title={t("merge.specimenTitle", { component: entry.component, state: entry.state })} loading="lazy" src={`/dev/gallery?specimen=${entry.id}&lang=${locale}`} />
      </li>)}
    </ul>
  </section></Shell>;
}

/** The official Routes location override supplies a synthetic pathname without nesting routers. */
function SpecimenLocation({ samplePath, children }: { samplePath: string; children: ReactNode }) {
  return <Routes location={samplePath}><Route path="*" element={children} /></Routes>;
}
