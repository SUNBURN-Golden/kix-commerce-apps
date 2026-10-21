import type { FormMessageKey } from "./catalogue";
import { bookingQuantityNumber } from "../a11y/present";

/** App-local input syntax only. No availability, expiry, authority or outcome decisions. */
type FieldLabel = Extract<FormMessageKey, `validation.label.${string}`>;
type ValidationMessage = Extract<FormMessageKey, `validation.${string}`>;
export interface FieldRule {
  id: string;
  label: FieldLabel;
  kind?: "text" | "integer" | "bookingQuantity" | "positiveInteger" | "seats";
  optional?: boolean;
  maxLength?: number;
}
export interface ValidationIssue {
  fieldId: string;
  labelKey: FieldLabel;
  messageKey: ValidationMessage;
  params: { max: number };
}
export function validateValue(rule: FieldRule, value: string): ValidationIssue | null {
  const issue = (messageKey: ValidationMessage, params?: ValidationIssue["params"]): ValidationIssue =>
    ({ fieldId: rule.id, labelKey: rule.label, messageKey, params: params ?? { max: 0 } });
  if (value.length === 0 && rule.optional) return null;
  if (!value.trim()) return issue("validation.required");
  if (rule.kind === "bookingQuantity" && bookingQuantityNumber(value) === null) return issue("validation.bookingQuantity");
  if (rule.kind === "integer" || rule.kind === "positiveInteger") {
    if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) return issue("validation.integer");
    if (rule.kind === "positiveInteger" && Number(value) === 0) return issue("validation.positiveInteger");
  }
  if (rule.kind === "seats" && !value.split(",").some((seat) => seat.trim())) return issue("validation.required");
  if (rule.maxLength !== undefined && value.trim().length > rule.maxLength) return issue("validation.maxLength", { max: rule.maxLength });
  return null;
}

export const field = (id: string, label: FieldLabel, options: Omit<FieldRule, "id" | "label"> = {}): FieldRule => ({ id, label, ...options });
