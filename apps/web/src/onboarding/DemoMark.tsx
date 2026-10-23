import { useT } from "../i18n/locale-context";

export function DemoMark() {
  const t = useT();
  return <p className="demo-mark" data-demo="synthetic">{t("demo.mark")}</p>;
}
