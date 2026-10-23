import { messages as copy0 } from "../i18n/messages/pages--PlatformRelease";
import { messages as copy1 } from "../i18n/messages/platform-release";
import { messages as copy2 } from "../i18n/messages/handoff--packet";
import { messages as copy3 } from "../i18n/messages/workspace--registry";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { usePlatformRelease } from "../platform-release";
import {
  CandidateSection,
  ChecksSection,
  DecisionsSection,
  DenominatorsSection,
  HandoffSection,
  PacketSummary,
  QualificationSection,
  ReleaseBanner,
  ReleaseControls,
  ReleaseSession,
  ReleaseStatus,
} from "./PlatformReleasePanels";

export function PlatformReleasePage() {
  const t = useT(copy0, copy1, copy2, copy3);
  const live = usePlatformRelease();
  const model = live.model;
  // A refusal, a fence, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "rel-status");

  return (
    <div className="discovery release" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s1f9")}>
        <a href="#rel-controls">{t("sed")}</a>
        <a href="#rel-status">{t("s1mj")}</a>
        <a href="#rel-packet">{t("s16r")}</a>
        <a href="#rel-candidate">{t("sb7")}</a>
        <a href="#rel-qualification">{t("route.qualification")}</a>
        <a href="#rel-decisions">{t("sfk")}</a>
        <a href="#rel-handoff">{t("sn3")}</a>
        <a href="#rel-denominators">{t("sgc")}</a>
        <a href="#rel-checks">{t("sc4")}</a>
        <a href="#rel-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <ReleaseBanner environment={live.environment} scenario={live.scenario} model={model} />
        <ReleaseControls
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          model={model}
          actions={live.actions}
        />
        <ReleaseStatus model={model} />
        {model.packet ? (
          <>
            <PacketSummary packet={model.packet} />
            <CandidateSection packet={model.packet} />
            <QualificationSection packet={model.packet} />
            <DecisionsSection packet={model.packet} />
            <HandoffSection packet={model.packet} />
            <DenominatorsSection packet={model.packet} />
            <ChecksSection packet={model.packet} />
          </>
        ) : null}
        <ReleaseSession model={model} />
      </div>
    </div>
  );
}
