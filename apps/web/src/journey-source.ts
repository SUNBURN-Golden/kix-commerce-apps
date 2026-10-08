import { journeyInvokerFor, type JourneyInvokerSource } from "@kix/protocol-adapter";
import { protocol } from "./protocol";

/** Chosen once from the protocol this page already built. A failure does not switch it. */
export const journeySource: JourneyInvokerSource | null = journeyInvokerFor(protocol);
