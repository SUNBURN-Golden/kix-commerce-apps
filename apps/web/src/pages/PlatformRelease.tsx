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
  const live = usePlatformRelease();
  const model = live.model;
  // A refusal, a fence, or an unknown result takes focus to the status region.
  useRestoreFocus(model.lastNeedsFocus && model.lastSeq !== null ? String(model.lastSeq) : null, "rel-status");

  return (
    <div className="discovery release" data-adapter-environment={live.environment}>
      <nav className="discovery-nav" aria-label="Release sections">
        <a href="#rel-controls">Controls</a>
        <a href="#rel-status">Status</a>
        <a href="#rel-packet">Packet</a>
        <a href="#rel-candidate">Candidate</a>
        <a href="#rel-qualification">Qualification</a>
        <a href="#rel-decisions">Decisions</a>
        <a href="#rel-handoff">Handoffs</a>
        <a href="#rel-denominators">Denominators</a>
        <a href="#rel-checks">Checks</a>
        <a href="#rel-session">Session record</a>
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
