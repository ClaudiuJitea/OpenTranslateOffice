import { useI18n } from "../../i18n/I18nProvider";

export function DashboardPlaceholderPage() {
  const { locale } = useI18n();

  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
        {locale === "pl" ? "Pracownik" : "Employee"}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        {locale === "pl" ? "Stanowisko pracownika" : "Employee Workbench"}
      </h1>
      <p className="max-w-3xl leading-7 text-neutral-800">
        {locale === "pl"
          ? "Kolejka przydziałów, stanowisko tłumaczeniowe i wsparcie AI są planowane na Fazę 5."
          : "Assigned queue, translation workbench, and AI support tools are planned for Phase 5."}
      </p>
    </section>
  );
}
