import { journeyInvokerFor, type JourneyInvokerSource } from "../../../packages/protocol-adapter/src/journey-invoker";
import { protocol } from "./connectivity/desk-protocol";

/** Chosen once from the protocol this page already built. A failure does not switch it. */
export const journeySource: JourneyInvokerSource | null = journeyInvokerFor(protocol);
