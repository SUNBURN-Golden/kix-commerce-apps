import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BookingJourney,
  ConsentBind,
  GiftTransfer,
  HttpProtocolAdapter,
  OrganizerConsole,
  StubProtocolAdapter,
  createStubConsentInvoker,
  createStubGiftInvoker,
  createStubJourneyInvoker,
  createStubOrganizerInvoker,
  giftInvokerFor,
  journeyInvokerFor,
  openSessionJournal,
  type LocalCallInvoker,
} from "../src/index.js";
import {
  APPLIED_FAULTS,
  FAULT_KINDS,
  createFaultFetch,
  createFaultInvoker,
  type FaultKind,
  type SendLedger,
} from "./support/fault-injector.js";
import { FAULT_ROWS, REUSED_POINTERS } from "./support/fault-rows.js";
import { FakeSessionStore } from "./support/fake-session-store.js";
import { SHOW_POLICY } from "./support/journey-fixture.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const BASE = "http://127.0.0.1:8765";
const TIMEOUT_MS = 60;

type Kind = "RECEIPT" | "REJECTED" | "UNKNOWN" | "FENCED";
interface Driver {
  /** One send attempt per step, in order. */
  steps: Array<(tag: string) => Promise<{ kind: Kind }>>;
  /** Writes a caller could still try after a halt. All must be fenced. */
  extras: Array<() => Promise<{ kind: Kind }>>;
  halted(): unknown;
}
interface Surface {
  name: string;
  source: () => LocalCallInvoker;
  driver: (invoker: LocalCallInvoker) => Driver;
}

const EVENT_ID = "evt-fi";
const SURFACES: Surface[] = [
  {
    name: "booking",
    source: createStubJourneyInvoker,
    driver(invoker) {
      const j = new BookingJourney(invoker);
      return {
        steps: [
          (t) => j.createEvent({ operationId: `op-c-${t}`, eventId: EVENT_ID, organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] }),
          (t) => j.prepareTrade({ operationId: `op-p-${t}`, tradeId: "trade-1", buyer: "buyer-a" }),
          (t) => j.acceptTrade({ operationId: `op-a-${t}` }),
        ],
        extras: [],
        halted: () => j.state().halted,
      };
    },
  },
  {
    name: "gift",
    source: createStubGiftInvoker,
    driver(invoker) {
      const g = new GiftTransfer(invoker);
      return {
        steps: [
          (t) => g.offerGift({ operationId: `op-o-${t}`, giftId: "gift-1", donor: "donor-a", recipient: "recipient-b", ticketId: "ticket-9", expectedVersion: 1, expiresAt: 600 }),
          (t) => g.acceptGift({ operationId: `op-ac-${t}` }),
        ],
        extras: [() => g.cancelGift({ operationId: "op-cancel-x" })],
        halted: () => g.state().halted,
      };
    },
  },
  {
    name: "organizer",
    source: createStubOrganizerInvoker,
    driver(invoker) {
      const o = new OrganizerConsole(invoker);
      return {
        steps: [
          (t) => o.createEvent({ operationId: `op-c-${t}`, eventId: EVENT_ID, organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] }),
          (t) => o.closeSales({ operationId: `op-s-${t}`, eventId: EVENT_ID }),
        ],
        extras: [
          () => o.cancelEvent({ operationId: "op-cancel-x", eventId: EVENT_ID }),
          () => o.completeEvent({ operationId: "op-complete-x", eventId: EVENT_ID }),
        ],
        halted: () => o.state().halted,
      };
    },
  },
  {
    name: "consent",
    source: createStubConsentInvoker,
    driver(invoker) {
      const c = new ConsentBind(invoker);
      const fields = { business: "biz-1", channel: "email", eventId: EVENT_ID, expectedConsentVersion: 0, purpose: "marketing", subject: "subject-1" };
      return {
        steps: [
          (t) => c.setConsent({ operationId: `op-sc-${t}`, allowed: true, ...fields }),
          (t) => c.authorizeMarketing({ operationId: `op-am-${t}`, ...fields }),
        ],
        extras: [],
        halted: () => c.state().halted,
      };
    },
  },
];

function httpDriver(surface: Surface, fault: FaultKind | null, nth: number) {
  const handle = createFaultFetch(surface.source(), fault === null ? [] : [{ match: { nth }, fault }]);
  const adapter = new HttpProtocolAdapter(BASE, handle.fetch, { timeoutMs: TIMEOUT_MS });
  return { handle, driver: surface.driver(adapter) };
}

function expectedKind(fault: FaultKind): Kind {
  return fault === "REJECT_422" ? "REJECTED" : "UNKNOWN";
}

function hygiene(ledger: SendLedger): void {
  ledger.assertNoBanned();
  ledger.assertTransportHygiene();
  expect(ledger.retriesOfSameOperationId).toBe(0);
}

describe("fault matrix over HttpProtocolAdapter with a fake fetch (FI-N01 to FI-N10)", () => {
  for (const surface of SURFACES) {
    const stepCount = surface.driver(surface.source()).steps.length;
    for (let at = 0; at < stepCount; at += 1) {
      for (const fault of FAULT_KINDS) {
        it(`${surface.name} step ${at}: ${fault} sends once and fences everything after`, async () => {
          const { handle, driver } = httpDriver(surface, fault, at);
          const outcomes: Kind[] = [];
          for (let i = 0; i < at; i += 1) {
            const out = await driver.steps[i]!("1");
            expect(out.kind).toBe("RECEIPT");
          }
          const hit = await driver.steps[at]!("1");
          outcomes.push(hit.kind);
          expect(hit.kind).toBe(expectedKind(fault));
          const writesAtFault = handle.ledger.attempts;
          expect(writesAtFault).toBe(at + 1);
          expect(handle.ledger.writes[at]?.applied).toBe(APPLIED_FAULTS.has(fault));
          const halted = driver.halted();
          expect(halted).not.toBeNull();

          // Resend of the same step, later steps, and the compensating extras.
          const later = [
            () => driver.steps[at]!("1"),
            () => driver.steps[at]!("2"),
            ...driver.steps.slice(at + 1).map((step) => () => step("1")),
            ...driver.extras,
          ];
          for (const attempt of later) {
            const out = await attempt();
            expect(out.kind).toBe("FENCED");
          }
          if (fault === "LATE_DELIVERY" || fault === "TIMEOUT") {
            handle.release();
            await new Promise((r) => setTimeout(r, 5));
          }
          handle.ledger.assertOneAttempt(at + 1);
          handle.ledger.assertNoWriteAfter(at + 1);
          // State readers return detached evidence; late delivery preserves its value.
          expect(driver.halted()).toEqual(halted);
          expect(driver.halted()).not.toBe(halted);
          expect(handle.ledger.idempotencyKeyHeaders).toBe(0);
          hygiene(handle.ledger);
        });
      }
    }
  }

  it("a clean run sends each step once with no fault (control)", async () => {
    for (const surface of SURFACES) {
      const { handle, driver } = httpDriver(surface, null, 0);
      for (const step of driver.steps) {
        expect((await step("1")).kind).toBe("RECEIPT");
      }
      handle.ledger.assertOneAttempt(driver.steps.length);
      expect(handle.ledger.appliedAtSource).toBe(driver.steps.length);
      hygiene(handle.ledger);
    }
  });

  it("a pre-send throw reads UNKNOWN even though the ledger shows nothing applied", async () => {
    const { handle, driver } = httpDriver(SURFACES[0]!, "PRE_SEND_THROW", 0);
    const out = await driver.steps[0]!("1");
    expect(out.kind).toBe("UNKNOWN");
    expect(handle.ledger.appliedAtSource).toBe(0);
  });

  it("a late answer after the timeout changes neither the halt nor the ledger (FI-N10)", async () => {
    const { handle, driver } = httpDriver(SURFACES[1]!, "LATE_DELIVERY", 0);
    expect((await driver.steps[0]!("1")).kind).toBe("UNKNOWN");
    const halted = driver.halted();
    expect(handle.release()).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    expect(driver.halted()).toEqual(halted);
    expect(driver.halted()).not.toBe(halted);
    expect((await driver.steps[1]!("1")).kind).toBe("FENCED");
    handle.ledger.assertOneAttempt(1);
  });
});

describe("fault matrix over the in-process stub-shape source", () => {
  for (const surface of SURFACES) {
    for (const fault of ["PRE_SEND_THROW", "LOST_AFTER_EFFECT", "INVALID_RECEIPT", "REJECT_422"] as FaultKind[]) {
      it(`${surface.name}: ${fault} on the first step fences the rest`, async () => {
        const { invoker, ledger } = createFaultInvoker(surface.source(), [{ match: { nth: 0 }, fault }]);
        const driver = surface.driver(invoker);
        expect((await driver.steps[0]!("1")).kind).toBe(expectedKind(fault));
        for (const next of [() => driver.steps[0]!("2"), ...driver.steps.slice(1).map((s) => () => s("1")), ...driver.extras]) {
          expect((await next()).kind).toBe("FENCED");
        }
        ledger.assertOneAttempt(1);
        ledger.assertNoBanned();
      });
    }
  }
});

describe("other boundaries", () => {
  it("duplicate trigger while a send is in flight is fenced and sends once (FI-N11)", async () => {
    const { handle, driver } = httpDriver(SURFACES[0]!, "LATE_DELIVERY", 0);
    const first = driver.steps[0]!("1");
    const second = await driver.steps[0]!("2");
    expect(second.kind).toBe("FENCED");
    expect(handle.ledger.attempts).toBe(1);
    expect((await first).kind).toBe("UNKNOWN");
    handle.release();
    handle.ledger.assertOneAttempt(1);
  });

  it("a probe after UNKNOWN sends no write and lifts no fence (FI-N12)", async () => {
    const { handle, driver } = httpDriver(SURFACES[1]!, "LOST_AFTER_EFFECT", 0);
    expect((await driver.steps[0]!("1")).kind).toBe("UNKNOWN");
    const adapter = new HttpProtocolAdapter(BASE, handle.fetch, { timeoutMs: TIMEOUT_MS });
    const seen = await adapter.observeTransport();
    expect(seen.state).toBe("up");
    expect(handle.ledger.probes.length).toBeGreaterThan(0);
    expect(driver.halted()).not.toBeNull();
    expect((await driver.steps[1]!("1")).kind).toBe("FENCED");
    handle.ledger.assertOneAttempt(1);
  });

  it("a different actor after UNKNOWN is still fenced (FI-N13)", async () => {
    const handle = createFaultFetch(createStubGiftInvoker(), [{ match: { nth: 0 }, fault: "LOST_AFTER_EFFECT" }]);
    const gift = new GiftTransfer(new HttpProtocolAdapter(BASE, handle.fetch, { timeoutMs: TIMEOUT_MS }));
    const base = { giftId: "gift-1", ticketId: "ticket-9", expectedVersion: 1, expiresAt: 600 };
    expect((await gift.offerGift({ operationId: "op-1", donor: "donor-a", recipient: "r-b", ...base })).kind).toBe("UNKNOWN");
    expect((await gift.offerGift({ operationId: "op-2", donor: "donor-z", recipient: "r-y", ...base })).kind).toBe("FENCED");
    handle.ledger.assertOneAttempt(1);
  });

  it("mode selection never switches adapters on failure (FI-N14)", async () => {
    const handle = createFaultFetch(createStubJourneyInvoker(), [{ match: { nth: 0 }, fault: "PRE_SEND_THROW" }]);
    const http = new HttpProtocolAdapter(BASE, handle.fetch, { timeoutMs: TIMEOUT_MS });
    const chosen = journeyInvokerFor(http);
    expect(chosen?.source).toBe("integration-gate");
    expect(chosen?.invoker).toBe(http);
    const journey = new BookingJourney(chosen!.invoker);
    const out = await journey.createEvent({ operationId: "op-1", eventId: EVENT_ID, organizer: "organizer", policy: SHOW_POLICY, seats: ["A1"] });
    expect(out.kind).toBe("UNKNOWN");
    expect(journeyInvokerFor(http)?.source).toBe("integration-gate");
    expect(giftInvokerFor(new StubProtocolAdapter())?.source).toBe("stub-shape");
    handle.ledger.assertOneAttempt(1);
  });

  it("reloads over a store with a lost answer keep the source submit count at 1, whatever the damage (FI-N15)", () => {
    const damages: Array<(store: FakeSessionStore) => void> = [
      () => undefined,
      (store) => {
        store.throwOnSet = true;
      },
      (store) => {
        store.silentTruncate = 20;
      },
    ];
    for (const damage of damages) {
      const store = new FakeSessionStore();
      let submits = 0;
      const tag = "0123456789abcdef";
      const first = openSessionJournal(store);
      first.load();
      expect(first.begin({ intentRef: "intent-1", scope: "subject-1", contextTag: tag }).ok).toBe(true);
      submits += 1;
      for (let reload = 0; reload < 3; reload += 1) {
        damage(store);
        const journal = openSessionJournal(store);
        journal.load();
        if (journal.scopeBlock("subject-1") === null) {
          submits += 1;
        }
        store.throwOnSet = false;
        store.silentTruncate = null;
      }
      expect(submits).toBe(1);
    }
  });

  it("two gift instances over one deciding source: the source decides, the page sends once each (FI-N16)", async () => {
    const decided = new Set<string>();
    const sourceLedger: string[] = [];
    const decider: LocalCallInvoker = {
      async invokeLocalCall(input) {
        sourceLedger.push(input.operationId);
        const body = input.body as Record<string, unknown>;
        if (decided.has(String(body.giftId))) {
          throw Object.assign(new Error("duplicate gift"), {});
        }
        decided.add(String(body.giftId));
        return createStubGiftInvoker().invokeLocalCall(input);
      },
    };
    const a = createFaultFetch(decider);
    const b = createFaultFetch(decider);
    const make = (h: ReturnType<typeof createFaultFetch>) => new GiftTransfer(new HttpProtocolAdapter(BASE, h.fetch, { timeoutMs: TIMEOUT_MS }));
    const offer = (op: string) => ({ operationId: op, giftId: "gift-1", donor: "donor-a", recipient: "r-b", ticketId: "ticket-9", expectedVersion: 1, expiresAt: 600 });
    const [x, y] = await Promise.all([make(a).offerGift(offer("op-x")), make(b).offerGift(offer("op-y"))]);
    expect([x.kind, y.kind].filter((k) => k === "RECEIPT")).toHaveLength(1);
    expect(a.ledger.attempts).toBe(1);
    expect(b.ledger.attempts).toBe(1);
    expect(sourceLedger).toHaveLength(2);
    a.ledger.assertNoBanned();
    b.ledger.assertNoBanned();
  });

  it("the HTTP desk sends no admit for an admission check (FI-N18)", async () => {
    const handle = createFaultFetch(createStubJourneyInvoker());
    const adapter = new HttpProtocolAdapter(BASE, handle.fetch, { timeoutMs: TIMEOUT_MS });
    await expect(adapter.checkAdmission({ rightsRef: "right-1", gateId: "gate-a" })).rejects.toThrow(/not-bound/);
    expect(handle.ledger.entries).toHaveLength(0);
  });
});

describe("result rows", () => {
  it("REUSED rows point at a test that exists", () => {
    for (const row of FAULT_ROWS.filter((r) => r.status === "REUSED")) {
      const pointer = REUSED_POINTERS[row.id];
      expect(pointer, row.id).toBeDefined();
      const text = readFileSync(path.join(here, pointer!.file), "utf8");
      expect(text, row.id).toContain(pointer!.title);
    }
  });

  it("row ids are unique and each runner keeps its own denominator", () => {
    const ids = FAULT_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of FAULT_ROWS) {
      const prefix = { node: "FI-N", "web-ssr": "FI-W", browser: "FI-B" }[row.runner];
      expect(row.id.startsWith(prefix)).toBe(true);
    }
  });

  it("the doc names every row id, the ruling, contract_change=NO, and claims nothing live", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/c-fault-injection-stub-apps-bind.md"), "utf8");
    for (const row of FAULT_ROWS) {
      expect(doc, row.id).toContain(row.id);
    }
    expect(doc).toContain("M2 + H1 — 준태님 ruling 2026-10-08 18:26 KST, relayed by KIX Commerce");
    expect(doc).toContain("contract_change=NO");
    expect(doc).not.toMatch(/production[- ]ready|service qualification passed|qualified for production/i);
    expect(doc).toContain("not a service qualification");
  });

  it("writes a Node record keyed by app head, mode and source when asked", () => {
    const head = (() => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: repoRoot }).trim();
      } catch {
        return "unknown";
      }
    })();
    const record = {
      suite: "fault-injection",
      runner: "node",
      mode: "integration-http(fake fetch)",
      source: "fake-fetch->HttpProtocolAdapter(127.0.0.1) over stub-shape invokers",
      appHead: head,
      rows: FAULT_ROWS.filter((r) => r.runner === "node"),
      claims: { serviceQualification: false, productionQualification: false, realPayment: false, httpModePass: false, released: false },
    };
    expect(Object.values(record.claims).every((v) => v === false)).toBe(true);
    const out = process.env.KIX_FAULT_RECORD_OUT;
    if (out) {
      writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
    }
  });
});
