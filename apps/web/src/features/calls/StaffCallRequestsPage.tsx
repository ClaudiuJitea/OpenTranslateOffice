import { useEffect, useMemo, useState } from "react";
import {
  deleteCallRequest,
  getStaffCallRequests,
  syncLatestRecording,
  updateCallRequestStatus,
  type CallRequestRecord
} from "./call-requests-client";
import { useI18n } from "../../i18n/I18nProvider";

const STATUS_OPTIONS: CallRequestRecord["status"][] = [
  "PENDING",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED"
];

export function StaffCallRequestsPage() {
  const { locale } = useI18n();
  const [items, setItems] = useState<CallRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | CallRequestRecord["status"]>("ALL");

  const upcomingCount = useMemo(
    () => items.filter((item) => item.status === "PENDING").length,
    [items]
  );
  const nextPendingCall = useMemo(
    () =>
      [...items]
        .filter((item) => item.status === "PENDING" && item.requestedCallAt)
        .sort((left, right) => new Date(left.requestedCallAt!).getTime() - new Date(right.requestedCallAt!).getTime())[0] ?? null,
    [items]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => statusFilter === "ALL" || item.status === statusFilter),
    [items, statusFilter]
  );
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  async function handleSyncLatest() {
    setIsSyncing(true);
    setSyncNotice(null);
    setError(null);
    try {
      const result = await syncLatestRecording();
      setSyncNotice(
        locale === "pl"
          ? result.importedCount > 0
            ? `Zaimportowano ${result.importedCount} nowych rozmow z ElevenLabs.`
            : "Brak nowych rozmow do zaimportowania."
          : result.importedCount > 0
            ? `Imported ${result.importedCount} new ElevenLabs conversations.`
            : "No new ElevenLabs conversations to import."
      );
      void loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleStatusChange(id: string, status: CallRequestRecord["status"]) {
    setSavingStatusId(id);
    setError(null);
    setSyncNotice(null);
    try {
      const updated = await updateCallRequestStatus(id, status);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : locale === "pl"
            ? "Nie mozna zaktualizowac statusu."
            : "Unable to update status."
      );
    } finally {
      setSavingStatusId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    setSyncNotice(null);
    try {
      await deleteCallRequest(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : locale === "pl"
            ? "Nie mozna usunac prosby o kontakt."
            : "Unable to delete call request."
      );
    } finally {
      setDeletingId(null);
    }
  }

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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-900 pb-4">
        <div className="space-y-2">
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
        </div>
        <div>
          <button
            type="button"
            onClick={() => void handleSyncLatest()}
            disabled={isSyncing}
            className="border border-neutral-900 bg-ink px-6 py-3 text-xs uppercase tracking-[0.16em] text-paper transition-colors hover:bg-neutral-800 disabled:opacity-50 whitespace-nowrap"
          >
            {isSyncing 
               ? (locale === "pl" ? "Synchronizowanie..." : "Syncing...") 
               : (locale === "pl" ? "Importuj nowe z ElevenLabs" : "Import New from ElevenLabs")}
          </button>
        </div>
      </header>
      
      {syncNotice ? (
        <p className="border border-green-700 p-3 text-sm text-green-700">
          {syncNotice}
        </p>
      ) : null}

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
              : nextPendingCall?.requestedCallAt
                ? formatDateTime(nextPendingCall.requestedCallAt, locale)
                : locale === "pl"
                  ? "Brak"
                  : "None"
          }
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 border border-neutral-900 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Widok kolejki" : "Queue View"}
          </p>
          <p className="text-sm text-neutral-700">
            {locale === "pl"
              ? "Najnowsze zgloszenia sa wyswietlane na gorze."
              : "Newest callback requests are shown first."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="statusFilter" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Filtr statusu" : "Status Filter"}
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | CallRequestRecord["status"])}
            className="h-10 border border-neutral-900 bg-paper px-3 text-xs uppercase tracking-[0.12em]"
          >
            <option value="ALL">{locale === "pl" ? "Wszystkie" : "All"}</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {localizeStatus(status, locale)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden border border-neutral-900">
        <div className="hidden border-b border-neutral-900 md:grid md:grid-cols-[minmax(9rem,1fr)_minmax(8rem,0.9fr)_minmax(12rem,1.25fr)_5.5rem_9.5rem_8.5rem_7rem]">
          {[
            locale === "pl" ? "Klient" : "Customer",
            locale === "pl" ? "Telefon" : "Phone Number",
            locale === "pl" ? "Projekt" : "Project",
            locale === "pl" ? "Strony" : "Pages",
            locale === "pl" ? "Termin telefonu" : "Call Time",
            locale === "pl" ? "Status" : "Status",
            locale === "pl" ? "Akcje" : "Actions"
          ].map((label) => (
            <div
              key={label}
              className="border-r border-neutral-900 px-4 py-3 text-xs uppercase tracking-[0.16em] text-neutral-700 last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-neutral-700">
            {locale === "pl" ? "Ladowanie prosb o kontakt..." : "Loading callback requests..."}
          </p>
        ) : visibleItems.length === 0 ? (
          <p className="p-4 text-sm text-neutral-700">
            {locale === "pl" ? "Brak prosb o kontakt w tym widoku." : "There are no callback requests in this view."}
          </p>
        ) : (
          <div className="divide-y divide-neutral-300">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="grid items-start gap-3 px-4 py-4 md:min-h-[4.75rem] md:grid-cols-[minmax(9rem,1fr)_minmax(8rem,0.9fr)_minmax(12rem,1.25fr)_5.5rem_9.5rem_8.5rem_7rem] md:gap-0 md:px-0 md:py-0"
              >
                <div className="min-w-0 md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <div className="space-y-2">
                    <p className="font-semibold">{item.fullName}</p>
                    <span className="inline-block border border-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-neutral-700">
                      {item.source === "ELEVENLABS"
                        ? "ElevenLabs"
                        : locale === "pl"
                          ? "Strona"
                          : "Website"}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <p className="truncate text-sm text-neutral-700">{item.phone}</p>
                </div>
                <div className="min-w-0 md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <p className="truncate text-sm text-neutral-800">{item.projectSummary}</p>
                </div>
                <div className="md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <p className="text-sm font-medium">{item.declaredPageCount}</p>
                </div>
                <div className="md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <p className="text-sm text-neutral-800">
                    {item.requestedCallAt ? formatDateTime(item.requestedCallAt, locale) : "-"}
                  </p>
                </div>
                <div className="md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <select
                    value={item.status}
                    onChange={(event) => {
                      void handleStatusChange(
                        item.id,
                        event.target.value as CallRequestRecord["status"]
                      );
                    }}
                    disabled={savingStatusId === item.id}
                    className="h-10 w-full min-w-0 border border-neutral-900 bg-paper px-2 text-xs uppercase tracking-[0.04em] disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {localizeStatus(status, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:flex md:h-full md:items-center md:px-4 md:py-4">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(item.id);
                    }}
                    disabled={deletingId === item.id}
                    className="h-10 w-full min-w-0 border border-accent px-2 text-xs uppercase tracking-[0.08em] text-accent disabled:opacity-50"
                  >
                    {deletingId === item.id
                      ? locale === "pl"
                        ? "Usuwanie..."
                        : "Deleting..."
                      : locale === "pl"
                        ? "Usun"
                        : "Delete"}
                  </button>
                </div>
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

function localizeStatus(status: CallRequestRecord["status"], locale: string) {
  if (locale === "pl") {
    switch (status) {
      case "PENDING":
        return "Oczekujace";
      case "SCHEDULED":
        return "Zaplanowane";
      case "COMPLETED":
        return "Zakonczone";
      case "CANCELLED":
        return "Anulowane";
      default:
        return status;
    }
  }

  switch (status) {
    case "PENDING":
      return "Pending";
    case "SCHEDULED":
      return "Scheduled";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
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
