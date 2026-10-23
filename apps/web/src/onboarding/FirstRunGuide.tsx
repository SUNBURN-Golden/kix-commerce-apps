import { Link } from "react-router-dom";
import { useT } from "../i18n/locale-context";
import { ROLE_STARTS } from "./roles";

export function FirstRunGuide({ onDismiss }: { onDismiss: (path?: string) => void }) {
  const t = useT();
  return (
    <section className="first-run" aria-labelledby="first-run-title" data-first-run="shown">
      <p id="first-run-title" tabIndex={-1}><strong>{t("onboarding.title")}</strong></p>
      <p>{t("onboarding.body")}</p>
      <ul className="first-run-roles">
        {ROLE_STARTS.map(({ role, path }) => (
          <li key={role}>
            <Link to={path} data-role={role} onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
                onDismiss(path);
              }
            }}>{t(`onboarding.role.${role}`)}</Link>
          </li>
        ))}
      </ul>
      <button type="button" id="first-run-skip" onClick={() => onDismiss()}>{t("onboarding.skip")}</button>
      <p><Link to="/help">{t("onboarding.help")}</Link></p>
      <p>{t("onboarding.guideDoc")}</p>
    </section>
  );
}
