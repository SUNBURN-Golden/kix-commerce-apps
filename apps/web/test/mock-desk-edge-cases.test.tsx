// @vitest-environment jsdom
import { MemoryRouter } from "react-router-dom";
import { BoxOfficePage } from "../src/pages/BoxOffice";
import { button, click } from "./support/render-dom";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { StubProtocolAdapter } from "@kix/protocol-adapter";
import { protocol } from "../src/connectivity/desk-protocol";
import { useCreditDesk } from "../src/credit-desk";
import { useResaleDesk } from "../src/resale-desk";
import { renderDom } from "./support/render-dom";

vi.mock("../src/protocol", async () => {
  const { StubProtocolAdapter } = await import("@kix/protocol-adapter");
  return { protocol: new StubProtocolAdapter() };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

for (const desk of ["credit", "resale"] as const) {
  const useDesk = desk === "credit" ? useCreditDesk : useResaleDesk;
  describe(`${desk} mock desk activation`, () => {
    it("dispatches once for same-render duplicate activation and remains guarded while pending", async () => {
      const held = deferred<never>();
      const send = desk === "credit"
        ? vi.spyOn(protocol, "offerCredit").mockImplementation(() => held.promise)
        : vi.spyOn(protocol, "adoptResaleIssued").mockImplementation(() => held.promise);
      let model!: ReturnType<typeof useCreditDesk> | ReturnType<typeof useResaleDesk>;
      function Harness() {
        model = useDesk("duplicate");
        return <output>{String(model.pending)}</output>;
      }
      await renderDom(<Harness />);
      const activate = () => desk === "credit"
        ? (model as ReturnType<typeof useCreditDesk>).run("offer")
        : (model as ReturnType<typeof useResaleDesk>).run("adopt");
      let first!: Promise<void>;
      await act(async () => { first = activate(); void activate(); });
      expect(send).toHaveBeenCalledTimes(1);
      expect(model.pending).toBe(true);
      await act(async () => { await activate(); });
      expect(send).toHaveBeenCalledTimes(1);
      await act(async () => { held.reject(new Error("FIXTURE_DECLINE")); await first; });
      expect(model.pending).toBe(false);
      expect(model.error).toBe("FIXTURE_DECLINE");
      // A new explicit local activation uses a new attempt; no automatic resend.
      expect(send.mock.calls[0]?.[0].idempotencyKey).toMatch(/:0$/);
      await act(async () => { await activate(); });
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1]?.[0].idempotencyKey).toMatch(/:1$/);
    });
  });
}

it("credit ignores an old case read after switching events, including A to B to A", async () => {
  const fixture = new StubProtocolAdapter();
  const offered = await fixture.offerCredit({ advanceId: "adv_a", claimId: "claim-a", openFace: 100_000,
    amount: 80_000, beneficiaryRole: "fixture", idempotencyKey: "offer" });
  const approved = await fixture.approveCredit({ advanceId: "adv_a", idempotencyKey: "approve" });
  const old = deferred<typeof offered.credit>();
  vi.spyOn(protocol, "viewCredit").mockImplementationOnce(() => old.promise)
    .mockRejectedValueOnce(new Error("old B read"))
    .mockResolvedValue(approved.credit);
  let model!: ReturnType<typeof useCreditDesk>;
  function Harness({ event }: { event: string }) { model = useCreditDesk(event); return null; }
  const mount = await renderDom(<Harness event="a" />);
  await mount.rerender(<Harness event="b" />);
  await mount.rerender(<Harness event="a" />);
  expect(model.view?.phase).toBe("APPROVED");
  await act(async () => { old.resolve(offered.credit); });
  expect(model.view?.phase).toBe("APPROVED");
  expect(model.error).toBeNull();
});

it("resale ignores an old right and listing read after switching events", async () => {
  const fixture = new StubProtocolAdapter();
  const adopted = await fixture.adoptResaleIssued({ rightId: "iss_a", showId: "show_a", eventId: "a", slot: "slot",
    holderRole: "seller", reservationId: null, paymentRef: "issued", idempotencyKey: "adopt" });
  const old = deferred<NonNullable<typeof adopted.right>>();
  vi.spyOn(protocol, "viewResaleRight").mockImplementationOnce(() => old.promise);
  let model!: ReturnType<typeof useResaleDesk>;
  function Harness({ event }: { event: string }) { model = useResaleDesk(event); return null; }
  const mount = await renderDom(<Harness event="a" />);
  await mount.rerender(<Harness event="b" />);
  await act(async () => { old.resolve(adopted.right!); });
  expect(model.right).toBeNull();
  expect(model.view).toBeNull();
  expect(model.error).toBeNull();
});

for (const desk of ["credit", "resale"] as const) {
  const useDesk = desk === "credit" ? useCreditDesk : useResaleDesk;
  it(`${desk} late rejection cannot clear another event's pending operation or error`, async () => {
    const old = deferred<never>();
    const active = deferred<never>();
    const send = desk === "credit"
      ? vi.spyOn(protocol, "offerCredit").mockImplementationOnce(() => old.promise).mockImplementationOnce(() => active.promise)
      : vi.spyOn(protocol, "adoptResaleIssued").mockImplementationOnce(() => old.promise).mockImplementationOnce(() => active.promise);
    let model!: ReturnType<typeof useCreditDesk> | ReturnType<typeof useResaleDesk>;
    function Harness({ event }: { event: string }) {
      model = useDesk(event);
      return null;
    }
    const activate = () => desk === "credit"
      ? (model as ReturnType<typeof useCreditDesk>).run("offer")
      : (model as ReturnType<typeof useResaleDesk>).run("adopt");
    const mount = await renderDom(<Harness event="old" />);
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => { first = activate(); });
    await mount.rerender(<Harness event="active" />);
    await act(async () => { second = activate(); });
    await act(async () => { old.reject(new Error("OLD_REJECTION")); await first; });
    expect(model.pending).toBe(true);
    expect(model.error).toBeNull();
    expect(sessionStorage.getItem(`kix-${desk}-attempt:old`)).toBe("1");
    expect(sessionStorage.getItem(`kix-${desk}-attempt:active`)).toBeNull();
    await act(async () => { await activate(); });
    expect(send).toHaveBeenCalledTimes(2);
    await act(async () => { active.reject(new Error("ACTIVE_REJECTION")); await second; });
    expect(model.pending).toBe(false);
    expect(model.error).toBe("ACTIVE_REJECTION");
  });
}


it("box office dispatches once for same-render duplicate activation", async () => {
  const held = deferred<never>();
  const send = vi.spyOn(protocol, "initiateSettlement").mockImplementation(() => held.promise);
  const { container } = await renderDom(<MemoryRouter><BoxOfficePage /></MemoryRouter>);
  await click(button(container, "Mock settlement"));
  const initiate = button(container, "Initiate mock case");
  await act(async () => { initiate.click(); initiate.click(); });
  expect(send).toHaveBeenCalledTimes(1);
  expect(initiate.disabled).toBe(true);
  await click(initiate);
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { held.reject(new Error("FIXTURE_DECLINE")); });
  expect(container.textContent).toContain("FIXTURE_DECLINE");
});

it("box office ignores the old selection read when a newer selection completes first", async () => {
  const fixture = new StubProtocolAdapter();
  const receipt = await fixture.initiateSettlement({ settlementId: "stl_evt_lanterns", eventId: "evt_lanterns", idempotencyKey: "init" });
  const held = deferred<typeof receipt.settlement>();
  vi.spyOn(protocol, "viewSettlement").mockImplementationOnce(() => held.promise);
  const { container } = await renderDom(<MemoryRouter><BoxOfficePage /></MemoryRouter>);
  const open = Array.from(container.querySelectorAll("button")).filter((node) => node.textContent === "Mock settlement");
  await click(open[0]!);
  await click(open[1]!);
  await act(async () => { held.resolve(receipt.settlement); });
  const panel = container.querySelector('aside[aria-label="Mock settlement case"]');
  expect(panel?.textContent).not.toContain("stl_evt_lanterns");
  expect(panel?.textContent).not.toContain("INITIATED");
});


it("resale ignores a delayed listing read even when its right read completed before the switch", async () => {
  const fixture = new StubProtocolAdapter();
  const adopted = await fixture.adoptResaleIssued({ rightId: "iss_listing_a", showId: "show_a", eventId: "a", slot: "slot",
    holderRole: "seller", reservationId: null, paymentRef: "issued", idempotencyKey: "adopt" });
  const listed = await fixture.listResaleCase({ listingId: "rsl_listing_a", rightId: "iss_listing_a", version: 1,
    sellerRole: "seller", recipientRole: "recipient", expiresAt: "2099-06-01T00:00:00.000Z", reservationId: null, idempotencyKey: "list" });
  const held = deferred<NonNullable<typeof listed.listing>>();
  vi.spyOn(protocol, "viewResaleRight").mockResolvedValueOnce(adopted.right!);
  vi.spyOn(protocol, "viewResaleCase").mockImplementationOnce(() => held.promise);
  let model!: ReturnType<typeof useResaleDesk>;
  function Harness({ event }: { event: string }) { model = useResaleDesk(event); return null; }
  const mount = await renderDom(<Harness event="listing_a" />);
  expect(model.right?.rightId).toBe("iss_listing_a");
  await mount.rerender(<Harness event="listing_b" />);
  await act(async () => { held.resolve(listed.listing!); });
  expect(model.view).toBeNull();
  expect(model.right).toBeNull();
});
