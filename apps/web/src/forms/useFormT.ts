import { useLocale } from "../i18n/locale-context";
import { interpolate } from "../i18n/translate";
import { FORM_MESSAGES, type FormMessageKey } from "./catalogue";

/** Reads the current locale on every render, so existing error descriptors update without resetting fields. */
export function useFormT() {
  const { locale } = useLocale();
  return (key: FormMessageKey, params?: { max: number }) => interpolate(FORM_MESSAGES[locale][key], params);
}
