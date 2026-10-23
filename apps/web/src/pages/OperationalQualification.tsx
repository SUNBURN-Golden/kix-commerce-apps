import { messages as deskCopy } from "../i18n/desk-catalogue";
import { messages as copy0 } from "../i18n/messages/pages--OperationalQualification";
import { messages as copy1 } from "../i18n/messages/operational-qualification";
import { messages as copy2 } from "../i18n/messages/handoff--packet";
import { messages as copy3 } from "../i18n/messages/workspace--registry";
import { useT } from "../i18n/desk-context";
import { useRestoreFocus } from "../a11y/focus";
import { useOperationalQualification } from "../operational-qualification";
import {
  CandidatesSection,
  DenominatorsSection,
  EvidenceSection,
  ExercisesSection,
  JourneysSection,
  OpsSection,
  PacketSummary,
  QualificationBanner,
  QualificationControls,
  QualificationSession,
  QualificationStatus,
} from "./OperationalQualificationPanels";

export function OperationalQualificationPage() {
  const t = useT(deskCopy, copy0, copy1, copy2, copy3);
  const live = useOperationalQualification();
  const model = live.model;
  // A refusal, a fence, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "oq-status");

  return (
    <div className="discovery qualification" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label={t("s1al")}>
        <a href="#oq-controls">{t("sed")}</a>
        <a href="#oq-status">{t("s1mj")}</a>
        <a href="#oq-packet">{t("s16r")}</a>
        <a href="#oq-journeys">{t("route.journeys")}</a>
        <a href="#oq-exercises">{t("sk1")}</a>
        <a href="#oq-denominators">{t("sgc")}</a>
        <a href="#oq-evidence">{t("desk.buyer.evidence")}</a>
        <a href="#oq-candidates">{t("s1h0")}</a>
        <a href="#oq-ops">{t("s15m")}</a>
        <a href="#oq-session">{t("s1js")}</a>
      </nav>
      <div className="discovery-body">
        <QualificationBanner environment={live.environment} scenario={live.scenario} model={model} />
        <QualificationControls
          scenario={live.scenario}
          heldSupported={live.heldSupported}
          model={model}
          actions={live.actions}
        />
        <QualificationStatus model={model} />
        {model.packet ? (
          <>
            <PacketSummary packet={model.packet} />
            <JourneysSection packet={model.packet} />
            <ExercisesSection packet={model.packet} />
            <DenominatorsSection packet={model.packet} />
            <EvidenceSection packet={model.packet} />
            <CandidatesSection packet={model.packet} />
            <OpsSection packet={model.packet} />
          </>
        ) : null}
        <QualificationSession model={model} />
      </div>
    </div>
  );
}
