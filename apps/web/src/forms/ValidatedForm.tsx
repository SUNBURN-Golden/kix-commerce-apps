import { Children, Fragment, cloneElement, isValidElement, useContext, useEffect, useId, useImperativeHandle, useState, type FormHTMLAttributes, type ReactElement, type ReactNode, type Ref } from "react";
import { ErrorSummary } from "../components/ErrorSummary";
import { RefusalContext } from "../connectivity/refusal";
import { useFormT } from "./useFormT";
import { useFormValidation, type ValidationHandle } from "./useFormValidation";
import type { FieldRule, ValidationIssue } from "./validation";

/** Adds error connections to native controls while preserving their handlers and hint IDs. */
export function ValidatedForm({ fields, validationRef, submitFields, busy = false, reportedIssues = [], children, onSubmit, ...props }: FormHTMLAttributes<HTMLFormElement> & {
  fields: readonly FieldRule[];
  validationRef?: Ref<ValidationHandle>;
  submitFields?: readonly string[];
  busy?: boolean;
  reportedIssues?: readonly ValidationIssue[];
}) {
  const t = useFormT();
  const id = useId();
  const validation = useFormValidation(fields, reportedIssues);
  useImperativeHandle(validationRef, () => ({ validate: validation.validate }));
  // A refused submit fences the send that asked for it, described by the summary, until a field changes.
  const parent = useContext(RefusalContext);
  const [pressed, press] = useState<string | null>(null);
  const reason = validation.refused ? `${id}-errors` : null;
  const report = parent?.report;
  useEffect(() => report?.(reason), [report, reason]);
  const refusal = parent ?? { reason, pressed, press, report: () => undefined };
  function connect(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node): ReactNode => {
      if (!isValidElement(node)) return node;
      const element = node as ReactElement<{ id?: string; children?: ReactNode; "aria-invalid"?: boolean | "true" | "false"; "aria-describedby"?: string }>;
      const issue = validation.issues.find((item) => item.fieldId === element.props.id);
      const control = typeof element.type === "string" && ["input", "select", "textarea"].includes(element.type);
      const errorId = `${element.props.id}-format-error`;
      const connected = cloneElement(element, {
        ...(control && (Boolean(issue) || fields.some((rule) => rule.id === element.props.id)) ? {
          "aria-invalid": Boolean(issue) || element.props["aria-invalid"] || false,
          "aria-describedby": [element.props["aria-describedby"], issue ? errorId : null].filter(Boolean).join(" ") || undefined,
        } : {}),
        ...(element.props.children ? { children: connect(element.props.children) } : {}),
      });
      return control ? <Fragment>{connected}{issue ? <span id={errorId} className="field-error">{t(issue.messageKey, issue.params)}</span> : null}</Fragment> : connected;
    });
  }
  return (
    <form {...props} aria-busy={busy || props["aria-busy"]} noValidate ref={validation.formRef}
      onCompositionStartCapture={(event) => {
        validation.compositionStart(event.target);
        props.onCompositionStartCapture?.(event);
      }}
      onCompositionEndCapture={(event) => {
        validation.compositionEnd(event.target);
        props.onCompositionEndCapture?.(event);
      }}
      onKeyDownCapture={(event) => {
        const suppress = validation.keyDown(event.target, event.nativeEvent);
        props.onKeyDownCapture?.(event);
        if (suppress) event.preventDefault();
      }}
      onKeyUpCapture={(event) => {
        validation.keyUp(event.target, event.nativeEvent);
        props.onKeyUpCapture?.(event);
      }}
      onBlurCapture={(event) => {
        validation.update(event.target, true);
        props.onBlurCapture?.(event);
      }}
      onChangeCapture={(event) => {
        refusal.press(null);
        validation.update(event.target);
        props.onChangeCapture?.(event);
      }}
      onSubmit={(event) => {
        const cancelled = event.defaultPrevented;
        event.preventDefault();
        if (!cancelled && !busy && validation.validate(submitFields)) onSubmit?.(event);
      }}>
      <ErrorSummary id={`${id}-errors`} issues={validation.issues} summaryRef={validation.summaryRef} />
      {/* Always in the page, so a refused submit is announced once. Blur checks fill the summary without speaking. */}
      <p role="status" data-validation-refused={validation.refused ? "true" : "false"} style={{ position: "fixed", clipPath: "inset(50%)" }}>{validation.refused ? t("validation.notSent") : ""}</p>
      <RefusalContext.Provider value={refusal}>{connect(children)}</RefusalContext.Provider>
    </form>
  );
}
