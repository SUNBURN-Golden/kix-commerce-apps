import { describe, expect, it } from "vitest";
import {
  OperationalQualificationController,
  createNotBoundQualificationRunner,
  createStubQualificationRunner,
  qualificationFenceLine,
  type QualificationRunnerPort,
} from "../src/index.js";

function controller(port?: QualificationRunnerPort, actorRef = "qualification-runner") {
  return new OperationalQualificationController(port ?? createStubQualificationRunner(), { actorRef });
}

describe("operational qualification controller", () => {
  it("sends a run once, stores the packet, and records the intent", async () => {
    const ctl = controller();
    const result = await ctl.run("oq-run-1");
    expect(result.kind).toBe("CONFIRMED");
    const state = ctl.state();
    expect(state.runState).toBe("ready");
    expect(state.packet).not.toBeNull();
    expect(state.intents.map((item) => item.outcome)).toEqual(["CONFIRMED"]);
    expect(state.counters.sent).toBe(1);
    if (result.kind === "CONFIRMED") {
      expect(result.packet.packetId).toBe(state.packet?.packetId);
      expect(result.intent.packetId).toBe(result.packet.packetId);
    }
  });

  it("fences a repeated intent and a run during an in-flight run without sending", async () => {
    const port = createStubQualificationRunner({ scenario: "held" });
    const ctl = controller(port);
    const pending = ctl.run("oq-held");
    const dup = await ctl.run("oq-held");
    expect(dup.kind).toBe("FENCED");
    if (dup.kind === "FENCED") {
      expect(dup.fence.reason).toBe("duplicate-intent");
    }
    const second = await ctl.run("oq-held-2");
    expect(second.kind).toBe("FENCED");
    if (second.kind === "FENCED") {
      expect(second.fence.reason).toBe("in-flight");
      expect(qualificationFenceLine(second.fence)).toContain("oq-held");
    }
    port.deliverHeld();
    const settled = await pending;
    expect(settled.kind).toBe("CONFIRMED");
    const state = ctl.state();
    expect(state.counters.sent).toBe(1);
    expect(state.counters.fenced).toBe(2);
  });

  it("fences a run while an earlier run's outcome is unknown", async () => {
    const port: QualificationRunnerPort = {
      environment: "stub",
      source: "synthetic-qualification",
      scenario: "clean",
      run(request) {
        return Promise.resolve({
          kind: "ready",
          intentRef: `${request.intentRef}-wrong`,
          contextKey: request.contextKey,
          packet: null as never,
        });
      },
      deliverHeld() {
        return 0;
      },
    };
    const ctl = controller(port);
    const first = await ctl.run("oq-miscorr");
    expect(first.kind).toBe("UNKNOWN");
    const second = await ctl.run("oq-next");
    expect(second.kind).toBe("FENCED");
    if (second.kind === "FENCED") {
      expect(second.fence.reason).toBe("unknown-outcome");
      expect(qualificationFenceLine(second.fence)).toContain("oq-miscorr");
    }
    expect(ctl.state().runState).toBe("unknown");
    expect(ctl.state().packet).toBeNull();
  });

  it("quarantines a run result that arrives after a context switch and leaks nothing", async () => {
    const port = createStubQualificationRunner({ scenario: "held" });
    const ctl = controller(port);
    const pending = ctl.run("oq-switch");
    const next = ctl.switchContext({ actorRef: "qualification-reviewer" });
    expect(next.actorRef).toBe("qualification-reviewer");
    expect(next.incarnation).toBe(2);
    port.deliverHeld();
    const settled = await pending;
    expect(settled.kind).toBe("QUARANTINED");
    const state = ctl.state();
    expect(state.packet).toBeNull();
    expect(state.intents.map((item) => item.outcome)).toEqual(["UNKNOWN"]);
    expect(state.intents[0]?.code).toBe("CONTEXT_SWITCHED");
    expect(state.quarantined.length).toBe(1);
    expect(state.quarantined[0]?.cause).toBe("context-changed");
    const rerun = await ctl.run("oq-after-switch");
    expect(rerun.kind).toBe("FENCED");
    if (rerun.kind === "FENCED") {
      expect(rerun.fence.reason).toBe("unknown-outcome");
      if (rerun.fence.reason === "unknown-outcome") {
        expect(rerun.fence.earlierContext).toBe(true);
      }
    }
  });

  it("leaves a run unknown when the packet claims a non-claim", async () => {
    const ctl = controller(createStubQualificationRunner({ scenario: "claims-pass" }));
    const result = await ctl.run("oq-claims");
    expect(result.kind).toBe("UNKNOWN");
    const state = ctl.state();
    expect(state.packet).toBeNull();
    expect(state.runState).toBe("unknown");
    expect(state.intents[0]?.code).toBe("UNTRUSTED_PACKET");
  });

  it("answers not-bound on integration-http before sending anything", async () => {
    const ctl = controller(createNotBoundQualificationRunner());
    const fence = ctl.gateFor("oq-nb");
    expect(fence?.reason).toBe("not-bound");
    const result = await ctl.run("oq-nb");
    expect(result.kind).toBe("FENCED");
    expect(ctl.state().counters.sent).toBe(0);
  });

  it("does not send an invalid intent or a changed tuple", async () => {
    const ctl = controller();
    const empty = await ctl.run("   ");
    expect(empty.kind).toBe("NOT_SENT");
    if (empty.kind === "NOT_SENT") {
      expect(empty.reason).toBe("invalid-intent");
    }
    const tuplePort = createStubQualificationRunner({
      expectedTuple: {
        contractOpenApiSha256: "x",
        contractInfoVersion: "x",
        contractMainSha: "x",
        gateOpenApiSha256: "x",
        protocolMergeSha: "x",
        protocolFeatureSha: "x",
        sourceProtocolContractSha256: "x",
        domain: "kix:fixture:lifecycle:0.3",
        pinnedActions: [],
        sdkDigest: null,
        manifestDigest: null,
        vectorDigest: null,
      },
    });
    const tupleCtl = controller(tuplePort);
    const changed = await tupleCtl.run("oq-tuple");
    expect(changed.kind).toBe("NOT_SENT");
    if (changed.kind === "NOT_SENT") {
      expect(changed.reason).toBe("tuple-changed");
    }
    expect(tupleCtl.state().runState).toBe("tuple-changed");
  });

  it("notifies subscribers on each state transition", async () => {
    const ctl = controller();
    let calls = 0;
    const stop = ctl.subscribe(() => {
      calls += 1;
    });
    await ctl.run("oq-sub");
    expect(calls).toBeGreaterThanOrEqual(2);
    stop();
    const before = calls;
    await ctl.run("oq-sub-2");
    expect(calls).toBe(before);
  });
});
