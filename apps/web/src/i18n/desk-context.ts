import { useContext } from "react";
import { LocaleContext } from "./locale-context";
import { makeScreenTranslate, type MessageBundle } from "./desk-translate";

/** Screen copy remains in lazy chunks; the shell needs only its original translator. */
export function useT(...bundles: readonly MessageBundle[]) {
  const { locale } = useContext(LocaleContext);
  return makeScreenTranslate(locale, ...bundles);
}
