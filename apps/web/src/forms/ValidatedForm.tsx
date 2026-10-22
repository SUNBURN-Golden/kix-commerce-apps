import { Children, Fragment, cloneElement, isValidElement, useId, useImperativeHandle, type FormHTMLAttributes, type ReactElement, type ReactNode, type Ref } from "react";
import { ErrorSummary } from "../components/ErrorSummary";
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
      onBlurCapture={(event) => validation.update(event.target, true)}
      onChangeCapture={(event) => validation.update(event.target)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && validation.validate(submitFields)) onSubmit?.(event);
      }}>
      <ErrorSummary id={`${id}-errors`} issues={validation.issues} summaryRef={validation.summaryRef} />
      {connect(children)}
    </form>
  );
}
