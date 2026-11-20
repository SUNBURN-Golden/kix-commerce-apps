import { classifyThrown } from "./call-outcome.js";
import { collectLinks, declaredRefusal, type CommerceJourneyCall, type CommerceJourneyPort, type CommerceJourneyStep, type FixtureStep, type JourneyLinks, type JourneyProof } from "./commerce-journey-command.js";

const RESALE = [
  "reserve-A", "order-A", "payment-A", "issue-A", "resale-clock", "adopt-A", "list-A", "hold-A",
  "resale-payment-A", "settle-resale-initiate", "settle-resale-authorize", "settle-resale-capture", "bind-resale",
  "settle-resale-commit", "accept-A", "distribute-resale",
] as const;
const ADMISSION = ["reserve-B", "order-B", "payment-B", "issue-B", "admission-clock", "adopt-B", "authorize-B", "consume-B"] as const;
const REFUND = [
  "reserve-C", "order-C", "cancel-C", "settle-cancel-initiate", "settle-cancel", "settle-fail-initiate", "settle-fail",
  "settle-refund-initiate", "settle-refund-authorize", "settle-refund-capture", "bind-refund", "observe-mock-acceptance",
] as const;
export const JOURNEY_BRANCHES = { resale: RESALE, admission: ADMISSION, refund: REFUND } as const;
export type CommerceJourneyBranch = keyof typeof JOURNEY_BRANCHES;

const DECLINE: Partial<Record<CommerceJourneyStep, CommerceJourneyStep>> = {
  "reserve-A": "hold-over-capacity", "order-A": "hold-occupied-slot",
  "issue-A": "cancel-after-payment", "issue-B": "cancel-after-payment",
  "settle-resale-commit": "accept-A-before-commit",
  "settle-cancel-initiate": "issue-cancelled",
};

function planFor(branch: CommerceJourneyBranch): readonly CommerceJourneyStep[] {
  return ["reservation-clock", "register-show", ...JOURNEY_BRANCHES[branch]];
}

function alternative(next: CommerceJourneyStep | undefined, confirmed: CommerceJourneyStep | null) {
  return next ? DECLINE[next] : confirmed === "consume-B" ? "double-consume" : undefined;
}

export function commerceStepAfter(branch: CommerceJourneyBranch, confirmed: CommerceJourneyStep | null) {
  const plan = planFor(branch);
  const index = confirmed === null ? -1 : plan.indexOf(confirmed);
  if (confirmed !== null && index === -1) return null;
  const next = plan[index + 1];
  return { next, decline: alternative(next, confirmed) };
}

export type Fact<State extends string> = { state: "NO_EVIDENCE" } | { state: State; proof: JourneyProof };
export interface CommerceJourneyFacts {
  paymentObservation: Fact<"OBSERVED">;
  ticketIssuance: Fact<"ISSUED">;
  admission: Fact<"AUTHORIZED" | "CONSUMED_ONCE">;
  resale: Fact<"TRANSFERRED">;
  reservationCancellation: Fact<"CANCELLED">;
  refundBinding: Fact<"BOUND">;
  refundAcceptance: Fact<"MOCK_ACCEPTANCE_OBSERVED">;
}

type DispatchedCall = Pick<CommerceJourneyCall, "step" | "operationId" | "idempotencyKey">;
type Failure = DispatchedCall & {
  kind: "UNKNOWN" | "REJECTED" | "NOT_SENT";
  code: string;
  requestId?: string;
  correlationId?: string;
};
export type CommerceJourneyOutcome = Failure | (DispatchedCall & { kind: "CONFIRMED"; proof: JourneyProof });

export type MintAttempt<S extends FixtureStep> = (step: S) => Omit<DispatchedCall, "step">;

export abstract class FixtureJourney<Step extends FixtureStep, Facts extends object> {
  private readonly tried = new Set<Step>();
  private cursor = 0;
  private links: JourneyLinks = {};
  private pending: Step | null = null;
  private last: CommerceJourneyOutcome | null = null;
  private confirmed: Step | null = null;

  constructor(private readonly plan: readonly Step[], protected readonly facts: Facts, private readonly port: CommerceJourneyPort<Step>,
    private readonly mint: MintAttempt<Step>) {}
  protected abstract alternative(next: Step | undefined, confirmed: Step | null): Step | undefined;
  protected abstract recordFact(step: Step, proof: JourneyProof): void;

  state() {
    const next = this.plan[this.cursor];
    const decline = this.alternative(next, this.confirmed);
    const fenced = this.last !== null && this.last.kind !== "CONFIRMED" &&
      (this.last.kind !== "REJECTED" || this.last.step === next ||
        this.last.code !== declaredRefusal(this.last.step));
    return {
      facts: { ...this.facts }, pending: this.pending, last: this.last, confirmed: this.confirmed, fenced, next,
      decline: decline && !this.tried.has(decline) ? decline : undefined,
    };
  }

  async run(step: Step): Promise<CommerceJourneyOutcome | undefined> {
    const { next, decline, fenced } = this.state();
    if (fenced || this.pending || (step !== next && step !== decline)) return;
    const attempt = { step, ...this.mint(step) };
    this.pending = step;
    this.tried.add(step);
    try {
      const proof = await this.port.advanceCommerceJourney({ ...attempt, links: this.links });
      if (declaredRefusal(step)) {
        this.last = { ...attempt, kind: "UNKNOWN", code: "INVALID_FSM_RECEIPT" };
        return this.last;
      }
      this.confirmed = step;
      this.cursor = step === next ? this.cursor + 1 : this.plan.length;
      this.links = { ...this.links, ...collectLinks(step, proof) };
      this.recordFact(step, proof);
      this.last = { ...attempt, kind: "CONFIRMED", proof };
    } catch (error) {
      const { disposition, ...detail } = classifyThrown(error);
      this.last = { ...attempt, ...detail, kind: disposition === "rejected" ? "REJECTED" : disposition === "not-sent" ? "NOT_SENT" : "UNKNOWN" };
    } finally {
      this.pending = null;
    }
    return this.last;
  }
}

const initialFacts = (): CommerceJourneyFacts => ({
  paymentObservation: { state: "NO_EVIDENCE" },
  ticketIssuance: { state: "NO_EVIDENCE" },
  admission: { state: "NO_EVIDENCE" },
  resale: { state: "NO_EVIDENCE" },
  reservationCancellation: { state: "NO_EVIDENCE" },
  refundBinding: { state: "NO_EVIDENCE" },
  refundAcceptance: { state: "NO_EVIDENCE" },
});

export class CommerceJourney extends FixtureJourney<CommerceJourneyStep, CommerceJourneyFacts> {
  constructor(branch: CommerceJourneyBranch, port: CommerceJourneyPort<CommerceJourneyStep>, mint: MintAttempt<CommerceJourneyStep>) {
    super(planFor(branch), initialFacts(), port, mint);
  }
  protected alternative(next: CommerceJourneyStep | undefined, confirmed: CommerceJourneyStep | null) {
    return alternative(next, confirmed);
  }
  protected recordFact(step: CommerceJourneyStep, proof: JourneyProof) {
    switch (step) {
      case "payment-A": case "payment-B": this.facts.paymentObservation = { state: "OBSERVED", proof }; break;
      case "issue-A": case "issue-B": this.facts.ticketIssuance = { state: "ISSUED", proof }; break;
      case "authorize-B": this.facts.admission = { state: "AUTHORIZED", proof }; break;
      case "consume-B": this.facts.admission = { state: "CONSUMED_ONCE", proof }; break;
      case "accept-A": this.facts.resale = { state: "TRANSFERRED", proof }; break;
      case "cancel-C": this.facts.reservationCancellation = { state: "CANCELLED", proof }; break;
      case "bind-refund": this.facts.refundBinding = { state: "BOUND", proof }; break;
      case "observe-mock-acceptance": this.facts.refundAcceptance = { state: "MOCK_ACCEPTANCE_OBSERVED", proof }; break;
    }
  }
}
