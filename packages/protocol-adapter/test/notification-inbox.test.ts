import { describe, expect, it } from "vitest";
import {
  DISCOVERY_READ_TUPLE_LITERALS,
  NOTIFY_ACTION_KINDS,
  NOTIFY_BUYER_ACTOR,
  NOTIFY_CAPABILITIES,
  NOTIFY_EVENT_KINDS,
  NOTIFY_FOREIGN,
  NOTIFY_FOREIGN_ACTOR,
  NOTIFY_KNOWN,
  NOTIFY_NON_CLAIM_FIELDS,
  NOTIFY_NOT_BOUND_REASON,
  NOTIFY_OWN,
  NOTIFY_PRODUCER_TUPLE,
  NOTIFY_ROLES,
  NOTIFY_SCENARIOS,
  NOTIFY_SETTLER_ACTOR,
  NOTIFY_UNASSIGNED_ACTOR,
  assessNotifySnapshot,
  createNotBoundNotificationInbox,
  createStubNotificationInbox,
  findNotifyClaim,
  isNotifyRef,
  notificationInboxPortFor,
  notifyAuthorityTable,
  notifyCapabilities,
  notifyEligibility,
  notifyRefFor,
  notifyRefKind,
  notifyTextSafe,
  refuseNotifySnapshot,
  type NotifyActionRequest,
  type NotifyActRequest,
  type NotifyInquiryRequest,
  type NotifyReadRequest,
  type NotifyScenario,
  type NotifyScope,
  type NotifySnapshot,
} from "../src/index.js";

const SCOPE_BUYER: NotifyScope = { tenantId: NOTIFY_OWN, role: "buyer" };
const SCOPE_SETTLER: NotifyScope = { tenantId: NOTIFY_OWN, role: "settler" };

function readRequest(actorRef: string, scope: NotifyScope, overrides: Partial<NotifyReadRequest> = {}): NotifyReadRequest {
  return { contextKey: "test-context", actorRef, scope, focusRef: null, grantFloor: null, watermarkFloor: null, ...overrides };
}

function inquiryRequest(actorRef: string, scope: NotifyScope, inquiryRef: string): NotifyInquiryRequest {
  return { contextKey: "test-context", actorRef, scope, inquiryRef };
}

function actRequest(actorRef: string, scope: NotifyScope, generation: number, action: NotifyActionRequest): NotifyActRequest {
  return { contextKey: "test-context", actorRef, scope: { ...scope, grantGeneration: generation }, action };
}

async function readySnapshot(
  actorRef: string,
  scope: NotifyScope,
  options: { scenario?: NotifyScenario } = {},
): Promise<NotifySnapshot> {
  const port = createStubNotificationInbox({ scenario: options.scenario ?? "clean" });
  const outcome = await port.read(readRequest(actorRef, scope));
  expect(outcome.kind).toBe("ready");
  if (outcome.kind !== "ready") {
    throw new Error("unreachable");
  }
  return outcome.snapshot;
}

describe("notification inbox model", () => {
  it("lists every declared scenario, role, capability, event kind, and offer kind", () => {
    expect(NOTIFY_SCENARIOS.length).toBeGreaterThanOrEqual(15);
    expect(NOTIFY_ROLES).toEqual(["buyer", "organizer", "settler", "support"]);
    expect(NOTIFY_CAPABILITIES).toEqual([
      "read-inbox",
      "mark-read",
      "resolve-action",
      "read-sensitive",
      "read-inquiry",
    ]);
    for (const kind of NOTIFY_EVENT_KINDS) {
      expect(typeof kind).toBe("string");
    }
    for (const kind of NOTIFY_ACTION_KINDS) {
      expect(typeof kind).toBe("string");
    }
    expect(NOTIFY_KNOWN).toContain(NOTIFY_OWN);
    expect(NOTIFY_PRODUCER_TUPLE.bound).toBe(false);
    expect(NOTIFY_PRODUCER_TUPLE.sdkDigest).toBeNull();
    expect(NOTIFY_PRODUCER_TUPLE.status).toBe("NOT_BOUND");
    expect(NOTIFY_PRODUCER_TUPLE.waitingOn).toContain("kix-protocol:k-operator-contract");
  });

  it("keeps sensitive detail and inquiry material as separate authority rows", () => {
    const table = notifyAuthorityTable();
    const heldBy = (capability: string) => table.find((row) => row.capability === capability)?.heldBy ?? [];
    expect(heldBy("read-inbox")).toEqual(["buyer", "organizer", "settler", "support"]);
    expect(heldBy("read-sensitive")).toEqual(["organizer", "settler", "support"]);
    expect(heldBy("read-inquiry")).toEqual(["buyer", "organizer", "settler", "support"]);
    // The buyer reads its own inbox but holds no read-sensitive capability.
    expect(notifyCapabilities("buyer")).not.toContain("read-sensitive");
    expect(notifyCapabilities("a-stranger")).toEqual([]);
  });

  it("names refs by kind and never reads one kind as another", () => {
    expect(notifyRefKind("ntf-0001")).toBe("notification");
    expect(notifyRefKind("ngr-0001")).toBe("grant");
    expect(notifyRefKind("nqy-0001")).toBe("inquiry");
    expect(notifyRefKind("ord-0001")).toBeNull();
    expect(notifyRefKind("ntf-00x1")).toBeNull();
    expect(notifyRefFor("inquiry", 7)).toBe("nqy-0007");
    expect(isNotifyRef("ntf-0002", "notification")).toBe(true);
    expect(isNotifyRef("ntf-0002", "inquiry")).toBe(false);
  });

  it("flags inquiry lines that carry a sensitive token", () => {
    expect(notifyTextSafe("The notification ref ntf-0002 and the trade ref trd-0001.")).toBe(true);
    expect(notifyTextSafe("Reach the member at member@example.test.")).toBe(false);
    expect(notifyTextSafe("The bearer bearer_abc12345 was left in the record.")).toBe(false);
  });
});

describe("inbox reads", () => {
  it("a buyer sees only its own contracted notifications in its own tenant", async () => {
    const snapshot = await readySnapshot(NOTIFY_BUYER_ACTOR, SCOPE_BUYER);
    expect(snapshot.scope).toEqual(SCOPE_BUYER);
    expect(snapshot.actorRef).toBe(NOTIFY_BUYER_ACTOR);
    expect(snapshot.notifications.length).toBe(4);
    for (const row of snapshot.notifications) {
      expect(row.tenantId).toBe(NOTIFY_OWN);
      expect(row.subjectRef).toBe(NOTIFY_BUYER_ACTOR);
      expect(NOTIFY_EVENT_KINDS).toContain(row.kind);
      expect(row.issueState).toBe("current");
      // An arrival confirms no economic effect: the row carries no such field,
      // and the snapshot says so explicitly.
      expect(row).not.toHaveProperty("confirmsEconomicEffect");
    }
    expect(snapshot.unreadCount).toBe(3);
    expect(snapshot.droppedDuplicates).toBe(0);
    expect(snapshot.focus).toBeNull();
    expect(snapshot.grantGeneration).toBe(1);
  });

  it("states every non-claim as the literal false on a ready read", async () => {
    const snapshot = await readySnapshot(NOTIFY_BUYER_ACTOR, SCOPE_BUYER);
    for (const field of NOTIFY_NON_CLAIM_FIELDS) {
      expect(snapshot.nonClaims[field]).toBe(false);
    }
    expect(findNotifyClaim(snapshot.nonClaims)).toBeNull();
    expect(refuseNotifySnapshot(snapshot)).toBeNull();
  });

  it("answers empty for the empty scenario and stale for a read under a newer floor", async () => {
    const empty = await createStubNotificationInbox({ scenario: "empty" }).read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(empty.kind).toBe("empty");
    const stale = await createStubNotificationInbox({ scenario: "stale" }).read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(stale.kind).toBe("stale");
    if (stale.kind === "stale") {
      // STALE is its own verdict: not empty, not denied, not unknown.
      expect(Date.parse(stale.watermark)).toBeLessThan(Date.parse(stale.floor));
    }
  });

  it("reports a tuple change before any read row is trusted", async () => {
    const port = createStubNotificationInbox({
      expectedTuple: { ...DISCOVERY_READ_TUPLE_LITERALS, sdkDigest: "sha256:x" as unknown as null },
    });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome.kind).toBe("tuple-changed");
  });

  it("opens a notification by ref and denies a ref outside the tenant or subject", async () => {
    const port = createStubNotificationInbox();
    const opened = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "ntf-0002" }));
    expect(opened.kind).toBe("ready");
    if (opened.kind === "ready") {
      expect(opened.snapshot.focus?.kind).toBe("notification");
      expect(opened.snapshot.focus?.row.notificationRef).toBe("ntf-0002");
    }
    // A direct URL into another tenant's notification is denied, not substituted.
    const foreign = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "ntf-9001" }));
    expect(foreign).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    // A direct URL into another subject's notification is denied, not empty.
    const subject = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "ntf-0011" }));
    expect(subject).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    // A ref of the wrong kind is invalid, not denied.
    const wrongKind = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { focusRef: "ngr-0001" }));
    expect(wrongKind).toMatchObject({ kind: "invalid-request", code: "REF" });
  });
});

describe("denied and refused reads", () => {
  it("denies an actor with no notification grant and returns no row", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.read(readRequest(NOTIFY_UNASSIGNED_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "denied", code: "GRANT_DENIED" });
  });

  it("denies an actor asking under a tenant where it holds no grant", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, { tenantId: NOTIFY_FOREIGN, role: "buyer" }));
    expect(outcome).toMatchObject({ kind: "denied", code: "GRANT_DENIED" });
  });

  it("lets the foreign tenant's own actor read its own tenant", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.read(readRequest(NOTIFY_FOREIGN_ACTOR, { tenantId: NOTIFY_FOREIGN, role: "buyer" }));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind === "ready") {
      expect(outcome.snapshot.scope.tenantId).toBe(NOTIFY_FOREIGN);
      expect(outcome.snapshot.notifications.every((row) => row.tenantId === NOTIFY_FOREIGN)).toBe(true);
      expect(outcome.snapshot.notifications.every((row) => row.subjectRef === NOTIFY_FOREIGN_ACTOR)).toBe(true);
    }
  });

  it("denies every call once the notification grant is revoked at the source", async () => {
    const port = createStubNotificationInbox();
    expect(port.synthetic("revoke-grant", "ngr-0001")).toBe(true);
    const read = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(read).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    const inquiry = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    expect(inquiry).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
    const acted = await port.act(actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 2, { kind: "mark-read", notificationRef: "ntf-0001" }));
    expect(acted).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("the denied scenario revokes every grant before the first read", async () => {
    const port = createStubNotificationInbox({ scenario: "denied" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "denied", code: "GRANT_REVOKED" });
  });

  it("refuses a read payload that mixes another tenant's notification", async () => {
    const port = createStubNotificationInbox({ scenario: "tenant-mix" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "SCOPE_LEAK" });
  });

  it("refuses a read payload that mixes another subject's notification", async () => {
    const port = createStubNotificationInbox({ scenario: "subject-mix" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "SUBJECT_LEAK" });
  });

  it("refuses a feed that delivers an event kind the contract does not name", async () => {
    const port = createStubNotificationInbox({ scenario: "kind-uncontracted" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "UNCONTRACTED" });
  });

  it("refuses a payload that claims an arrival confirms an economic effect", async () => {
    const port = createStubNotificationInbox({ scenario: "claims-arrival" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "arrivalConfirmsEffect" });
  });

  it("refuses a payload that claims an external send or provider API is wired", async () => {
    const port = createStubNotificationInbox({ scenario: "external-wired" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "externalSendWired" });
  });
});

describe("dedupe, read state, and currentness", () => {
  it("drops a second delivery of the same dedupe key and lists one row", async () => {
    const port = createStubNotificationInbox({ scenario: "duplicate" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    const keys = outcome.snapshot.notifications.map((row) => row.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    // The clean read listed four rows; the duplicate delivery added a fifth
    // candidate and dedupe dropped it.
    expect(outcome.snapshot.droppedDuplicates).toBe(1);
    expect(outcome.snapshot.notifications.length).toBe(4);
  });

  it("marks a notification read and keeps it read on the next read", async () => {
    const port = createStubNotificationInbox();
    const acted = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" }),
    );
    expect(acted.kind).toBe("applied");
    if (acted.kind !== "applied") {
      return;
    }
    expect(acted.receipt.kind).toBe("read-marked");
    expect(acted.receipt.confirmsEconomicEffect).toBe(false);
    expect(acted.receipt.externalSendWired).toBe(false);
    expect(acted.receipt.destination).toBeNull();
    const read = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      const row = read.snapshot.notifications.find((item) => item.notificationRef === "ntf-0001");
      expect(row?.read).toBe(true);
      expect(read.snapshot.unreadCount).toBe(2);
    }
    // A second mark records nothing.
    const again = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" }),
    );
    expect(again).toMatchObject({ kind: "rejected", code: "ALREADY_READ" });
  });

  it("marks a late delivery stale-issue and blocks its offered action", async () => {
    const port = createStubNotificationInbox({ scenario: "late" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    const stale = outcome.snapshot.notifications.filter((row) => row.issueState === "stale-issue");
    expect(stale.map((row) => row.notificationRef)).toEqual(["ntf-0050"]);
    const assessment = assessNotifySnapshot(outcome.snapshot);
    expect(assessment.staleIssue.map((row) => row.notificationRef)).toEqual(["ntf-0050"]);
    expect(assessment.resolvable.map((row) => row.notificationRef)).not.toContain("ntf-0050");
    // The stale row keeps its offer but the resolve does not skip the
    // current-generation check: the source rejects it with STALE_ISSUE.
    const resolved = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-0050" }),
    );
    expect(resolved).toMatchObject({ kind: "rejected", code: "STALE_ISSUE" });
    // Marking a stale-issue row read still records read state — it is the
    // offered action that resolves nothing.
    const marked = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0050" }),
    );
    expect(marked.kind).toBe("applied");
  });

  it("a rotated grant generation makes earlier notifications stale-issue", async () => {
    const port = createStubNotificationInbox({ scenario: "grant-rotated" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.snapshot.grantGeneration).toBe(2);
    expect(outcome.snapshot.notifications.every((row) => row.issueState === "stale-issue")).toBe(true);
  });

  it("rejects a request built under an older grant generation", async () => {
    const port = createStubNotificationInbox();
    // The grant moves at the source after the read was taken.
    expect(port.synthetic("rotate-grant", "ngr-0001")).toBe(true);
    const outcome = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "GENERATION_STALE" });
  });

  it("a read under an older grant floor is generation-stale, not empty and not stale-by-watermark", async () => {
    const port = createStubNotificationInbox({ scenario: "grant-rotated" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { grantFloor: 1 }));
    expect(outcome).toMatchObject({ kind: "generation-stale", expected: 1, actual: 2 });
  });
});

describe("sensitive detail", () => {
  it("withholds a sensitive notification's detail from a buyer at the source", async () => {
    const snapshot = await readySnapshot(NOTIFY_BUYER_ACTOR, SCOPE_BUYER);
    const sensitive = snapshot.notifications.filter((row) => row.sensitive);
    expect(sensitive.length).toBe(1);
    for (const row of sensitive) {
      expect(row.detailState).toBe("withheld");
      expect(row.detail).toBeNull();
    }
    // The withheld text never appears anywhere in the snapshot.
    expect(JSON.stringify(snapshot)).not.toContain("mem-4417");
  });

  it("shows a sensitive notification's detail to a role that holds read-sensitive", async () => {
    const snapshot = await readySnapshot(NOTIFY_SETTLER_ACTOR, SCOPE_SETTLER);
    const sensitive = snapshot.notifications.filter((row) => row.sensitive);
    expect(sensitive.length).toBe(1);
    expect(sensitive[0]?.detailState).toBe("shown");
    expect(sensitive[0]?.detail).toContain("trd-9902");
  });

  it("refuses a payload that delivers a sensitive detail to a role without the capability", async () => {
    const port = createStubNotificationInbox({ scenario: "sensitive-leak" });
    const outcome = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(outcome).toMatchObject({ kind: "refused", code: "SENSITIVE_LEAK" });
    // A role that does hold read-sensitive reads the same feed refused-free.
    const holder = createStubNotificationInbox({ scenario: "sensitive-leak" });
    const asSettler = await holder.read(readRequest(NOTIFY_SETTLER_ACTOR, SCOPE_SETTLER));
    expect(asSettler.kind).toBe("ready");
  });
});

describe("offered actions", () => {
  it("resolves an open-authority offer to an authority destination, not a send", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-0001" }),
    );
    expect(outcome.kind).toBe("applied");
    if (outcome.kind !== "applied") {
      return;
    }
    expect(outcome.receipt.kind).toBe("resolved");
    expect(outcome.receipt.destination).toEqual({ kind: "authority", ref: "trd-0001" });
    expect(outcome.receipt.confirmsEconomicEffect).toBe(false);
    expect(outcome.receipt.externalSendWired).toBe(false);
    expect(outcome.receipt.checkedGeneration).toBe(1);
  });

  it("resolves an open-support offer to a support destination", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-0002" }),
    );
    expect(outcome).toMatchObject({
      kind: "applied",
      receipt: { kind: "resolved", destination: { kind: "support", inquiryRef: "nqy-0001" } },
    });
  });

  it("rejects a resolve on a notification that offers no action", async () => {
    const port = createStubNotificationInbox();
    // ntf-0003 carries no offered action.
    const outcome = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-0003" }),
    );
    expect(outcome).toMatchObject({ kind: "rejected", code: "OFFER_MISSING" });
    const unknown = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-9999" }),
    );
    expect(unknown).toMatchObject({ kind: "rejected", code: "UNKNOWN_NOTIFICATION" });
  });

  it("rejects a request that names another tenant's or another subject's notification", async () => {
    const port = createStubNotificationInbox();
    const foreign = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-9001" }),
    );
    expect(foreign).toMatchObject({ kind: "rejected", code: "UNKNOWN_NOTIFICATION" });
    const subject = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0011" }),
    );
    expect(subject).toMatchObject({ kind: "rejected", code: "UNKNOWN_NOTIFICATION" });
  });

  it("rejects a resolve answer that claims an economic effect", async () => {
    const port = createStubNotificationInbox({ scenario: "resolve-claims" });
    const outcome = await port.act(
      actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "resolve", notificationRef: "ntf-0001" }),
    );
    expect(outcome).toMatchObject({ kind: "refused", code: "CLAIM", field: "confirmsEconomicEffect" });
  });

  it("an assessment separates markable, resolvable, and stale-issue rows", async () => {
    const snapshot = await readySnapshot(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, { scenario: "late" });
    const assessment = assessNotifySnapshot(snapshot);
    expect(assessment.markable.map((row) => row.notificationRef)).toEqual(["ntf-0001", "ntf-0002", "ntf-0004", "ntf-0050"]);
    // ntf-0003 offers nothing and ntf-0050 is stale-issued, so neither resolves.
    expect(assessment.resolvable.map((row) => row.notificationRef)).toEqual(["ntf-0001", "ntf-0002", "ntf-0004"]);
    expect(assessment.staleIssue.map((row) => row.notificationRef)).toEqual(["ntf-0050"]);
    expect(notifyEligibility(snapshot, "mark-read").allowed).toBe(true);
    expect(notifyEligibility(snapshot, "resolve").allowed).toBe(true);
    const empty = await createStubNotificationInbox({ scenario: "empty" }).read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(empty.kind).toBe("empty");
  });
});

describe("inquiry material", () => {
  it("returns synthetic, redacted support material that is not an authority record", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    expect(outcome.kind).toBe("ready");
    if (outcome.kind !== "ready") {
      return;
    }
    expect(outcome.inquiry.declaration).toEqual({
      provenance: "synthetic",
      realPersonalData: false,
      deliveredExternally: false,
      authorityRecord: false,
    });
    expect(outcome.inquiry.lines.length).toBeGreaterThan(0);
    for (const line of outcome.inquiry.lines) {
      expect(notifyTextSafe(line.text)).toBe(true);
    }
  });

  it("denies inquiry material to a subject that does not own it", async () => {
    const port = createStubNotificationInbox();
    // nqy-0001 belongs to the buyer.
    const other = await port.readInquiry(inquiryRequest(NOTIFY_SETTLER_ACTOR, SCOPE_SETTLER, "nqy-0001"));
    expect(other).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    // And a tenant the grant does not cover denies at the gate.
    const foreign = await port.readInquiry(
      inquiryRequest(NOTIFY_BUYER_ACTOR, { tenantId: NOTIFY_FOREIGN, role: "buyer" }, "nqy-0001"),
    );
    expect(foreign).toMatchObject({ kind: "denied", code: "GRANT_DENIED" });
  });

  it("the inquiry-denied scenario withholds material even from its owner", async () => {
    const port = createStubNotificationInbox({ scenario: "inquiry-denied" });
    const outcome = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    expect(outcome).toMatchObject({ kind: "denied", code: "INQUIRY_DENIED" });
  });

  it("refuses inquiry material that carries a sensitive token", async () => {
    const port = createStubNotificationInbox({ scenario: "inquiry-leak" });
    const outcome = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    expect(outcome).toMatchObject({ kind: "refused", code: "SENSITIVE_LEAK" });
  });

  it("refuses a request for a nonexistent inquiry as denied, not fabricated", async () => {
    const port = createStubNotificationInbox();
    const outcome = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-9999"));
    expect(outcome).toMatchObject({ kind: "denied", code: "RESOURCE_DENIED" });
    const badRef = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "ntf-0001"));
    expect(badRef).toMatchObject({ kind: "invalid-request", code: "REF" });
  });
});

describe("not-bound port and effects", () => {
  it("the not-bound port answers every call not-bound and moves nothing", async () => {
    const port = createNotBoundNotificationInbox();
    expect(port.source).toBe("none");
    expect(port.environment).toBe("integration-http");
    const read = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(read).toMatchObject({ kind: "not-bound", reason: NOTIFY_NOT_BOUND_REASON });
    const inquiry = await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    expect(inquiry).toMatchObject({ kind: "not-bound" });
    const acted = await port.act(actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" }));
    expect(acted).toMatchObject({ kind: "not-bound" });
    expect(port.synthetic("rotate-grant", "ngr-0001")).toBe(false);
  });

  it("portFor gives the stub only for stub and never falls back", () => {
    expect(notificationInboxPortFor("stub").source).toBe("synthetic-notification-inbox");
    expect(notificationInboxPortFor("integration-http").source).toBe("none");
    expect(notificationInboxPortFor("integration-http").environment).toBe("integration-http");
  });

  it("a lost read answer rejects the promise so the client marks it unknown", async () => {
    const port = createStubNotificationInbox({ scenario: "read-lost" });
    await expect(port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER))).rejects.toThrow();
  });

  it("a lost request answer was recorded at the source even though it never arrived", async () => {
    const port = createStubNotificationInbox({ scenario: "act-lost" });
    await expect(
      port.act(actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" })),
    ).rejects.toThrow();
    const read = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      expect(read.snapshot.notifications.find((row) => row.notificationRef === "ntf-0001")?.read).toBe(true);
    }
  });

  it("a deliver-late control pushes a stale-issued notification mid-session", async () => {
    const port = createStubNotificationInbox();
    expect(port.synthetic("deliver-late", NOTIFY_BUYER_ACTOR)).toBe(true);
    const read = await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") {
      const late = read.snapshot.notifications.find((row) => row.issueState === "stale-issue");
      expect(late).toBeDefined();
      expect(late?.dedupeKey).toContain("evt-late-");
    }
  });

  it("counts the effects that reached the source", async () => {
    const port = createStubNotificationInbox();
    await port.read(readRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER));
    await port.read(readRequest(NOTIFY_UNASSIGNED_ACTOR, SCOPE_BUYER));
    await port.readInquiry(inquiryRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, "nqy-0001"));
    await port.act(actRequest(NOTIFY_BUYER_ACTOR, SCOPE_BUYER, 1, { kind: "mark-read", notificationRef: "ntf-0001" }));
    expect(port.effects()).toEqual({ reads: 2, inquiries: 1, acts: 1 });
  });
});
