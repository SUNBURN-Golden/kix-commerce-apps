import type { Ref } from "react";
import { useFormT } from "../forms/useFormT";
import type { ValidationIssue } from "../forms/validation";

export function ErrorSummary({ id, issues, summaryRef }: { id: string; issues: readonly ValidationIssue[]; summaryRef: Ref<HTMLDivElement> }) {
  const t = useFormT();
  if (!issues.length) return null;
  return (
    <div id={id} className="error-summary" tabIndex={-1} ref={summaryRef} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{t("validation.summary")}</h3>
      <p>{t("validation.notSent")}</p>
      <ul>
        {issues.map((issue) => (
          <li key={issue.fieldId}>
            <a href={`#${issue.fieldId}`} onClick={(event) => {
              event.preventDefault();
              document.getElementById(issue.fieldId)?.focus();
            }}>{t(issue.labelKey)}: {t(issue.messageKey, issue.params)}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
