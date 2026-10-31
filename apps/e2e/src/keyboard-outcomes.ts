import { keyboardCheckId, type JourneyId, type KeyboardOutcome } from "./journey-matrix";
import type { KeyStep } from "./keyboard-probes";
import type { KeyboardDrive } from "./keyboard-runner";

/**
 * One keyboard-only drive per keyboard check id. Each drive mirrors the existing journey scenario in
 * tests/journeys/<journey>.e2e.test.ts with Tab, Shift+Tab, Enter, Space, arrow keys and text entry only.
 * Selectors may use Playwright text pseudo-classes. A wait is not an input: it only lets the desk finish drawing.
 */

const tab = (selector: string, text?: string): KeyStep => (text === undefined ? { tabTo: selector } : { tabTo: selector, text });
const enter: KeyStep = { press: "Enter" };
/** Tab to a button by its visible name and press Enter. */
const press = (text: string, selector = "button"): KeyStep[] => [tab(selector, text), enter];
const pressId = (selector: string): KeyStep[] => [tab(selector), enter];
/** Tab to a native select and move to the option with arrow keys. */
const pick = (selector: string, value: string): KeyStep[] => [tab(selector), { arrowTo: value }];
const type = (selector: string, text: string): KeyStep[] => [tab(selector), { type: text }];
const wait = (selector: string): KeyStep => ({ waitFor: selector });
const navTo = (href: string): KeyStep[] => [tab(`nav a[href="${href}"]`), enter, wait(`nav a[href="${href}"][aria-current="page"]`)];

interface DriveInput extends Omit<KeyboardDrive, "checkId"> {
  journey: JourneyId;
  outcome: KeyboardOutcome;
  outcomeSelector: string;
}

const drive = ({ journey, outcome, outcomeSelector, ...rest }: DriveInput): KeyboardDrive & { journey: JourneyId; result: KeyboardOutcome } => ({
  checkId: keyboardCheckId({ journey, outcome }),
  journey,
  result: outcome,
  ...rest,
  outcome: outcomeSelector,
});

const SETTLEMENT = 'aside[aria-label="Mock settlement case"]';
const RESERVATION = 'aside[aria-label="Mock reservation case"]';
const RESALE = 'aside[aria-label="Mock resale case"]';
const CREDIT = 'aside[aria-label="Mock credit case"]';
const CREDENTIAL = 'aside[aria-label="Admission credential"]';
const phaseIs = (panel: string, phase: string) => `${panel} dd:text-is("${phase}")`;
const steps = (panel: string, list: [string, string | null][]): KeyStep[] =>
  list.flatMap(([button, phase]) => [...press(button), ...(phase ? [wait(phaseIs(panel, phase))] : [])]);

/** Box office: open the nth event's settlement panel (0-based) and move the mock case to COMMITTED. */
const commitSettlement = (row: number): KeyStep[] => [
  tab(`button:text-is("Mock settlement") >> nth=${row}`), enter,
  ...steps(SETTLEMENT, [["Initiate mock case", "INITIATED"], ["Authorize mock phase", "AUTHORIZED"], ["Simulate CAPTURED phase", "CAPTURED"], ["Simulate COMMITTED phase", "COMMITTED"]]),
];
/** From the box office: Book, Place hold, Confirm booking, then the reservation panel through Issue. */
const bookAndIssue = (eventId: string): KeyStep[] => [
  ...pressId(`a[href="/booking/${eventId}"]`), wait("#booking-place"),
  ...pressId("#booking-place"), wait(':text("Hold hold_")'), ...press("Confirm booking"), wait(':text("Confirmed in the adapter")'),
  ...press("Register mock show"),
  ...steps(RESERVATION, [["Hold mock slot", "HELD"], ["Confirm mock order", "CONFIRMED"], ["Note simulated payment", "PAYMENT_NOTED"], ["Bind mock settlement", null], ["Issue mock right", "ISSUED"]]),
];
const confirmedStep = (panel: string, step: string) => `${panel} li.journey-step[data-status="confirmed"]:has(p:text-is("${step}"))`;
const giftDraft = (giftId: string): KeyStep[] => [...type("#gift-id", giftId), ...type("#gift-ticket-id", "tkt_1"), ...type("#gift-expected-version", "1"), ...type("#gift-expires-at", "4102444800")];
/** The form's spoken line after a refused submit. Blur checks fill the summary earlier without it. */
const REFUSED = '[data-validation-refused="true"]';
const phase = (value: string) => `[data-last-request][data-phase="${value}"]`;
const requestPhase = (value: string) => `[data-request-seq][data-request-phase="${value}"]`;

export const KEYBOARD_DRIVES = [
  // Box office (mock settlement case)
  drive({
    journey: "box-office", outcome: "SUCCESS", path: "/",
    setup: commitSettlement(0),
    trigger: press("Reconcile process-local"),
    outcomeSelector: `${SETTLEMENT} dd:text-is("Matched (process-local)")`,
    status: SETTLEMENT,
    focus: "TRIGGER",
  }),
  drive({
    journey: "box-office", outcome: "REJECT", path: "/",
    setup: [tab("button", "Mock settlement"), enter, ...steps(SETTLEMENT, [["Initiate mock case", "INITIATED"]])],
    trigger: press("Simulate COMMITTED phase"),
    outcomeSelector: `${SETTLEMENT} [role="alert"]`,
    focus: "TRIGGER",
    fence: `${SETTLEMENT} button:text-is("Simulate COMMITTED phase")`,
    refusal: { keys: [enter], holds: phaseIs(SETTLEMENT, "INITIATED") },
  }),
  // Booking
  drive({
    journey: "booking", outcome: "SUCCESS", path: "/booking/evt_lanterns",
    setup: [...pressId("#booking-place"), wait(':text("Hold hold_")'), ...press("Confirm booking"), wait(':text("Confirmed in the adapter")'),
      ...press("Send create_event"), wait(confirmedStep("", "create_event")), ...press("Send prepare_trade"), wait(confirmedStep("", "prepare_trade"))],
    trigger: press("Send accept_trade"),
    outcomeSelector: confirmedStep("", "accept_trade"),
    status: "li.journey-step",
    focus: "STATUS",
  }),
  drive({
    journey: "booking", outcome: "REJECT", path: "/booking/evt_lanterns",
    setup: type("#booking-quantity", "7"),
    trigger: pressId("#booking-place"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: "#booking-place",
    refusal: { keys: pressId("#booking-place"), holds: '#booking-place[aria-disabled="true"]' },
  }),
  // Admission
  drive({
    journey: "admission", outcome: "SUCCESS", path: "/",
    setup: [...commitSettlement(0), ...bookAndIssue("evt_lanterns"), ...navTo("/admission"), ...type("#admission-event", "evt_lanterns"), ...press("Load mock case"),
      ...press("Adopt issued mock credential"), wait(phaseIs(CREDENTIAL, "ELIGIBLE")), ...press("Authorize mock credential"), wait(phaseIs(CREDENTIAL, "AUTHORIZED"))],
    trigger: press("Consume mock credential once"),
    outcomeSelector: phaseIs(CREDENTIAL, "CONSUMED"),
    status: CREDENTIAL,
    focus: "TRIGGER",
  }),
  drive({
    journey: "admission", outcome: "REJECT", path: "/admission",
    setup: [...type("#admission-event", "evt_last_ferry"), ...press("Load mock case")],
    trigger: press("Adopt issued mock credential"),
    outcomeSelector: `${CREDENTIAL} [role="alert"]`,
    focus: "TRIGGER",
    fence: `${CREDENTIAL} button:text-is("Adopt issued mock credential")`,
    refusal: { keys: [enter], holds: `${CREDENTIAL} [role="alert"]` },
  }),
  // Resale
  drive({
    journey: "resale", outcome: "SUCCESS", path: "/",
    setup: [...commitSettlement(1), ...bookAndIssue("evt_paper_orchestra"), ...navTo("/resale"), ...pick('select:has(option[value="evt_paper_orchestra"])', "evt_paper_orchestra"),
      ...steps(RESALE, [["Adopt mock right", "ELIGIBLE"], ["List mock phase", "LISTED"], ["Hold mock buyer", "BUY_HELD"], ["Note simulated payment", "PAYMENT_NOTED"], ["Bind mock settlement", null]])],
    trigger: press("Accept mock transfer"),
    outcomeSelector: phaseIs(RESALE, "TRANSFERRED"),
    status: RESALE,
    focus: "TRIGGER",
  }),
  drive({
    journey: "resale", outcome: "REJECT", path: "/resale",
    setup: type("#resale-booking", "bkg_nope"),
    trigger: press("Open listing"),
    outcomeSelector: '[role="alert"]:has-text("Only a confirmed booking can be listed.")',
    focus: "TRIGGER",
    fence: 'button:text-is("Open listing")',
    refusal: { keys: [enter], holds: '[role="alert"]:has-text("Only a confirmed booking can be listed.")' },
  }),
  // Credit
  drive({
    journey: "credit", outcome: "SUCCESS", path: "/",
    setup: [...commitSettlement(1), ...navTo("/credit"), ...pick('select:has(option[value="evt_paper_orchestra"])', "evt_paper_orchestra"),
      ...steps(CREDIT, [["Offer mock phase", "OFFERED"], ["Approve mock phase", "APPROVED"], ["Bind mock settlement", null], ["Draw mock exposure", "DRAWN"]])],
    trigger: press("Note mock repayment"),
    outcomeSelector: `${CREDIT} dd:text-is("30000 mock units")`,
    status: CREDIT,
    focus: "TRIGGER",
  }),
  drive({
    journey: "credit", outcome: "REJECT", path: "/",
    setup: [...commitSettlement(1), ...navTo("/credit"), ...pick('select:has(option[value="evt_paper_orchestra"])', "evt_paper_orchestra"),
      ...steps(CREDIT, [["Offer mock phase", "OFFERED"], ["Approve mock phase", "APPROVED"], ["Bind mock settlement", null], ["Draw mock exposure", "DRAWN"]])],
    trigger: press("Close mock case"),
    outcomeSelector: `${CREDIT} [role="alert"]`,
    focus: "TRIGGER",
    fence: `${CREDIT} button:text-is("Close mock case")`,
    refusal: { keys: [enter], holds: phaseIs(CREDIT, "DRAWN") },
  }),
  // Gift
  drive({
    journey: "gift", outcome: "SUCCESS", path: "/gift",
    setup: [...giftDraft("gift_ok"), ...press("Send offer_gift"), wait(confirmedStep("aside.gift-panel", "offer_gift"))],
    trigger: press("Send accept_gift"),
    outcomeSelector: confirmedStep("aside.gift-panel", "accept_gift"),
    status: "aside.gift-panel li.journey-step",
    focus: "STATUS",
  }),
  drive({
    journey: "gift", outcome: "REJECT", path: "/gift",
    setup: type("#gift-id", "gift_blank"),
    trigger: press("Send offer_gift"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: "aside.gift-panel button[disabled]",
  }),
  // Organizer
  drive({
    journey: "organizer", outcome: "SUCCESS", path: "/organizer",
    setup: [...type("#organizer-event", "evt_org_1"), ...type("#organizer-seats", "A1,A2"),
      ...press("Send create_event"), wait(confirmedStep("aside.organizer-panel", "create_event")), ...press("Send close_sales"), wait(confirmedStep("aside.organizer-panel", "close_sales"))],
    trigger: press("Send open_admission"),
    outcomeSelector: confirmedStep("aside.organizer-panel", "open_admission"),
    status: "aside.organizer-panel li.journey-step",
    focus: "STATUS",
  }),
  drive({
    journey: "organizer", outcome: "REJECT", path: "/organizer",
    setup: type("#organizer-event", "evt_org_2"),
    trigger: press("Send create_event"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: 'aside.organizer-panel button:text-is("Send create_event")',
    refusal: { keys: press("Send create_event"), holds: 'aside.organizer-panel li.journey-step[data-status="ready"]:has(p:text-is("create_event"))' },
  }),
  // Receipts (read-only)
  drive({
    journey: "receipts", outcome: "SUCCESS", path: "/",
    setup: [...pressId('a[href="/booking/evt_lanterns"]'), wait("#booking-place"), ...press("Send create_event"), wait(':text("jrn:evt_lanterns:1:create_event")')],
    trigger: [tab('nav a[href="/receipts"]'), enter],
    outcomeSelector: "#receipt-timeline button[data-entry-id]",
    status: "#receipt-timeline",
    focus: "STATUS",
  }),
  drive({
    journey: "receipts", outcome: "REJECT", path: "/",
    setup: [],
    trigger: [tab('nav a[href="/receipts"]'), enter],
    outcomeSelector: "#receipt-timeline p.empty",
    status: "#receipt-timeline",
    focus: "STATUS",
    noWrite: [],
  }),
  // Buyer (read-only)
  drive({
    journey: "buyer", outcome: "SUCCESS", path: "/buyer",
    setup: [],
    trigger: press("North Station Lanterns"),
    outcomeSelector: '#buyer-shows button[aria-pressed="true"]',
    focus: "TRIGGER",
  }),
  drive({
    journey: "buyer", outcome: "REJECT", path: "/",
    setup: [],
    trigger: [tab('nav a[href="/buyer"]'), enter],
    outcomeSelector: "#buyer-evidence .empty",
    status: "#buyer-evidence",
    focus: "STATUS",
    noWrite: [],
  }),
  // Discovery (read-only)
  drive({
    journey: "discovery", outcome: "SUCCESS", path: "/discovery",
    setup: [...type("#discovery-q", "Lanterns"), wait('#discovery-results [role="option"]'), tab('#discovery-results [role="listbox"]')],
    trigger: [enter],
    outcomeSelector: "#discovery-detail",
    focus: "STATUS",
  }),
  drive({
    journey: "discovery", outcome: "REJECT", path: "/discovery",
    // To first, then the same From date: no partial year typed into From can pass To. ArrowUp on From's year then makes From later than To.
    setup: [...type("#discovery-to", "01012030"), { tabTo: "#discovery-from", forward: true }, { type: "01012030" },
      // Let the valid date range finish rendering before observing the separate conflicting ArrowUp outcome.
      wait('#discovery-results[data-state="empty"]')],
    trigger: [{ press: "ArrowUp" }],
    outcomeSelector: "#discovery-conflict",
    focus: "STATUS",
    noWrite: [],
  }),
  // Inventory (local selection)
  drive({
    journey: "inventory", outcome: "SUCCESS", path: "/inventory",
    setup: [...pressId('a[href^="/inventory?section="]'), tab('#inventory-page [role="listbox"]')],
    trigger: [enter],
    outcomeSelector: '[data-selected="true"]',
    focus: "TRIGGER",
  }),
  drive({
    journey: "inventory", outcome: "REJECT", path: "/inventory",
    setup: pick("#inventory-scenario", "queue-admitted"),
    trigger: [{ press: "ArrowDown" }],
    outcomeSelector: '[data-queue-state="lapsed"]',
    focus: "TRIGGER",
    noWrite: [],
  }),
  // Mobile
  drive({
    journey: "mobile", outcome: "SUCCESS", path: "/mobile",
    setup: [],
    trigger: pressId("#mobile-confirm-ord-0001"),
    outcomeSelector: '[data-outcome="CONFIRMED"]',
    status: "#mobile-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "mobile", outcome: "REJECT", path: "/mobile",
    setup: pick("#mobile-scenario", "update-available"),
    trigger: [{ press: "ArrowDown" }],
    outcomeSelector: '#mobile-confirm-ord-0001[aria-disabled="true"]',
    status: "#mobile-status",
    focus: "TRIGGER",
    fence: "#mobile-confirm-ord-0001",
  }),
  drive({
    journey: "mobile", outcome: "UNKNOWN", path: "/mobile",
    setup: pick("#mobile-scenario", "confirm-lost"),
    trigger: pressId("#mobile-confirm-ord-0001"),
    outcomeSelector: '[data-outcome="UNKNOWN"]',
    status: "#mobile-status",
    focus: "STATUS",
    fence: "#mobile-confirm-ord-0001",
  }),
  // Assistant
  drive({
    journey: "assistant", outcome: "SUCCESS", path: "/assistant",
    setup: [...type("#dlg-request-text", "draft an order for lst-0001"), ...pressId("#dlg-ask"), wait('button[id^="dlg-approve-"]'), tab('button[id^="dlg-approve-"]')],
    trigger: [enter],
    outcomeSelector: '[data-outcome="CONFIRMED"]',
    status: "#dlg-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "assistant", outcome: "REJECT", path: "/assistant",
    setup: pick("#dlg-scenario", "denied"),
    trigger: pressId("#dlg-apply-scenario"),
    outcomeSelector: '#dlg-status[data-delegation-state="denied"]',
    status: "#dlg-status",
    focus: "STATUS",
    fence: "#dlg-ask",
    refusal: { keys: pressId("#dlg-ask"), holds: '#dlg-status[data-delegation-state="denied"]' },
  }),
  drive({
    journey: "assistant", outcome: "UNKNOWN", path: "/assistant",
    setup: [...pick("#dlg-scenario", "draft-lost"), ...pressId("#dlg-apply-scenario"), wait('[data-scenario="draft-lost"]'),
      ...type("#dlg-request-text", "draft an order for lst-0001"), ...pressId("#dlg-ask"), wait('button[id^="dlg-approve-"]'), tab('button[id^="dlg-approve-"]')],
    trigger: [enter],
    outcomeSelector: '[data-outcome="UNKNOWN"]',
    status: "#dlg-status",
    focus: "STATUS",
    fence: 'button[id^="dlg-approve-"]',
  }),
  // Organizer workspace
  drive({
    journey: "organizer-workspace", outcome: "SUCCESS", path: "/organizer/workspace",
    setup: [...type("#organizer-ws-event-id", "evt_browser_workspace"), ...type("#organizer-ws-seats", "A1,A2"), ...press("Add to change list"), ...press("Prepare preview")],
    trigger: press("Submit"),
    outcomeSelector: '[data-result="RECEIPT"]',
    status: ".organizer-ws-results",
    focus: "STATUS",
  }),
  drive({
    journey: "organizer-workspace", outcome: "REJECT", path: "/organizer/workspace",
    setup: [],
    trigger: press("Add to change list"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: ".organizer-ws button[disabled]",
  }),
  // Merchant (read-only)
  drive({
    journey: "merchant", outcome: "SUCCESS", path: "/merchant",
    setup: [],
    trigger: pressId("#merchant-export"),
    outcomeSelector: '#merchant-export-panel[data-export-phase="loaded"]',
    status: "#merchant-export-panel",
    focus: "TRIGGER",
  }),
  drive({
    journey: "merchant", outcome: "REJECT", path: "/merchant",
    setup: pick("#merchant-scenario", "scope-leak"),
    trigger: [{ press: "ArrowDown" }],
    outcomeSelector: '#merchant-status[data-merchant-state="denied"]',
    status: "#merchant-status",
    focus: "TRIGGER",
    noWrite: [],
  }),
  // Finance
  drive({
    journey: "finance", outcome: "SUCCESS", path: "/finance",
    setup: [...pressId("#finance-propose-rcs-0001-link-observation"), wait(phase("applied")), ...pressId("#finance-refresh"),
      ...pick("#finance-actor", "finance-approver"), ...pressId("#finance-apply-actor"), wait("#finance-approve-prp-0001")],
    trigger: pressId("#finance-approve-prp-0001"),
    outcomeSelector: `${phase("applied")}:has-text("prp-0001")`,
    status: "#finance-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "finance", outcome: "REJECT", path: "/finance",
    setup: [...pick("#finance-scenario", "self-approval"), ...pressId("#finance-apply-scenario"), wait('[data-scenario="self-approval"]'),
      ...pick("#finance-actor", "finance-approver"), ...pressId("#finance-apply-actor"), wait("#finance-approve-prp-0001")],
    trigger: pressId("#finance-approve-prp-0001"),
    outcomeSelector: phase("rejected"),
    status: "#finance-status",
    focus: "STATUS",
    fence: "#finance-approve-prp-0001",
  }),
  drive({
    journey: "finance", outcome: "UNKNOWN", path: "/finance",
    setup: [...pick("#finance-scenario", "act-lost"), ...pressId("#finance-apply-scenario"), wait('[data-scenario="act-lost"]')],
    trigger: pressId("#finance-propose-rcs-0001-link-observation"),
    outcomeSelector: phase("unknown"),
    status: "#finance-status",
    focus: "STATUS",
    fence: "#finance-propose-rcs-0001-link-observation",
  }),
  // Provider
  drive({
    journey: "provider", outcome: "SUCCESS", path: "/provider",
    setup: [...pressId("#provider-begin-ord-0001"), ...pressId("#provider-event-return-ord-0001"), ...pressId("#provider-event-callback-ord-0001"), ...pressId("#provider-observe-ord-0001")],
    trigger: pressId("#provider-issue-ord-0001"),
    outcomeSelector: '[data-outcome="CONFIRMED"] >> nth=2',
    status: "#provider-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "provider", outcome: "REJECT", path: "/provider",
    setup: [...pick("#provider-scenario", "declined"), ...pressId("#provider-begin-ord-0001"), ...pressId("#provider-event-return-ord-0001"), ...pressId("#provider-event-callback-ord-0001")],
    trigger: pressId("#provider-observe-ord-0001"),
    outcomeSelector: '[data-outcome="REJECTED"]',
    status: "#provider-status",
    focus: "STATUS",
    fence: "#provider-issue-ord-0001",
  }),
  drive({
    journey: "provider", outcome: "UNKNOWN", path: "/provider",
    setup: [...pick("#provider-scenario", "observe-lost"), ...pressId("#provider-begin-ord-0001"), ...pressId("#provider-event-return-ord-0001"), ...pressId("#provider-event-callback-ord-0001")],
    trigger: pressId("#provider-observe-ord-0001"),
    outcomeSelector: '[data-outcome="UNKNOWN"]',
    status: "#provider-status",
    focus: "STATUS",
    fence: "#provider-observe-ord-0001",
  }),
  // Credit origination
  drive({
    journey: "credit-origination", outcome: "SUCCESS", path: "/credit/origination",
    setup: [],
    trigger: pressId("#origination-submit"),
    outcomeSelector: phase("applied"),
    status: "#origination-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "credit-origination", outcome: "REJECT", path: "/credit/origination",
    setup: pick("#origination-scenario", "limit-race"),
    trigger: pressId("#origination-drawdown"),
    outcomeSelector: phase("rejected"),
    status: "#origination-status",
    focus: "STATUS",
    fence: "#origination-drawdown",
  }),
  drive({
    journey: "credit-origination", outcome: "UNKNOWN", path: "/credit/origination",
    setup: pick("#origination-scenario", "act-lost"),
    trigger: pressId("#origination-submit"),
    outcomeSelector: phase("unknown"),
    status: "#origination-status",
    focus: "STATUS",
    fence: "#origination-submit",
  }),
  // Credit servicing
  drive({
    journey: "credit-servicing", outcome: "SUCCESS", path: "/credit/servicing",
    setup: [...pressId("#servicing-propose-adjustment"), wait(phase("applied")), ...pressId("#servicing-refresh"), ...pressId("#servicing-switch-actor"), ...pressId("#servicing-refresh"), wait("#servicing-approve-prp-0002")],
    trigger: pressId("#servicing-approve-prp-0002"),
    outcomeSelector: `${phase("applied")}:has-text("prp-0002")`,
    status: "#servicing-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "credit-servicing", outcome: "REJECT", path: "/credit/servicing",
    setup: pick("#servicing-scenario", "scope-leak"),
    trigger: [{ press: "ArrowDown" }],
    outcomeSelector: '#servicing-status[data-servicing-state="denied"]',
    status: "#servicing-status",
    focus: "TRIGGER",
    fence: "#servicing-propose-adjustment",
  }),
  drive({
    journey: "credit-servicing", outcome: "UNKNOWN", path: "/credit/servicing",
    setup: pick("#servicing-scenario", "act-lost"),
    trigger: pressId("#servicing-propose-adjustment"),
    outcomeSelector: phase("unknown"),
    status: "#servicing-status",
    focus: "STATUS",
    fence: "#servicing-propose-adjustment",
  }),
  // Marketing hub
  drive({
    journey: "marketing", outcome: "SUCCESS", path: "/marketing",
    setup: [...pressId('a.hub-card[href="/marketing/m01"]'), wait("#membership-name")],
    trigger: [tab('main a[href="/marketing"]'), enter],
    outcomeSelector: "#marketing-session-facts",
    status: "#marketing-session-facts",
    focus: "STATUS",
  }),
  drive({
    journey: "marketing", outcome: "REJECT", path: "/marketing",
    setup: [...pressId('a.hub-card[href="/marketing/m01"]'), ...type("#membership-name", "Hub fan"), ...press("Issue demo card"), wait('main h3:text-is("Hub fan")'),
      ...pressId('main a[href="/marketing"]'), wait("#marketing-session-facts"),
      // Finish the preceding navigation announcement before measuring the Reset action.
      wait('[data-route-note]:text-is("KIX Marketing")')],
    trigger: press("Reset marketing session"),
    outcomeSelector: '#marketing-session-facts dd:text-is("guest")',
    status: "#marketing-session-facts",
    focus: "TRIGGER",
    fence: 'button:text-is("Reset marketing session")',
    refusal: { keys: [enter], holds: '#marketing-session-facts dd:text-is("guest")' },
  }),
  // Marketing benefit journey
  drive({
    journey: "marketing-journey", outcome: "SUCCESS", path: "/marketing/journey",
    setup: [],
    trigger: pressId("#mkj-apply-ben-0002-ord-0001"),
    outcomeSelector: '[data-outcome="CONFIRMED"]',
    status: "#mkj-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "marketing-journey", outcome: "REJECT", path: "/marketing/journey",
    setup: pick("#mkj-scenario", "usage-limit"),
    trigger: pressId("#mkj-apply-scenario"),
    outcomeSelector: '#mkj-apply-ben-0002-ord-0001[aria-disabled="true"]',
    status: "#mkj-status",
    focus: "TRIGGER",
    fence: "#mkj-apply-ben-0002-ord-0001",
    refusal: { keys: pressId("#mkj-apply-ben-0002-ord-0001"), holds: '#mkj-apply-ben-0002-ord-0001[aria-disabled="true"]' },
  }),
  drive({
    journey: "marketing-journey", outcome: "UNKNOWN", path: "/marketing/journey",
    setup: [...pick("#mkj-scenario", "apply-lost"), ...pressId("#mkj-apply-scenario"), wait('[data-scenario="apply-lost"]')],
    trigger: pressId("#mkj-apply-ben-0002-ord-0001"),
    outcomeSelector: '[data-outcome="UNKNOWN"]',
    status: "#mkj-status",
    focus: "STATUS",
    fence: "#mkj-apply-ben-0002-ord-0001",
  }),
  // Platform
  drive({
    journey: "platform", outcome: "SUCCESS", path: "/platform",
    setup: [...pressId("#platform-book-lst-0001"), wait('[id^="platform-transfer-trd-"]')],
    trigger: pressId('[id^="platform-transfer-trd-"]'),
    outcomeSelector: '[data-outcome="CONFIRMED"] >> nth=1',
    status: "#platform-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "platform", outcome: "REJECT", path: "/platform",
    setup: [...pick("#platform-scenario", "rival-channel"), ...pressId("#platform-book-lst-0001"), wait('[id^="platform-transfer-trd-"]')],
    trigger: pressId('[id^="platform-transfer-trd-"]'),
    outcomeSelector: '[data-outcome="REJECTED"]',
    status: "#platform-status",
    focus: "STATUS",
    fence: "#platform-transfer-trd-0001",
    refusal: { keys: pressId("#platform-transfer-trd-0001"), holds: '[data-outcome="REJECTED"]' },
  }),
  drive({
    journey: "platform", outcome: "UNKNOWN", path: "/platform",
    setup: pick("#platform-scenario", "payment-lost"),
    trigger: pressId("#platform-book-lst-0001"),
    outcomeSelector: '[data-shape="payment-unknown"]',
    status: "#platform-status",
    focus: "TRIGGER",
    fence: 'button[id^="platform-transfer-"]',
  }),
  // Marketplace bench (read-only)
  drive({
    journey: "marketplace-performance", outcome: "SUCCESS", path: "/marketplace-performance",
    setup: [],
    trigger: pressId("#mperf-next"),
    outcomeSelector: "#mperf-window [data-sequence=\"51\"]",
    status: "#mperf-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "marketplace-performance", outcome: "REJECT", path: "/marketplace-performance",
    setup: pick("#mperf-scenario", "read-lost"),
    trigger: [{ press: "ArrowDown" }],
    outcomeSelector: '#mperf-status:has-text("refused")',
    status: "#mperf-status",
    focus: "TRIGGER",
    noWrite: [],
  }),
  // Permissions
  drive({
    journey: "permissions", outcome: "SUCCESS", path: "/permissions",
    setup: [...pick("#tenant-actor", "person-settler"), ...pressId("#tenant-apply-actor"), ...pick("#tenant-role", "settler"), ...pressId("#tenant-apply-role"), wait("#tenant-account-acc-0001")],
    trigger: pressId("#tenant-account-acc-0001"),
    outcomeSelector: requestPhase("applied"),
    status: "#tenant-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "permissions", outcome: "REJECT", path: "/permissions",
    setup: pick("#tenant-scenario", "denied"),
    trigger: pressId("#tenant-apply-scenario"),
    outcomeSelector: '#tenant-status[data-tenant-state="denied"]',
    status: "#tenant-status",
    focus: "STATUS",
    noWrite: ['button[id^="tenant-account-"]'],
  }),
  drive({
    journey: "permissions", outcome: "UNKNOWN", path: "/permissions",
    setup: [...pick("#tenant-scenario", "act-lost"), ...pressId("#tenant-apply-scenario"), wait('[data-scenario="act-lost"]'),
      ...pick("#tenant-actor", "person-settler"), ...pressId("#tenant-apply-actor"), ...pick("#tenant-role", "settler"), ...pressId("#tenant-apply-role"), wait("#tenant-account-acc-0001")],
    trigger: pressId("#tenant-account-acc-0001"),
    outcomeSelector: requestPhase("unknown"),
    status: "#tenant-status",
    focus: "STATUS",
    fence: "#tenant-account-acc-0001",
  }),
  // Notifications
  drive({
    journey: "notifications", outcome: "SUCCESS", path: "/notifications",
    setup: [],
    trigger: pressId("#notify-mark-ntf-0001"),
    outcomeSelector: requestPhase("applied"),
    status: "#notify-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "notifications", outcome: "REJECT", path: "/notifications",
    setup: pick("#notify-scenario", "denied"),
    trigger: pressId("#notify-apply-scenario"),
    outcomeSelector: '#notify-status[data-notify-state="denied"]',
    status: "#notify-status",
    focus: "STATUS",
    noWrite: ['button[id^="notify-mark-"]', 'button[id^="notify-resolve-"]'],
  }),
  drive({
    journey: "notifications", outcome: "UNKNOWN", path: "/notifications",
    setup: [...pick("#notify-scenario", "act-lost"), ...pressId("#notify-apply-scenario"), wait('[data-scenario="act-lost"]')],
    trigger: pressId("#notify-mark-ntf-0001"),
    outcomeSelector: requestPhase("unknown"),
    status: "#notify-status",
    focus: "STATUS",
    fence: "#notify-mark-ntf-0001",
  }),
  // Journey context (identity)
  drive({
    journey: "identity", outcome: "SUCCESS", path: "/identity",
    setup: [],
    trigger: pressId("#attach-obs-0001"),
    outcomeSelector: 'li[data-outcome="CONFIRMED"]',
    status: "#identity-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "identity", outcome: "REJECT", path: "/identity",
    setup: pick("main select", "foreign-mix"),
    trigger: press("Apply this scenario"),
    outcomeSelector: 'tr[data-verdict="foreign"]',
    status: "#identity-status",
    focus: "STATUS",
    fence: 'tr[data-verdict="foreign"] button[aria-disabled="true"]',
  }),
  drive({
    journey: "identity", outcome: "UNKNOWN", path: "/identity",
    setup: [...pick("main select", "attach-lost"), ...press("Apply this scenario"), wait("#identity-status:focus")],
    trigger: pressId("#attach-obs-0001"),
    outcomeSelector: 'li[data-outcome="UNKNOWN"]',
    status: "#identity-status",
    focus: "STATUS",
    fence: "#attach-obs-0001",
  }),
  // Session recovery
  drive({
    journey: "session", outcome: "SUCCESS", path: "/session",
    setup: [],
    trigger: pressId("#session-attach-obs-0001"),
    outcomeSelector: 'li[data-kind="this-load"][data-outcome="CONFIRMED"]',
    status: "#session-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "session", outcome: "REJECT", path: "/session",
    // UNKNOWN is setup. The measured outcome is the next activation being refused before sending.
    setup: [...pick("main select", "attach-lost"), ...press("Start new source with this scenario"),
      ...pressId("#session-attach-obs-0001"), wait('li[data-kind="unknown"]'), wait('#session-status[aria-busy="false"]')],
    trigger: pressId("#session-attach-obs-0001"),
    outcomeSelector: '#session-status [data-field="last"]:has-text("Attach not sent.")',
    terminal: ['li[data-kind="unknown"]', '#session-status:has-text("Sent 1 in this load. Blocked before sending 1.")'],
    absentAfter: ['li[data-outcome="CONFIRMED"]', 'li[data-outcome="REJECTED"]', 'li[data-outcome="IN_FLIGHT"]'],
    status: "#session-status",
    focus: "STATUS",
    fence: "#session-attach-obs-0001",
  }),
  drive({
    journey: "session", outcome: "UNKNOWN", path: "/session",
    setup: [...pick("main select", "attach-lost"), ...press("Start new source with this scenario")],
    trigger: pressId("#session-attach-obs-0001"),
    outcomeSelector: 'li[data-kind="unknown"]',
    status: "#session-status",
    focus: "STATUS",
    fence: "#session-attach-obs-0001",
  }),
  // Journeys table
  drive({
    journey: "journeys", outcome: "SUCCESS", path: "/journeys",
    setup: pick("#xs-filter-journey", "purchase-booking"),
    trigger: pressId("#xs-apply-filter"),
    outcomeSelector: '#xs-status [data-last-action]:has-text("Filter applied")',
    status: "#xs-status",
    focus: "TRIGGER",
  }),
  drive({
    journey: "journeys", outcome: "REJECT", path: "/journeys",
    setup: pick("#xs-scenario", "claims-pass"),
    trigger: pressId("#xs-apply-scenario"),
    outcomeSelector: '#xs-status:has-text("refused")',
    status: "#xs-status",
    focus: "TRIGGER",
    noWrite: [],
  }),
  drive({
    journey: "journeys", outcome: "UNKNOWN", path: "/journeys",
    setup: pick("#xs-filter-status", "unknown"),
    trigger: pressId("#xs-apply-filter"),
    outcomeSelector: '#xs-status [data-last-action]:has-text("Filter applied")',
    terminal: ['table[aria-label="Cross-surface journeys"] tbody tr[data-status="unknown"]'],
    absentAfter: ['table[aria-label="Cross-surface journeys"] tbody tr:not([data-status="unknown"])'],
    status: "#xs-status",
    focus: "TRIGGER",
    noWrite: [],
  }),
  // Qualification and release
  ...(["oq", "rel"] as const).flatMap((prefix) => {
    const journey: JourneyId = prefix === "oq" ? "qualification" : "release";
    const path = prefix === "oq" ? "/qualification" : "/release";
    return [
      drive({
        journey, outcome: "SUCCESS", path,
        setup: [],
        trigger: pressId(`#${prefix}-run`),
        outcomeSelector: `#${prefix}-status [data-run-state="ready"]`,
        status: `#${prefix}-status`,
        focus: "TRIGGER",
      }),
      drive({
        journey, outcome: "REJECT", path,
        setup: pick(`#${prefix}-scenario`, "claims-pass"),
        trigger: pressId(`#${prefix}-run`),
        outcomeSelector: `#${prefix}-status [data-run-state="unknown"]`,
        status: `#${prefix}-status`,
        focus: "STATUS",
        fence: `#${prefix}-run`,
      }),
      drive({
        journey, outcome: "UNKNOWN", path,
        setup: [...pick(`#${prefix}-scenario`, "read-lost"), ...pressId(`#${prefix}-run`), wait(`#${prefix}-status [data-run-state="in-flight"]`)],
        trigger: pressId(`#${prefix}-switch-actor`),
        outcomeSelector: `#${prefix}-session:has-text("CONTEXT_SWITCHED")`,
        status: `#${prefix}-status`,
        focus: "TRIGGER",
        fence: `#${prefix}-run`,
      }),
    ];
  }),
  // Marketing M01 to M05
  drive({
    journey: "marketing-m01", outcome: "SUCCESS", path: "/marketing/m01",
    setup: type("#membership-name", "Browser fan"),
    trigger: press("Issue demo card"),
    outcomeSelector: 'main :text("Browser fan")',
    status: "main",
    focus: "TRIGGER",
  }),
  drive({
    journey: "marketing-m01", outcome: "REJECT", path: "/marketing/m01",
    setup: [],
    trigger: press("Issue demo card"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: 'main button:text-is("Clear demo card")',
  }),
  drive({
    journey: "marketing-m02", outcome: "SUCCESS", path: "/marketing/m01",
    setup: [...type("#membership-name", "Browser member"), ...pick("#membership-form select", "member"), ...press("Issue demo card"), wait('main :text("Browser member")'),
      ...pressId('main a[href="/marketing/m02"]'), wait(".program button")],
    trigger: press("Record demo interest"),
    outcomeSelector: '.program [id^="m02-interest-"] p',
    status: '.program [id^="m02-interest-"]',
    focus: "STATUS",
  }),
  drive({
    journey: "marketing-m02", outcome: "REJECT", path: "/marketing",
    setup: [],
    trigger: [tab('a.hub-card[href="/marketing/m02"]'), enter],
    outcomeSelector: ".program li button[disabled]",
    status: "#m02-window-note",
    focus: "STATUS",
    fence: ".program li button",
  }),
  drive({
    journey: "marketing-m03", outcome: "SUCCESS", path: "/marketing/m03",
    setup: type("#coupon-code", "LANTERN-NOTE"),
    trigger: press("Apply demo code"),
    outcomeSelector: 'main [data-coupon-state="valid"]',
    status: "main",
    focus: "TRIGGER",
  }),
  drive({
    journey: "marketing-m03", outcome: "REJECT", path: "/marketing/m03",
    setup: type("#coupon-code", "NOT-A-FIXTURE"),
    trigger: press("Apply demo code"),
    outcomeSelector: 'main [role="alert"]',
    focus: "TRIGGER",
    fence: '#coupon-form button[type="submit"]',
    refusal: { keys: [enter], holds: 'main [role="alert"]' },
  }),
  drive({
    journey: "marketing-m04", outcome: "SUCCESS", path: "/marketing/m04",
    setup: type("#referral-code", "REF-STUB-HALL"),
    trigger: press("Count demo marker"),
    outcomeSelector: 'main p.panel:has-text("REF-STUB-HALL")',
    status: "main",
    focus: "TRIGGER",
  }),
  drive({
    journey: "marketing-m04", outcome: "REJECT", path: "/marketing/m04",
    setup: type("#referral-code", "NOT-A-FIXTURE"),
    trigger: press("Count demo marker"),
    outcomeSelector: 'main [role="alert"]',
    focus: "TRIGGER",
    fence: '#referral-form button[type="submit"]',
    refusal: { keys: [enter], holds: 'main [role="alert"]' },
  }),
  drive({
    journey: "marketing-m05", outcome: "SUCCESS", path: "/marketing/m05",
    setup: [tab("#performance-notes"), { press: "Space" }, ...press("Save consent flags"),
      ...type("#consent-event", "evt_browser_consent"), ...type("#consent-subject", "subject-fixture"), ...type("#consent-business", "business-fixture"),
      ...type("#consent-channel", "fixture-channel"), ...type("#consent-purpose", "fixture-purpose"), ...type("#consent-version", "1"), ...pick("#consent-allowed", "true"),
      ...press("Send set_consent"), wait(confirmedStep("main", "set_consent"))],
    trigger: press("Send authorize_marketing"),
    outcomeSelector: confirmedStep("main", "authorize_marketing"),
    status: "main li.journey-step",
    focus: "STATUS",
  }),
  drive({
    journey: "marketing-m05", outcome: "REJECT", path: "/marketing/m05",
    setup: type("#consent-event", "evt_incomplete"),
    trigger: press("Send set_consent"),
    outcomeSelector: REFUSED,
    status: ".error-summary",
    focus: "STATUS",
    fence: 'main li.journey-step button:text-is("Send set_consent")',
    refusal: { keys: press("Send set_consent"), holds: 'main li.journey-step button:text-is("Send set_consent")[aria-disabled="true"]' },
  }),
];
