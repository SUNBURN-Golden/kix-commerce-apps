import { AMOUNT_NOTICE, presentDeadline, type DisplayLocale } from "./present";

/**
 * Text for loading, blocked, selected, and review.
 * The word is the meaning. Color and border style are extra.
 */
export const STATUS_MARKS = {
  loading: {
    word: "Loading",
    meaning: "This request is still loading. Nothing is confirmed.",
  },
  blocked: {
    word: "Blocked",
    meaning: "This action is blocked. Correct the named field or read the next permitted step.",
  },
  selected: {
    word: "Selected",
    meaning: "This row is selected. Selection is not a reservation and not a payment.",
  },
  review: {
    word: "In review",
    meaning: "This preview is in review. Nothing has been sent.",
  },
} as const;

export type StatusMarkKind = keyof typeof STATUS_MARKS;

export function StatusMark({ kind }: { kind: StatusMarkKind }) {
  const mark = STATUS_MARKS[kind];
  return (
    <span className="status-mark" data-status-mark={kind}>
      <span className="status-word">{mark.word}</span> <span className="status-meaning">{mark.meaning}</span>
    </span>
  );
}

/** Short word for the transport banner. The sentence beside it stays the banner text. */
export function transportStatusWord(state: string): string {
  if (state === "checking") {
    return "Loading.";
  }
  if (state === "unavailable" || state === "degraded") {
    return "Blocked.";
  }
  if (state === "up") {
    return "Ready.";
  }
  return "Local.";
}

export function AmountNotice() {
  return (
    <p className="amount-notice" data-amount="undetermined">
      {AMOUNT_NOTICE}
    </p>
  );
}

export function DeadlineLine({
  expiresAt,
  expired,
  locale = "en-GB",
}: {
  expiresAt: string;
  expired: boolean | null;
  locale?: DisplayLocale;
}) {
  const view = presentDeadline({ expiresAt, expired, locale });
  const flag = view.authority.expired === null ? "unspecified" : view.authority.expired ? "true" : "false";
  return (
    <span className="deadline" data-expires-at={view.authority.expiresAt} data-expired={flag}>
      <time dateTime={view.authority.expiresAt}>{view.clock}</time>{" "}
      <span className="deadline-authority">{view.authorityLine}</span>
    </span>
  );
}
