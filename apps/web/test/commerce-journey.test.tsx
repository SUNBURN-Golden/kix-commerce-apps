// @vitest-environment jsdom

import { act } from "react";
import { expect, it, vi } from "vitest";
import CommerceJourneyPanel from "../src/pages/CommerceJourneyPanel";
import { LocaleContext, stateFor } from "../src/i18n/locale-context";
import { ProtocolError } from "../../../packages/protocol-adapter/src/types";
import { click, element, renderDom } from "./support/render-dom";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../src/connectivity/desk-protocol", () => ({ protocol: { advanceCommerceJourney: send } }));

it("shows independent facts, a no-send read reason and the uncertain write on re-entry", async () => {
  let finish: (reason: unknown) => void = () => {};
  send.mockImplementationOnce(() => new Promise((_resolve, reject) => { finish = reject; }));
  const panel = (eventId: string) => (
    <LocaleContext.Provider value={stateFor("ko", () => {})}><CommerceJourneyPanel eventId={eventId} /></LocaleContext.Provider>
  );
  const { container, rerender } = await renderDom(panel("evt_a"));
  const press = (selector: string) => click(element<HTMLButtonElement>(container, selector));
  expect(container.textContent).toContain("프로토콜 거래 여정");
  await press("[data-commerce-branch=admission]");
  await press("button.ghost");
  expect(container.textContent).toContain("NOT_BOUND");
  expect(container.textContent).toContain("고정 게이트에 예매 조회 엔드포인트가 없습니다.");
  expect(send).not.toHaveBeenCalled();
  await press("[data-commerce-step=reservation-clock]");
  expect(container.querySelector("[data-commerce-step=reservation-clock]")).toHaveProperty("disabled", true);
  await act(async () => finish(new ProtocolError("timeout", "REQUEST_TIMEOUT", { requestId: "req", correlationId: "corr" })));
  expect(container.textContent).toContain("UNKNOWN");
  expect(container.textContent).toContain("REQUEST_TIMEOUT");
  for (const key of ["paymentObservation", "ticketIssuance", "admission"]) {
    expect(container.querySelector(`[data-commerce-fact=${key}] dd`)?.textContent).toBe("NO_EVIDENCE");
  }
  await rerender(panel("evt_b"));
  expect(container.querySelector("[data-commerce-step]")).toBeNull();
  await rerender(panel("evt_a"));
  await press("[data-commerce-step=reservation-clock]");
  expect(container.textContent).toContain("UNKNOWN");
  expect(container.querySelector("[data-commerce-step=reservation-clock]")).toHaveProperty("disabled", true);
  expect(send).toHaveBeenCalledTimes(1);
});
