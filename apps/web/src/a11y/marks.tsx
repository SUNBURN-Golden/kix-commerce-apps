import { useLocale, useT } from "../i18n/locale-context";
import { makeTranslate, type Translate } from "../i18n/translate";
import { DEFAULT_LOCALE } from "../i18n/locales";
import { presentDeadline, type DisplayLocale } from "./present";

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
  const t = useT();
  return (
    <span className="status-mark" data-status-mark={kind}>
      <span className="status-word">{t(`status.${kind}.word`)}</span> <span className="status-meaning">{t(`status.${kind}.meaning`)}</span>
    </span>
  );
}

/** Short word for the transport banner. The sentence beside it stays the banner text. */
export function transportStatusWord(state: string, t: Translate = makeTranslate(DEFAULT_LOCALE)): string {
  if (state === "checking") {
    return t("status.transport.checking");
  }
  if (state === "unavailable" || state === "degraded") {
    return t("status.transport.blocked");
  }
  if (state === "up") {
    return t("status.transport.up");
  }
  return t("status.transport.local");
}

export function AmountNotice() {
  const t = useT();
  return (
    <p className="amount-notice" data-amount="undetermined">
      {t("amount.notice")}
    </p>
  );
}

export function DeadlineLine({
  expiresAt,
  expired,
  locale,
}: {
  expiresAt: string;
  expired: boolean | null;
  locale?: DisplayLocale;
}) {
  const { locale: chosen, clock, t } = useLocale();
  const view = presentDeadline({ expiresAt, expired, locale: locale ?? clock });
  const flag = view.authority.expired === null ? "unspecified" : view.authority.expired ? "true" : "false";
  return (
    <span className="deadline" data-expires-at={view.authority.expiresAt} data-expired={flag}>
      <time dateTime={view.authority.expiresAt}>{view.clock}</time>{" "}
      <span className="deadline-authority">{chosen === "ko" ? koAuthorityLine(t, view.authority.expiresAt, flag) : view.authorityLine}</span>
    </span>
  );
}

/** The adapter fields are copied as they are; only the sentence around them follows the locale. */
function koAuthorityLine(t: Translate, expiresAt: string, flag: string): string {
  return t("deadline.authority", { expiresAt, flag: flag === "unspecified" ? t("deadline.flag.unspecified") : flag });
}
