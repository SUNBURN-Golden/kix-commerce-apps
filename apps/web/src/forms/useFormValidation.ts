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

  // Refs fence events in the same native event turn, before React renders.
  type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const composing = useRef<Control | null>(null);
  const ending = useRef<Control | null>(null);
  const confirming = useRef<Control | null>(null);
  const deferred = useRef(new Set<Control>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusGeneration = useRef(0);
  const requestedFocus = useRef(-1);
  function isControl(target: EventTarget): target is Control {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }
  function blocked() {
    // A removed/disabled editor cannot leave the form permanently fenced.
    for (const ref of [composing, ending, confirming]) {
      if (ref.current && (!formRef.current?.contains(ref.current) || ref.current.matches(":disabled"))) ref.current = null;
    }
    return Boolean(composing.current || ending.current || confirming.current);
  }
  function reconcile() {
    if (blocked()) return;
    for (const control of deferred.current) {
      if (formRef.current?.contains(control)) update(control);
    }
    deferred.current.clear();
  }
  function finishTurn() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      ending.current = null;
      reconcile();
    }, 0);
  }
  function compositionStart(target: EventTarget) {
    if (!isControl(target)) return;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    focusGeneration.current += 1;
    composing.current = target;
    ending.current = confirming.current = null;
  }
  function compositionEnd(target: EventTarget) {
    if (!isControl(target)) return;
    if (composing.current && composing.current !== target) return;
    composing.current = null;
    ending.current = target;
    deferred.current.add(target);
    // Final input/change may follow compositionend. No value is buffered or rewritten.
    finishTurn();
  }
  function keyDown(target: EventTarget, event: KeyboardEvent): boolean {
    if (!isControl(target)) return false;
    const ime = event.isComposing || event.keyCode === 229;
    const enter = event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter";
    if (!enter) return false;
    if (ime || composing.current === target || ending.current === target || confirming.current === target) {
      confirming.current = target;
      focusGeneration.current += 1;
      return true;
    }
    return false;
  }
  function keyUp(target: EventTarget, event: KeyboardEvent) {
    if (event.key === "Enter" || event.keyCode === 229 || confirming.current === target) {
      if (confirming.current === target) confirming.current = null;
      if (ending.current === target) ending.current = null;
      reconcile();
    }
  }
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

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
    if (blocked()) return false;
    active.current = ids;
    const next = read(ids);
    setIssues(next);
    if (next.length || reportedIssues.length) {
      requestedFocus.current = focusGeneration.current;
      setSubmitAttempt((attempt) => attempt + 1);
    }
    return next.length === 0;
  }
  function update(target: EventTarget, blur = false) {
    if (!isControl(target)) return;
    if (blur) {
      touched.current.add(target.id);
      if (confirming.current === target) confirming.current = null;
      if (ending.current === target) ending.current = null;
    }
    if (blocked()) {
      deferred.current.add(target);
      return;
    }
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
    if (submitAttempt > 0 && requestedFocus.current === focusGeneration.current && !blocked()) summaryRef.current?.focus();
    requestedFocus.current = -1;
  }, [submitAttempt]);

  const all = [...issues, ...reportedIssues.filter((reported) => !issues.some((issue) => issue.fieldId === reported.fieldId))];
  return { formRef, summaryRef, issues: all, refused: submitAttempt > 0 && all.length > 0, validate, update, compositionStart, compositionEnd, keyDown, keyUp };
}
