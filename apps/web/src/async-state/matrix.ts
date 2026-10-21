import { ROUTES, type RouteId } from "../shell/route-registry";
import type { AsyncStateKind } from "./kinds";

/** App-internal presentation evidence. Never an outcome reducer or a public contract. */
import { ASYNC_STATES } from "./kinds";
export const STATE_COLUMNS = ASYNC_STATES;
export type StateCheck = { file: string; title: string } | { browser: string };
export interface ScreenStateCell {
  route: RouteId;
  state: AsyncStateKind;
  kind: "CHECKED" | "REFERENCE" | "NOT_REACHABLE" | "NOT_APPLICABLE";
  checkId: string;
  check?: StateCheck;
  driver: string;
  reason: string;
  pointer: string;
  owner?: string;
}

interface RouteEvidence {
  route: RouteId;
  fact: string;
  checks: Partial<Record<AsyncStateKind, StateCheck>>;
  drivers: Partial<Record<AsyncStateKind, string>>;
}

const evidence: readonly RouteEvidence[] = [
  {
    "route": "buyer",
    "fact": "Buyer catalogue, journey track and read-only refund desk.",
    "checks": {
      "empty": {
        "file": "buyer-workspace.test.tsx",
        "title": "renders a return action for blank, error, loading, and not-bound"
      },
      "unknown": {
        "file": "buyer-workspace.test.tsx",
        "title": "keeps an unknown outcome apart from a rejection"
      },
      "not-bound": {
        "file": "buyer-workspace.test.tsx",
        "title": "renders a return action for blank, error, loading, and not-bound"
      }
    },
    "drivers": {
      "stale": "refund-stale"
    }
  },
  {
    "route": "discovery",
    "fact": "Synthetic search and read-only projection; it sends no business command. Lost projection reads are unavailable, never a business UNKNOWN.",
    "checks": {
      "empty": {
        "file": "discovery-page.test.tsx",
        "title": "shows an empty result apart from a filter conflict"
      },
      "stale": {
        "file": "discovery-page.test.tsx",
        "title": "renders the synthetic sample, the ruling, and distinct row kinds"
      },
      "not-bound": {
        "file": "discovery-page.test.tsx",
        "title": "shows loading, error, and not-bound catalogue states"
      }
    },
    "drivers": {}
  },
  {
    "route": "inventory",
    "fact": "Synthetic inventory reads and queue/selection controls; unknown selection is not a selected unit.",
    "checks": {
      "empty": {
        "file": "inventory-venue.test.tsx",
        "title": "separates loading, empty, stale, tuple change, and not-bound"
      },
      "unknown": {
        "file": "inventory-venue.test.tsx",
        "title": "maps an unknown outcome to Read again and never to a selection"
      },
      "stale": {
        "file": "inventory-venue.test.tsx",
        "title": "separates loading, empty, stale, tuple change, and not-bound"
      },
      "not-bound": {
        "file": "inventory-venue.test.tsx",
        "title": "separates loading, empty, stale, tuple change, and not-bound"
      }
    },
    "drivers": {}
  },
  {
    "route": "organizer-workspace",
    "fact": "Batch command results; no results yet, UNKNOWN and stale selection are independent of the recorded unbound desk methods.",
    "checks": {
      "unknown": {
        "file": "organizer-workspace.test.tsx",
        "title": "keeps an unknown outcome apart from a rejection and stops the list"
      },
      "stale": {
        "file": "organizer-workspace.test.tsx",
        "title": "does not send a stale selection after the desk row changes"
      }
    },
    "drivers": {
      "empty": "mount",
      "not-bound": "mount"
    }
  },
  {
    "route": "organizer",
    "fact": "Fixed command rows, not an empty result collection. There is no freshness-bearing read in this command console.",
    "checks": {
      "unknown": {
        "file": "organizer-panel.test.tsx",
        "title": "shows an unconfirmed create apart from the last confirmed receipt"
      },
      "not-bound": {
        "file": "organizer-panel.test.tsx",
        "title": "renders the organizer route with the ruling and no policy numbers"
      }
    },
    "drivers": {}
  },
  {
    "route": "receipts",
    "fact": "Tab journal observations; stale evidence is not an UNKNOWN resolution.",
    "checks": {
      "empty": {
        "file": "receipt-explorer.test.tsx",
        "title": "links the receipt explorer and shows an empty stub page"
      },
      "unknown": {
        "file": "receipt-explorer.test.tsx",
        "title": "keeps an unknown prepare outcome unknown and fences the next step"
      },
      "stale": {
        "file": "receipt-explorer.test.tsx",
        "title": "keeps stale separate from unknown and from confirmed"
      },
      "not-bound": {
        "file": "receipt-explorer.test.tsx",
        "title": "shows stub journey receipts with the pinned profile and the not-bound hold"
      }
    },
    "drivers": {}
  },
  {
    "route": "journeys",
    "fact": "Synthetic read-only composed table. Business UNKNOWN is a row status. The controller has no STALE read or history outcome.",
    "checks": {
      "empty": {
        "file": "cross-surface-journeys.test.tsx",
        "title": "shows an empty source, an unavailable read, and a refused table as three different states"
      },
      "unknown": {
        "file": "cross-surface-journeys.test.tsx",
        "title": "never shows an UNKNOWN as closed, done, or lost"
      },
      "not-bound": {
        "file": "cross-surface-journeys.test.tsx",
        "title": "states not-bound on integration-http without a synthetic claim or a table"
      }
    },
    "drivers": {}
  },
  {
    "route": "session",
    "fact": "Tab journal; recovered UNKNOWN preserves the subject fence. Journal load history has no STALE freshness outcome.",
    "checks": {
      "empty": {
        "file": "session-recovery.test.tsx",
        "title": "shows an empty journal with the standing notice and the retention note"
      },
      "unknown": {
        "file": "session-recovery.test.tsx",
        "title": "shows an intent that was in flight at reload as recovered UNKNOWN that is not sent again"
      },
      "not-bound": {
        "file": "session-recovery.test.tsx",
        "title": "stays not-bound on integration-http and records nothing"
      }
    },
    "drivers": {}
  },
  {
    "route": "notifications",
    "fact": "Inbox freshness and request outcome are separate; stale inbox reads do not resolve unknown requests.",
    "checks": {
      "empty": {
        "file": "notification-inbox.test.tsx",
        "title": "an empty read, a stale read, and a generation-stale read are three distinct states"
      },
      "unknown": {
        "file": "notification-inbox.test.tsx",
        "title": "an unknown request outcome shows the fence and blocks the next request on screen"
      },
      "stale": {
        "file": "notification-inbox.test.tsx",
        "title": "an empty read, a stale read, and a generation-stale read are three distinct states"
      },
      "not-bound": {
        "file": "notification-inbox.test.tsx",
        "title": "a not-bound port shows NOT_BOUND and sends nothing"
      }
    },
    "drivers": {}
  },
  {
    "route": "platform",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "platform-journey.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready platform"
      },
      "unknown": {
        "file": "platform-journey.test.tsx",
        "title": "a lost booking blocks every write on its right, links no trade to itself, and leaves the other right open"
      },
      "stale": {
        "file": "platform-journey.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready platform"
      },
      "not-bound": {
        "file": "platform-journey.test.tsx",
        "title": "renders integration-http as not-bound with no stub switch, no row, and every write off"
      }
    },
    "drivers": {}
  },
  {
    "route": "merchant",
    "fact": "Read-only merchant ledger and export. A lost read is unavailable; this port has no business write or UNKNOWN command outcome.",
    "checks": {
      "empty": {
        "file": "merchant-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready ledger"
      },
      "stale": {
        "file": "merchant-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready ledger"
      },
      "not-bound": {
        "file": "merchant-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready ledger"
      }
    },
    "drivers": {}
  },
  {
    "route": "finance",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "finance-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready queue"
      },
      "unknown": {
        "file": "finance-operations.test.tsx",
        "title": "fences every later request after an answer that never arrived or arrived untrusted"
      },
      "stale": {
        "file": "finance-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready queue"
      },
      "not-bound": {
        "file": "finance-operations.test.tsx",
        "title": "separates empty, stale, unavailable, changed tuple, and not-bound, and none is a ready queue"
      }
    },
    "drivers": {}
  },
  {
    "route": "provider",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "provider-journey.test.tsx",
        "title": "separates empty, stale, refused, declared-production, unavailable, changed tuple, and not-bound"
      },
      "unknown": {
        "file": "provider-journey.test.tsx",
        "title": "a lost begin blocks every write on its order, links no order to itself, and leaves the other order open"
      },
      "stale": {
        "file": "provider-journey.test.tsx",
        "title": "separates empty, stale, refused, declared-production, unavailable, changed tuple, and not-bound"
      },
      "not-bound": {
        "file": "provider-journey.test.tsx",
        "title": "renders integration-http as not-bound with no stub switch, no row, and every write off"
      }
    },
    "drivers": {}
  },
  {
    "route": "mobile",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "installable-mobile.test.tsx",
        "title": "separates empty, stale, refused, declared-production, and not-bound"
      },
      "unknown": {
        "file": "installable-mobile.test.tsx",
        "title": "a lost confirm blocks its order and a late result stays evidence only"
      },
      "stale": {
        "file": "installable-mobile.test.tsx",
        "title": "separates empty, stale, refused, declared-production, and not-bound"
      },
      "not-bound": {
        "file": "installable-mobile.test.tsx",
        "title": "separates empty, stale, refused, declared-production, and not-bound"
      }
    },
    "drivers": {}
  },
  {
    "route": "credit-origination",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "credit-origination.test.tsx",
        "title": "separates empty, unavailable, denied, refused, and not-bound reads, and none shows a row"
      },
      "unknown": {
        "file": "credit-origination.test.tsx",
        "title": "shows an unknown result plainly and fences every later request for the session"
      },
      "stale": {
        "file": "credit-origination.test.tsx",
        "title": "flags a stale lane built under an older policy revision, never as current"
      },
      "not-bound": {
        "file": "credit-origination.test.tsx",
        "title": "keeps every request off under integration-http, with the not-bound reason on the button"
      }
    },
    "drivers": {}
  },
  {
    "route": "credit-servicing",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "credit-servicing.test.tsx",
        "title": "separates empty, unavailable, denied, refused, and not-bound reads, and none shows a row"
      },
      "unknown": {
        "file": "credit-servicing.test.tsx",
        "title": "shows an unknown result plainly and fences every later request for the session"
      },
      "stale": {
        "file": "credit-servicing.test.tsx",
        "title": "flags a schedule row built under an older revision, never as current"
      },
      "not-bound": {
        "file": "credit-servicing.test.tsx",
        "title": "keeps every request off under integration-http, with the not-bound reason on the button"
      }
    },
    "drivers": {}
  },
  {
    "route": "marketing-journey",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "marketing-journey.test.tsx",
        "title": "separates empty, stale, denied, refused, unavailable, changed tuple, and not-bound, and none is a ready list"
      },
      "unknown": {
        "file": "marketing-journey.test.tsx",
        "title": "a lost apply is shown as unknown, links no application to itself, and a read does not open the benefit"
      },
      "stale": {
        "file": "marketing-journey.test.tsx",
        "title": "separates empty, stale, denied, refused, unavailable, changed tuple, and not-bound, and none is a ready list"
      },
      "not-bound": {
        "file": "marketing-journey.test.tsx",
        "title": "renders integration-http as not-bound with no stub switch, no row, and no simulate control that acts"
      }
    },
    "drivers": {}
  },
  {
    "route": "assistant",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "delegated-assistant.test.tsx",
        "title": "reports loading, ready, empty, stale, denied, refused, not-bound, tuple-changed, and unavailable as their own states"
      },
      "unknown": {
        "file": "delegated-assistant.test.tsx",
        "title": "keeps a lost command unknown, names it, and blocks the grant's next write"
      },
      "stale": {
        "file": "delegated-assistant.test.tsx",
        "title": "reports loading, ready, empty, stale, denied, refused, not-bound, tuple-changed, and unavailable as their own states"
      },
      "not-bound": {
        "file": "delegated-assistant.test.tsx",
        "title": "shows the not-bound banner and turns scenario and simulate controls off on integration-http"
      }
    },
    "drivers": {}
  },
  {
    "route": "permissions",
    "fact": "Synthetic workspace reads, proposals and exports; unknown request fencing is checked separately from read freshness.",
    "checks": {
      "empty": {
        "file": "tenant-permissions.test.tsx",
        "title": "renders empty, stale and unknown requests on the permissions screen"
      },
      "unknown": {
        "file": "tenant-permissions.test.tsx",
        "title": "renders empty, stale and unknown requests on the permissions screen"
      },
      "stale": {
        "file": "tenant-permissions.test.tsx",
        "title": "renders empty, stale and unknown requests on the permissions screen"
      },
      "not-bound": {
        "file": "tenant-permissions.test.tsx",
        "title": "a not-bound port shows NOT_BOUND and sends nothing"
      }
    },
    "drivers": {}
  },
  {
    "route": "marketplace-performance",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "marketplace-performance.test.tsx",
        "title": "maps each settled scenario to its own read state word"
      },
      "unknown": {
        "file": "marketplace-performance.test.tsx",
        "title": "keeps a lost read in flight and unknown, and never shows a row for it"
      },
      "stale": {
        "file": "marketplace-performance.test.tsx",
        "title": "maps each settled scenario to its own read state word"
      },
      "not-bound": {
        "file": "marketplace-performance.test.tsx",
        "title": "keeps the not-bound environment separate and sends nothing"
      }
    },
    "drivers": {}
  },
  {
    "route": "qualification",
    "fact": "Synthetic run packets do not expose a STALE read state; historical packet text is not a current freshness outcome.",
    "checks": {
      "empty": {
        "file": "operational-qualification.test.tsx",
        "title": "shows no run sent before the first run, with a word for it"
      },
      "unknown": {
        "file": "operational-qualification.test.tsx",
        "title": "keeps the run control off with its fence reason after an unknown run"
      },
      "not-bound": {
        "file": "operational-qualification.test.tsx",
        "title": "shows the not-bound reason on integration-http with no stub switch"
      }
    },
    "drivers": {}
  },
  {
    "route": "release",
    "fact": "Synthetic run packets do not expose a STALE read state; historical packet text is not a current freshness outcome.",
    "checks": {
      "empty": {
        "file": "platform-release.test.tsx",
        "title": "shows no run sent before the first run, with a word for it"
      },
      "unknown": {
        "file": "platform-release.test.tsx",
        "title": "keeps the run control off with its fence reason after an unknown run"
      },
      "not-bound": {
        "file": "platform-release.test.tsx",
        "title": "shows the not-bound reason on integration-http with no stub switch"
      }
    },
    "drivers": {}
  },
  {
    "route": "identity",
    "fact": "Synthetic scenario-driven source. Empty reads, stale source lanes, unknown requests and unbound ports each keep their own existing evidence.",
    "checks": {
      "empty": {
        "file": "journey-identity.test.tsx",
        "title": "shows empty, stale, unavailable, and not-bound states"
      },
      "unknown": {
        "file": "journey-identity.test.tsx",
        "title": "keeps an unknown attach visible and fenced after a source reset"
      },
      "stale": {
        "file": "journey-identity.test.tsx",
        "title": "shows empty, stale, unavailable, and not-bound states"
      },
      "not-bound": {
        "file": "journey-identity.test.tsx",
        "title": "shows empty, stale, unavailable, and not-bound states"
      }
    },
    "drivers": {}
  },
  {
    "route": "credit",
    "fact": "Synchronous in-memory credit FSM case; an unopened case has no values. No asynchronous lost-response, read freshness or unbound-command presentation in this mock panel.",
    "checks": {},
    "drivers": {
      "empty": "mount"
    }
  },
  {
    "route": "admission",
    "fact": "Synchronous mock admission/reservation FSM views; an unopened case has no credential, and stale is an adapter credential label. No asynchronous lost-response or unbound-command presentation.",
    "checks": {
      "stale": {
        "file": "admission-panel.test.tsx",
        "title": "prints each adapter label without deciding entry"
      }
    },
    "drivers": {
      "empty": "mount"
    }
  },
  {
    "route": "gift",
    "fact": "Fixed gift command rows, not an empty result collection; the command view carries no read freshness.",
    "checks": {
      "unknown": {
        "file": "gift-panel.test.tsx",
        "title": "shows an unconfirmed offer apart from the last confirmed receipt and blocks cancel"
      },
      "not-bound": {
        "file": "gift-panel.test.tsx",
        "title": "shows browser HTTP as unavailable, with sends disabled and no stub-shape label"
      }
    },
    "drivers": {}
  },
  {
    "route": "box-office",
    "fact": "Catalogue, journey observations and the refund desk. Catalogue read and journey/refund outcomes are checked separately.",
    "checks": {
      "stale": {
        "browser": "a11y.async.refund-stale"
      }
    },
    "drivers": {
      "empty": "mount",
      "unknown": "journey-unknown",
      "not-bound": "mount"
    }
  },
  {
    "route": "booking",
    "fact": "Performance read, journey and refund desk. Empty is a resolved performance read with no matching event, checked in the browser.",
    "checks": {
      "empty": {
        "browser": "a11y.async.catalogue-empty"
      }
    },
    "drivers": {
      "unknown": "journey-unknown",
      "stale": "refund-stale",
      "not-bound": "mount"
    }
  },
  {
    "route": "resale",
    "fact": "Synchronous mock listing and resale FSM; no lost-response, read freshness or unbound-command state is exposed in the stub panel.",
    "checks": {},
    "drivers": {
      "empty": "mount"
    }
  },
  {
    "route": "marketing",
    "fact": "Static label hub and local session facts, not a producer status surface. Catalogue alignment text is reference copy only.",
    "checks": {},
    "drivers": {}
  },
  {
    "route": "marketing-m01",
    "fact": "Synchronous local demo card. Its absence is empty; no asynchronous unknown outcome, read freshness or bound producer command.",
    "checks": {},
    "drivers": {
      "empty": "mount"
    }
  },
  {
    "route": "marketing-m02",
    "fact": "Catalogue display plus synchronous local interest markers. No unknown command outcome, read freshness or producer binding is presented.",
    "checks": {
      "empty": {
        "browser": "a11y.async.catalogue-empty"
      }
    },
    "drivers": {}
  },
  {
    "route": "marketing-m03",
    "fact": "Fixed coupon sample cards and synchronous session markers, not a producer or an empty collection. No unknown outcome or freshness.",
    "checks": {},
    "drivers": {}
  },
  {
    "route": "marketing-m04",
    "fact": "Synchronous local reward counters; an empty counter is separate from unavailable producer integration. No UNKNOWN or freshness outcome.",
    "checks": {},
    "drivers": {
      "empty": "mount"
    }
  },
  {
    "route": "marketing-m05",
    "fact": "Consent command rows and local flags. Fixed pending rows are not an empty response; the command model has no STALE freshness.",
    "checks": {},
    "drivers": {
      "unknown": "consent-unknown",
      "not-bound": "mount"
    }
  },
  {
    "route": "handoff",
    "fact": "Static evidence handoff with a local filtered feature table. Glossary/reference words do not demonstrate a live UNKNOWN, STALE or NOT_BOUND outcome.",
    "checks": {
      "empty": {
        "file": "handoff-packet.test.tsx",
        "title": "renders loading, ready, empty, and error without posting"
      }
    },
    "drivers": {}
  },
  {
    "route": "help",
    "fact": "Static glossary; reference words are not async outcomes. Route code loading and shell errors still apply.",
    "checks": {},
    "drivers": {}
  },
];

export const SCREEN_STATE_MATRIX: readonly ScreenStateCell[] = evidence.flatMap((row) => STATE_COLUMNS.map((state): ScreenStateCell => {
  const checkId = `${row.route}:${state}`;
  const driver = state === "loading" ? "screen-import-pending" : state === "error" ? "screen-render-fault" : row.drivers[state];
  const check = driver ? { file: "async-state-matrix.test.tsx", title: checkId } : row.checks[state];
  const route = ROUTES.find((entry) => entry.id === row.route);
  const excluded = row.route === "help" || row.route === "marketing" || row.route === "marketing-m03" || state === "stale" || ["admission", "credit", "resale", "organizer", "gift", "marketing-m01", "marketing-m04", "marketing-m05"].includes(row.route);
  return {
    route: row.route, state, checkId,
    kind: driver ? "CHECKED" : check ? "REFERENCE" : excluded ? "NOT_APPLICABLE" : "NOT_REACHABLE",
    ...(check ? { check } : { owner: "c-async-state-patterns-stub" }),
    driver: driver ?? (check && "browser" in check ? check.browser : check ? "existing synthetic model fixture; exact executed screen assertion" : "mount-audit"),
    reason: row.fact,
    pointer: check && "file" in check ? `apps/web/test/${check.file}#${check.title}` : check && "browser" in check ? `apps/e2e/tests/a11y/async-state.a11y.test.ts#${check.browser}` : `apps/web/src/screens.ts#${row.route} (${route?.path ?? "unregistered"}); async-state-matrix.test.tsx#${row.route}:mount-audit`,
  };
}));

/** Check both the evidence declaration and the executed CHECKED ids. References are verified by the run reporter. */
export function matrixProblems(cells: readonly ScreenStateCell[], executed: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const routes = new Set<string>(ROUTES.map((route) => route.id));
  for (const cell of cells) {
    if (!routes.has(cell.route) || !STATE_COLUMNS.includes(cell.state)) problems.push(`unsupported cell ${cell.checkId}`);
    if (ids.has(`${cell.route}:${cell.state}`)) problems.push(`duplicate cell ${cell.checkId}`);
    ids.add(`${cell.route}:${cell.state}`);
    if (cell.checkId !== `${cell.route}:${cell.state}`) problems.push(`unsupported check id ${cell.checkId}`);
    if (!cell.reason || !cell.pointer || !cell.driver) problems.push(`missing evidence ${cell.checkId}`);
    if (cell.kind === "CHECKED" || cell.kind === "REFERENCE") {
      if (!cell.check) problems.push(`missing check ${cell.checkId}`);
      if (cell.kind === "CHECKED" && !executed.has(cell.checkId)) problems.push(`unexecuted check ${cell.checkId}`);
    } else if (!cell.owner || cell.check) problems.push(`invalid exclusion ${cell.checkId}`);
  }
  for (const route of ROUTES) for (const state of STATE_COLUMNS) {
    if (!ids.has(`${route.id}:${state}`)) problems.push(`missing cell ${route.id}:${state}`);
  }
  for (const id of executed) if (!cells.some((cell) => cell.kind === "CHECKED" && cell.checkId === id)) problems.push(`unsupported executed check ${id}`);
  return problems;
}
