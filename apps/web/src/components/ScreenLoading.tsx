import { AsyncState } from "./AsyncState";
import { useT } from "../i18n/locale-context";
import { routeKey } from "../i18n/use-page-identity";
import { ROUTES } from "../shell/route-registry";

/** Shown while a screen's code loads. A progress note only: no heading, no animation, nothing was sent. */
export function ScreenLoading({ label }: { label: string }) {
  const t = useT();
  // The caller passes the registry label; a label no route owns is shown as given.
  const route = ROUTES.find((entry) => entry.label === label);
  return (
    <AsyncState kind="loading" label="" className="screen-loading" data-screen-loading>
      {t("screen.loading", { label: route ? t(routeKey(route)) : label })}
    </AsyncState>
  );
}
