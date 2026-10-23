import { AsyncStateFrame } from "./AsyncStateFrame";
import { useLocale } from "../i18n/locale-context";
import { routeLabel } from "../i18n/use-page-identity";
import { APP_ROUTES } from "../shell/route-registry";

/** Shown while a screen's code loads. A progress note only: no heading, no animation, nothing was sent. */
export function ScreenLoading({ label }: { label: string }) {
  const { t, locale } = useLocale();
  // The caller passes the registry label; a label no route owns is shown as given.
  const route = APP_ROUTES.find((entry) => entry.label === label);
  return (
    <AsyncStateFrame kind="loading" label="" word={t("status.loading.word")} note={t("status.loading.meaning")} className="screen-loading" data-screen-loading>
      {t("screen.loading", { label: route ? routeLabel(route, t, locale) : label })}
    </AsyncStateFrame>
  );
}
