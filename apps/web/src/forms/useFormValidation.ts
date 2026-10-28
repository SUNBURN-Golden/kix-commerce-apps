import { useEffect, useRef, useState } from "react";
import { validateValue, type FieldRule, type ValidationIssue } from "./validation";

export interface ValidationHandle { validate: (ids?: readonly string[]) => boolean }

export function useFormValidation(fields: readonly FieldRule[], reportedIssues: readonly ValidationIssue[] = []) {
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const touched = useRef(new Set<string>());
  const active = useRef<readonly string[] | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  function read(ids: readonly string[]): ValidationIssue[] {
    return fields.flatMap((rule) => {
      if (!ids.includes(rule.id)) return [];
      const control = formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[id="${rule.id}"]`);
      if (!control || control.matches(":disabled")) return [];
      const issue = validateValue(rule, control.value);
      return issue ? [issue] : [];
    });
  }
  function validate(ids: readonly string[] = fields.map((rule) => rule.id)): boolean {
    active.current = ids;
    const next = read(ids);
    setIssues(next);
    if (next.length || reportedIssues.length) setSubmitAttempt((attempt) => attempt + 1);
    return next.length === 0;
  }
  function update(target: EventTarget, blur = false) {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (blur) touched.current.add(target.id);
    if (blur || touched.current.has(target.id) || active.current?.includes(target.id)) {
      setIssues(read(active.current ?? [...touched.current]));
    }
  }
  // An editor may hide fields when the selected action changes. Never retain links to absent controls.
  useEffect(() => {
    setIssues((current) => {
      const retained = current.filter((issue) => {
        const control = formRef.current?.querySelector(`[id="${issue.fieldId}"]`);
        return control && !control.matches(":disabled");
      });
      return retained.length === current.length ? current : retained;
    });
  }, [fields]);
  useEffect(() => {
    if (submitAttempt > 0) summaryRef.current?.focus();
  }, [submitAttempt]);

  const all = [...issues, ...reportedIssues.filter((reported) => !issues.some((issue) => issue.fieldId === reported.fieldId))];
  return { formRef, summaryRef, issues: all, refused: submitAttempt > 0 && all.length > 0, validate, update };
}
