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
  const live = useOperationalQualification();
  const model = live.model;
  // A refusal, a fence, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "oq-status");

  return (
    <div className="discovery qualification" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Qualification sections">
        <a href="#oq-controls">Controls</a>
        <a href="#oq-status">Status</a>
        <a href="#oq-packet">Packet</a>
        <a href="#oq-journeys">Journeys</a>
        <a href="#oq-exercises">Exercise classes</a>
        <a href="#oq-denominators">Denominators</a>
        <a href="#oq-evidence">Evidence</a>
        <a href="#oq-candidates">Review candidates</a>
        <a href="#oq-ops">Operations</a>
        <a href="#oq-session">Session record</a>
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
