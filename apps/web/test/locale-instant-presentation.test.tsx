// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createProtocol, type CommerceProtocol } from "@kix/protocol-adapter";
import { BoxOfficePage } from "../src/pages/BoxOffice";
import { BuyerPage } from "../src/pages/Buyer";
import { BookingPage } from "../src/pages/Booking";
import { DiscoveryPage } from "../src/pages/Discovery";
import { ResalePage } from "../src/pages/Resale";
import { M02Page } from "../src/pages/marketing/M02Presale";
import { M03Page } from "../src/pages/marketing/M03Coupons";
import { M05Page } from "../src/pages/marketing/M05Consent";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { presentInstant } from "../src/a11y/present";
import { marketingSession } from "../src/marketing/session";
import { button, change, click, element, renderDom } from "./support/render-dom";
import { reservationIds } from "../src/reservation-desk";
import { messages as resaleCopy } from "../src/i18n/messages/pages--ResalePanel";

const adapter = vi.hoisted(() => {
  vi.resetModules();
  return { current: null as CommerceProtocol | null };
});
vi.mock("../src/protocol", async () => {
  const { createProtocol } = await import("@kix/protocol-adapter");
  adapter.current = createProtocol({ mode: "stub" });
  return {
    protocol: new Proxy({}, {
      get(_target, key) {
        const value = Reflect.get(adapter.current!, key);
        return typeof value === "function" ? value.bind(adapter.current) : value;
      },
    }),
  };
});

const NOW = "2026-10-03T12:00:00.000Z";
const fixturePath = `${process.cwd()}/test/fixtures/english-clock-base.json`;
type Clock = { tag: string; iso: string | null; text: string };
// Recorded by rendering the unchanged base SHA named in the fixture, before source migration.
const english = JSON.parse(readFileSync(fixturePath, "utf8")).screens as Record<string, Clock[]>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  adapter.current = createProtocol({ mode: "stub" });
  marketingSession.reset();
  sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  marketingSession.reset();
  history.replaceState(null, "", "/");
});

const screens = [
  { name: "BoxOffice", route: "/", path: "/", page: <BoxOfficePage /> },
  { name: "Buyer", route: "/buyer", path: "/buyer", page: <BuyerPage /> },
  { name: "Booking", route: "/booking/evt_lanterns", path: "/booking/:eventId", page: <BookingPage /> },
  { name: "Discovery", route: "/discovery", path: "/discovery/:rowId?", page: <DiscoveryPage /> },
  { name: "DiscoveryDetail", route: "/discovery/syn-event-stale", path: "/discovery/:rowId?", page: <DiscoveryPage /> },
  { name: "DiscoveryLiveDetail", route: "/discovery/pro-0001", path: "/discovery/:rowId?", page: <DiscoveryPage /> },
  { name: "Resale", route: "/resale", path: "/resale", page: <ResalePage /> },
  { name: "M02", route: "/marketing/m02", path: "/marketing/m02", page: <M02Page /> },
  { name: "M03", route: "/marketing/m03", path: "/marketing/m03", page: <M03Page /> },
  { name: "M05", route: "/marketing/m05", path: "/marketing/m05", page: <M05Page /> },
];

function clocks(container: ParentNode): Clock[] {
  return Array.from(container.querySelectorAll("time, p, dd"))
    .filter((node) => node.tagName === "TIME" || (!node.querySelector("time") && /\d{1,2}:\d{2} UTC/.test(node.textContent ?? "")))
    .map((node) => ({ tag: node.tagName, iso: node.getAttribute("datetime"), text: node.textContent! }));
}

for (const screen of screens) {
  describe(screen.name, () => {
    it.each(["en", "ko"] as const)("shows %s clocks in UTC with raw ISO attributes", async (lang) => {
      history.replaceState(null, "", `/?lang=${lang}`);
      if (screen.name === "M02") marketingSession.join({ displayName: "Clock fixture", tier: "member" });
      if (screen.name === "Resale") {
        const p = adapter.current!;
        const ids = reservationIds("evt_lanterns");
        await p.registerReservationShow({ ...ids, eventId: "evt_lanterns", slots: [ids.slot], idempotencyKey: "clock-show" });
        await p.holdReservation({ ...ids, buyerRole: "desk-buyer", expiresAt: "2099-01-01T00:00:00.000Z", idempotencyKey: "clock-hold" });
        await p.confirmReservation({ ...ids, idempotencyKey: "clock-confirm" });
        await p.observeReservationPayment({ ...ids, paymentRef: "mock-noted", idempotencyKey: "clock-payment" });
        await p.issueReservation({ ...ids, idempotencyKey: "clock-issue" });
      }
      const { container } = await renderDom(<LocaleProvider><MemoryRouter initialEntries={[screen.route]}><Routes><Route path={screen.path} element={screen.page} /></Routes></MemoryRouter></LocaleProvider>);
      if (screen.name === "Booking") await click(element(container, '#booking-form button[type="submit"]'));
      if (screen.name === "Resale") {
        await click(button(container, resaleCopy[lang]["e.1"]));
        await click(button(container, resaleCopy[lang]["e.40"]));
      }
      if (screen.name === "M02") await click(element(container, ".program button"));
      if (screen.name === "M03") {
        await change(element(container, "#coupon-code"), "LANTERN-NOTE");
        await click(element(container, '#coupon-form button[type="submit"]'));
      }
      if (screen.name === "M05") await click(element(container, '#consent-flags-form button[type="submit"]'));
      const actual = clocks(container);
      expect(actual.length).toBeGreaterThan(0);
      const base = english[screen.name]!;
      const counts: Record<string, number> = { BoxOffice: 3, Buyer: 3, Booking: 2, Discovery: 48, DiscoveryDetail: 2, DiscoveryLiveDetail: 2, Resale: 1, M02: 4, M03: 1, M05: 1 };
      expect(actual).toHaveLength(counts[screen.name]!);
      expect(actual).toHaveLength(base.length);
      const knownInstants = [NOW, "2026-10-13T00:00:00.000Z", "2026-10-03T19:00:00.000Z", "2026-10-04T15:30:00.000Z", "2026-10-05T20:00:00.000Z", "2099-01-01T00:00:00.000Z"];
      if (["BoxOffice", "Buyer", "Booking"].includes(screen.name)) expect(actual[0]!.iso).toBe("2026-10-03T19:00:00.000Z");
      if (screen.name === "Booking") expect(actual[1]!.iso).toBe("2026-10-03T12:10:00.000Z");
      if (screen.name === "DiscoveryDetail") expect(actual[1]!.iso).toBe("2026-10-07T23:59:59.000Z");
      if (screen.name === "DiscoveryLiveDetail") expect(actual[1]!.iso).toBe("2026-10-13T00:00:00.000Z");
      if (lang === "en") expect(actual).toEqual(base);
      for (const [index, clock] of actual.entries()) {
        expect(clock.iso).toBe(base[index]!.iso);
        if (clock.iso) {
          expect(clock.iso).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
          expect(clock.text).toBe(presentInstant(clock.iso, lang === "ko" ? "ko-KR" : "en-GB"));
        }
        if (!clock.iso) {
          const iso = knownInstants.find((instant) => base[index]!.text.includes(presentInstant(instant, "en-GB")));
          expect(iso, `source instant for ${screen.name} clock ${index}`).toBeDefined();
          expect(clock.text).toContain(presentInstant(iso!, lang === "ko" ? "ko-KR" : "en-GB"));
        }
        if (lang === "ko") {
          expect(clock.text).toMatch(/\d{4}\. \d{1,2}\. \d{1,2}\. (오전|오후) \d{1,2}:\d{2} UTC/);
          expect(clock.text).not.toBe(base[index]!.text);
        }
      }
    });
  });
}
