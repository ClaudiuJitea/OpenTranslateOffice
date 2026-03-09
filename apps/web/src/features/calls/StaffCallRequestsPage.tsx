import { useEffect, useMemo, useState } from "react";
import { getStaffCallRequests, type CallRequestRecord } from "./call-requests-client";
import { useI18n } from "../../i18n/I18nProvider";

export function StaffCallRequestsPage() {
  const { locale } = useI18n();
  const [items, setItems] = useState<CallRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const upcomingCount = useMemo(
    () => items.filter((item) => item.status === "PENDING").length,
    [items]
  );

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems() {
    setIsLoading(true);
    setError(null);

    try {
      const nextItems = await getStaffCallRequests();
      setItems(nextItems);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie mozna zaladowac prosb o kontakt."
            : "Unable to load callback requests."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-neutral-900 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
          {locale === "pl" ? "Zgloszenia telefoniczne" : "Call Requests"}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {locale === "pl" ? "Kolejka rozmow z klientami" : "Customer Callback Queue"}
        </h1>
        <p className="max-w-3xl leading-7 text-neutral-800">
          {locale === "pl"
            ? "Przegladaj prosby o kontakt telefoniczny wraz z numerem telefonu, opisem projektu, liczba stron i preferowanym terminem rozmowy."
            : "Review callback requests with the customer phone number, project summary, page count, and preferred call time."}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={locale === "pl" ? "Oczekujace" : "Pending"}
          value={isLoading ? "..." : String(upcomingCount)}
        />
        <MetricCard
          label={locale === "pl" ? "Wszystkie prosby" : "All requests"}
          value={isLoading ? "..." : String(items.length)}
        />
        <MetricCard
          label={locale === "pl" ? "Najblizszy telefon" : "Next call"}
          value={
            isLoading
              ? "..."
              : items[0]?.requestedCallAt
                ? formatDateTime(items[0].requestedCallAt, locale)
                : locale === "pl"
                  ? "Brak"
                  : "None"
          }
        />
      </section>

      <section className="border border-neutral-900">
        <div className="hidden gap-px bg-neutral-900 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_8rem_13rem_8rem]">
          {[
            locale === "pl" ? "Klient" : "Customer",
            locale === "pl" ? "Projekt" : "Project",
            locale === "pl" ? "Strony" : "Pages",
            locale === "pl" ? "Termin telefonu" : "Call Time",
            locale === "pl" ? "Status" : "Status"
          ].map((label) => (
            <div key={label} className="bg-paper px-4 py-3 text-xs uppercase tracking-[0.16em] text-neutral-700">
              {label}
            </div>
          ))}
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-neutral-700">
            {locale === "pl" ? "Ladowanie prosb o kontakt..." : "Loading callback requests..."}
          </p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-neutral-700">
            {locale === "pl" ? "Brak prosb o kontakt." : "There are no callback requests."}
          </p>
        ) : (
          <div className="divide-y divide-neutral-300">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_8rem_13rem_8rem] md:gap-4"
              >
                <div className="space-y-1">
                  <p className="font-semibold">{item.fullName}</p>
                  <p className="text-sm text-neutral-700">{item.phone}</p>
                </div>
                <p className="text-sm leading-6 text-neutral-800">{item.projectSummary}</p>
                <p className="text-sm font-medium">{item.declaredPageCount}</p>
                <div className="text-sm text-neutral-800">
                  {item.requestedCallAt ? formatDateTime(item.requestedCallAt, locale) : "-"}
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{item.status}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-900 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
