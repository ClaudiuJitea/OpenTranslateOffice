import { useI18n } from "../../i18n/I18nProvider";

export function AdminPlaceholderPage() {
  const { locale } = useI18n();

  return (
    <section className="space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">Admin</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        {locale === "pl" ? "Panel administracyjny" : "Admin Control"}
      </h1>
      <p className="max-w-3xl leading-7 text-neutral-800">
        {locale === "pl"
          ? "Kontrola przydzialow, rozkladu obciazenia i kompletnosci zgloszen jest planowana w Fazie 8."
          : "Assignment controls, workload distribution, and intake completeness views are planned in Phase 8."}
      </p>
    </section>
  );
}
