import { MarketingStubDesk } from "./desk";

/** One desk per page load. A reload clears it, same as the booking stub. */
export const marketingSession = new MarketingStubDesk();
