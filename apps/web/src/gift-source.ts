import { giftInvokerFor, type GiftInvokerSource } from "../../../packages/protocol-adapter/src/gift-invoker";
import { protocol } from "./connectivity/desk-protocol";

/** Chosen once from the protocol this page already built. A failure does not switch it. */
export const giftSource: GiftInvokerSource | null = giftInvokerFor(protocol);
