// Selected from resale_session.json, resale_requests.jsonl and resale_console_cancel.txt.
// The two clock steps are identical to #145. The offer lookup and settlement tail stay local.
const show = {
  show_id: "show-1", organizer_role: "organizer", capacity: 2, gate_roles: ["gate-a", "gate-b"],
  primary_price: 10001, resale_cap: 20000, resale_allowed: true, organizer_bps: 1, platform_bps: 1,
} as const;
const hold = { reservation_id: "reserve-1", show_id: show.show_id, slot: 0, buyer_role: "buyer-1", expires_ms: 1120000 };
const order = { reservation_id: hold.reservation_id, order_id: "order-1", amount: show.primary_price, quote_ref: "quote-1" };
const primaryPayment = { order_id: order.order_id, payment_ref: "ab".repeat(32), amount: order.amount };
const right = { right_id: "issue-1", version: 1 };
const listing = { listing_id: "list-1", ...right, reservation_id: hold.reservation_id, seller_role: hold.buyer_role,
  recipient_role: "buyer-2", amount: 8000, expires_ms: 1120000 };
const buyer = { listing_id: listing.listing_id, buyer_role: listing.recipient_role };
const payment = { ...buyer, amount: listing.amount, payment_ref: "cd".repeat(32) };
const subject = { "listing.listing_id": listing.listing_id, "listing.right_id": right.right_id, "right.right_id": right.right_id,
  "listing.amount": listing.amount, "listing.seller_role": listing.seller_role, "listing.recipient_role": listing.recipient_role,
  "listing.settlement_id": null, "listing.settlement_gate": "UNBOUND", "listing.mock_settlement_commit_observed": false };
export const MARKET_FIXTURE = {
  "market-show": ["reservation_register_show", show, { "show.show_id": show.show_id }],
  "market-reserve": ["reservation_hold", hold, { "reservation.reservation_id": hold.reservation_id, "reservation.phase": "HELD" }],
  "market-order": ["reservation_confirm", order, { "reservation.phase": "CONFIRMED", "reservation.order_id": order.order_id,
    "reservation.amount": order.amount, "reservation.quote_ref": order.quote_ref }],
  "market-primary-payment": ["reservation_observe_payment", primaryPayment, { "reservation.phase": "PAYMENT_NOTED",
    "reservation.payment_ref": primaryPayment.payment_ref }],
  "market-issue": ["reservation_issue", { issuance_id: right.right_id, order_id: order.order_id }, { "reservation.phase": "ISSUED",
    "evidence.right_id": right.right_id, "evidence.version": right.version, "evidence.holder_role": hold.buyer_role }],
  "market-adopt": ["resale_adopt_issued", { ...show, ...hold, ...order, ...primaryPayment, right_id: right.right_id },
    { "ticket.right_id": right.right_id, "ticket.version": right.version, "ticket.holder_role": hold.buyer_role,
      "ticket.reservation_id": hold.reservation_id, "ticket.eligible": true }],
  "market-list": ["resale_list_resale", listing, { ...subject, "listing.phase": "LISTED", "listing.version": right.version,
    "listing.attached": true, "listing.payment_ref": null, "listing.ownership_transferred": false }],
  "market-hold": ["resale_hold_buy", { ...buyer, hold_id: "buy-hold" }, { ...subject, "listing.phase": "BUY_HELD",
    "listing.hold_id": "buy-hold", "listing.buyer_role": buyer.buyer_role, "listing.payment_ref": null }],
  "market-pay": ["resale_observe_resale_payment", payment, { ...subject, "listing.phase": "PAYMENT_NOTED",
    "listing.buyer_role": buyer.buyer_role, "listing.payment_ref": payment.payment_ref, "listing.ownership_transferred": false }],
  "market-accept": ["resale_accept_resale", { listing_id: listing.listing_id, transfer_id: "transfer-1" }, { ...subject,
    "listing.phase": "TRANSFERRED", "listing.transfer_id": "transfer-1", "listing.version_after": 2, "listing.ownership_transferred": true,
    "listing.holder_role": buyer.buyer_role, "right.holder_role": buyer.buyer_role,
    "right.version": 2, "evidence.transfer_id": "transfer-1", "evidence.right_id": right.right_id,
    "evidence.from_role": listing.seller_role, "evidence.to_role": buyer.buyer_role, "evidence.version_after": 2,
    "listing.payment_ref": payment.payment_ref, "evidence.amount": listing.amount, "evidence.payment_ref": payment.payment_ref,
    "evidence.chain_owner_current": false, "evidence.funds_executed": false }],
  "market-cancel": ["resale_cancel_listing", { listing_id: listing.listing_id, seller_role: listing.seller_role },
    { ...subject, "listing.phase": "CANCELLED", "listing.terminal": true, "listing.attached": false,
      "listing.ownership_transferred": false, "listing.payment_ref": null }],
} as const;

export const MARKET_STEPS = ["reservation-clock", "market-show", "resale-clock", "market-reserve", "market-order",
  "market-primary-payment", "market-issue", "market-adopt", "market-list", "market-hold", "market-pay", "market-accept"] as const;
export type MarketStep = (typeof MARKET_STEPS)[number] | "market-cancel";


// Preview the same fixture fields the command builder will require confirmed links to match.
export function marketPreview(step: MarketStep) {
  if (step === "reservation-clock" || step === "resale-clock") return {
    action: step === "resale-clock" ? "resale_set_clock" : "reservation_set_clock", fields: [["now_ms", "1000000"]],
  };
  const [action, body] = MARKET_FIXTURE[step];
  const fields = Object.entries(body).filter(([key]) => ["show_id", "reservation_id", "order_id", "issuance_id",
    "right_id", "version", "listing_id", "hold_id", "transfer_id", "seller_role", "recipient_role", "buyer_role", "amount"].includes(key));
  return { action, fields };
}
