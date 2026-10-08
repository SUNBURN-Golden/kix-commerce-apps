import { giftInvokerFor, type GiftInvokerSource } from "@kix/protocol-adapter";
import { protocol } from "./protocol";

/** Chosen once from the protocol this page already built. A failure does not switch it. */
export const giftSource: GiftInvokerSource | null = giftInvokerFor(protocol);
