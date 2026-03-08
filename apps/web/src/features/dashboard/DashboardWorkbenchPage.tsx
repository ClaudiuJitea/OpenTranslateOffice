import { FormEvent, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { useAuth } from "../auth/AuthProvider";
import {
  aiTranslationDownloadUrl,
  addJobNote,
  assignJob,
  deleteJob,
  fetchAssignableUsers,
  fetchAssignedJobs,
  fetchJobDetail,
  refuseJob,
  sendAiTranslationToCustomer,
  sourceDocumentDownloadUrl,
  sourceDocumentViewUrl,
  translateSourceDocumentWithAi,
  uploadDeliverable,
  updateJobStatus,
  type AssignableUser,
  type JobDetailResponse,
  type JobSummary
} from "./dashboard-client";

const STATUS_OPTIONS = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "REVIEW",
  "WAITING_CUSTOMER",
  "BLOCKED",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "ARCHIVED",
  "REFUSED"
];

export function DashboardWorkbenchPage() {
  const { locale } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");
  const [actionModal, setActionModal] = useState<null | "assign" | "refuse" | "delete">(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedSourceDocumentId, setSelectedSourceDocumentId] = useState<string | null>(null);
  const [isAiTranslating, setIsAiTranslating] = useState(false);
  const [isSendingToCustomer, setIsSendingToCustomer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshJobs();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedJobId) {
      setDetail(null);
      return;
    }
    void refreshDetail(selectedJobId);
  }, [selectedJobId]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      try {
        setAssignableUsers(await fetchAssignableUsers());
      } catch {
        // handled by action feedback when used
      }
    })();
  }, [isAdmin]);

  const dueSoon = useMemo(
    () =>
      jobs.filter((job) => {
        if (!job.dueAt) return false;
        const due = new Date(job.dueAt).getTime();
        const diffHours = (due - Date.now()) / (1000 * 60 * 60);
        return diffHours > 0 && diffHours <= 24;
      }),
    [jobs]
  );
  const selectedAssignee = useMemo(
    () => assignableUsers.find((item) => item.id === selectedAssigneeId) ?? null,
    [assignableUsers, selectedAssigneeId]
  );

  async function refreshJobs() {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchAssignedJobs(statusFilter || undefined);
      setJobs(payload.items);
      if (!selectedJobId && payload.items.length > 0) {
        setSelectedJobId(payload.items[0].id);
      }
      if (selectedJobId && !payload.items.some((item) => item.id === selectedJobId)) {
        setSelectedJobId(payload.items[0]?.id ?? null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie mozna zaladowac przypisanych zadan."
            : "Unable to load assigned jobs"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDetail(jobId: string) {
    setError(null);
    try {
      const payload = await fetchJobDetail(jobId);
      setDetail(payload);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "JOB_NOT_FOUND") {
        setSelectedJobId(null);
        setDetail(null);
        await refreshJobs();
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie mozna zaladowac szczegolow zlecenia."
            : "Unable to load job detail"
      );
    }
  }

  async function onSubmitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get("content") ?? "").trim();
    if (!content) return;

    await addJobNote(selectedJobId, content);
    form.reset();
    await refreshDetail(selectedJobId);
  }

  async function onChangeStatus(toStatus: string) {
    if (!selectedJobId) return;
    await updateJobStatus(selectedJobId, toStatus);
    await refreshJobs();
    await refreshDetail(selectedJobId);
  }

  async function onUploadDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File)) return;

    await uploadDeliverable(selectedJobId, file);
    form.reset();
    await refreshJobs();
    await refreshDetail(selectedJobId);
  }

  async function onAssignSelected() {
    if (!isAdmin || !selectedJobId || !selectedAssigneeId) return;
    setActionModal("assign");
  }

  async function onRefuseSelected() {
    if (!isAdmin || !selectedJobId) return;
    setRefuseReason("");
    setActionModal("refuse");
  }

  async function onDeleteSelected() {
    if (!isAdmin || !selectedJobId) return;
    setActionModal("delete");
  }

  async function onConfirmAssign() {
    if (!selectedJobId || !selectedAssigneeId) return;
    setError(null);
    try {
      await assignJob(selectedJobId, selectedAssigneeId);
      setActionModal(null);
      await refreshJobs();
      await refreshDetail(selectedJobId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : locale === "pl" ? "Nie mozna przypisac zlecenia." : "Unable to assign job");
    }
  }

  async function onConfirmRefuse() {
    if (!selectedJobId) return;
    setError(null);
    try {
      await refuseJob(selectedJobId, refuseReason.trim() || undefined);
      setActionModal(null);
      await refreshJobs();
      await refreshDetail(selectedJobId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : locale === "pl" ? "Nie mozna odrzucic zlecenia." : "Unable to refuse job");
    }
  }

  async function onConfirmDelete() {
    if (!selectedJobId) return;
    setError(null);
    try {
      await deleteJob(selectedJobId);
      setActionModal(null);
      setSelectedJobId(null);
      setDetail(null);
      await refreshJobs();
    } catch (actionError) {
      if (actionError instanceof Error && actionError.message === "JOB_NOT_FOUND") {
        setActionModal(null);
        setSelectedJobId(null);
        setDetail(null);
        await refreshJobs();
        return;
      }
      setError(actionError instanceof Error ? actionError.message : locale === "pl" ? "Nie mozna usunac zlecenia." : "Unable to delete job");
    }
  }

  useEffect(() => {
    const sourceDocuments = detail?.sourceDocuments ?? [];
    if (!detail || sourceDocuments.length === 0) {
      setSelectedSourceDocumentId(null);
      return;
    }
    if (!selectedSourceDocumentId || !sourceDocuments.some((doc) => doc.id === selectedSourceDocumentId)) {
      setSelectedSourceDocumentId(sourceDocuments[0].id);
    }
  }, [detail, selectedSourceDocumentId]);

  const selectedDocTranslationRun = useMemo(() => {
    if (!detail || !selectedSourceDocumentId) return null;
    const run = detail.aiRuns.find((item) => {
      if (item.runType !== "document-translation" || !item.outputSummary) {
        return false;
      }
      try {
        const summary = JSON.parse(item.outputSummary) as { sourceDocumentId?: string };
        return summary.sourceDocumentId === selectedSourceDocumentId;
      } catch {
        return false;
      }
    });
    if (!run || !run.outputSummary) return null;
    try {
      const summary = JSON.parse(run.outputSummary) as {
        publishedDeliverableId?: string | null;
      };
      return {
        runId: run.id,
        status: run.status,
        publishedDeliverableId: summary.publishedDeliverableId ?? null
      };
    } catch {
      return {
        runId: run.id,
        status: run.status,
        publishedDeliverableId: null
      };
    }
  }, [detail, selectedSourceDocumentId]);

  async function onTranslateSelectedSourceWithAi() {
    if (!detail || !selectedSourceDocumentId) return;
    setIsAiTranslating(true);
    setError(null);
    try {
      await translateSourceDocumentWithAi(detail.job.id, selectedSourceDocumentId);
      await refreshDetail(detail.job.id);
      await refreshJobs();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : locale === "pl"
            ? "Nie udalo sie przetlumaczyc dokumentu przez AI."
            : "Unable to translate document with AI"
      );
    } finally {
      setIsAiTranslating(false);
    }
  }

  async function onSendAiResultToCustomer() {
    if (!detail || !selectedDocTranslationRun) return;
    setIsSendingToCustomer(true);
    setError(null);
    try {
      await sendAiTranslationToCustomer(detail.job.id, selectedDocTranslationRun.runId);
      await refreshDetail(detail.job.id);
      await refreshJobs();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : locale === "pl"
            ? "Nie udalo sie przekazac tlumaczenia klientowi."
            : "Unable to send translation to customer"
      );
    } finally {
      setIsSendingToCustomer(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-neutral-900 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
          {locale === "pl" ? "Panel pracownika" : "Employee Dashboard"}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {locale === "pl" ? "Stanowisko tlumaczen" : "Translation Workbench"}
        </h1>
        <p className="max-w-3xl leading-7 text-neutral-800">
          {locale === "pl"
            ? "Przegladaj przypisane zlecenia, aktualizuj status, uruchamiaj narzedzia AI i zapisuj notatki audytowe."
            : "Review assigned jobs, update status, run AI helper actions, and keep auditable notes."}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <div className="border border-neutral-900 p-4">
            <label htmlFor="statusFilter" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
              {locale === "pl" ? "Filtruj po statusie" : "Filter by status"}
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full border border-neutral-900 bg-paper px-3 py-2"
            >
              <option value="">{locale === "pl" ? "Wszystkie statusy" : "All statuses"}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="border border-neutral-900 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">
              {locale === "pl" ? "Termin wkrotce (24h)" : "Due Soon (24h)"}
            </p>
            {dueSoon.length === 0 ? (
              <p className="mt-2 text-sm">{locale === "pl" ? "Brak alertow terminowych." : "No due-soon alerts."}</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {dueSoon.map((job) => (
                  <li key={job.id} className="border-b border-neutral-200 pb-2">
                    <p className="font-medium">{job.title}</p>
                    <p>{formatDate(job.dueAt, locale)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-[42.5rem] flex-col border border-neutral-900 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">
              {locale === "pl" ? "Przypisane zlecenia" : "Assigned Jobs"}
            </p>
            {isLoading ? <p className="mt-2 text-sm">{locale === "pl" ? "Ladowanie zadan..." : "Loading jobs..."}</p> : null}
            <div className="editorial-scrollbar mt-3 flex-1 space-y-2 overflow-auto pr-1">
              {jobs.length === 0 ? (
                <p className="text-sm text-neutral-700">
                  {locale === "pl" ? "Brak przypisanych zlecen." : "No assigned jobs."}
                </p>
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    className={`w-full border px-3 py-3 text-left ${
                      selectedJobId === job.id
                        ? "border-neutral-900 bg-neutral-100"
                        : "border-neutral-300 hover:border-neutral-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-5">
                        {localizeJobTitle(job.title, locale)}
                      </p>
                      <span className="text-xs uppercase tracking-[0.14em] text-neutral-700">
                        {localizeStatus(job.status, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-700">
                      {localizeLanguage(job.sourceLang, locale)} {"->"} {localizeLanguage(job.targetLang, locale)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-9">
          {detail ? (
            (() => {
              const sourceDocuments = detail.sourceDocuments ?? [];
              return (
            <>
              <section className="border border-neutral-900 p-4">
                <h2 className="text-3xl font-semibold tracking-tight">{localizeJobTitle(detail.job.title, locale)}</h2>

                <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <div className="border border-neutral-300 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.14em] text-neutral-700">
                      {locale === "pl" ? "Status" : "Status"}
                    </dt>
                    <dd className="mt-1 font-medium">{localizeStatus(detail.job.status, locale)}</dd>
                  </div>
                  <div className="border border-neutral-300 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.14em] text-neutral-700">
                      {locale === "pl" ? "Priorytet" : "Priority"}
                    </dt>
                    <dd className="mt-1 font-medium">{localizePriority(detail.job.priority, locale)}</dd>
                  </div>
                  <div className="border border-neutral-300 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.14em] text-neutral-700">
                      {locale === "pl" ? "Para jezykowa" : "Language Pair"}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {localizeLanguage(detail.job.sourceLang, locale)} {"->"} {localizeLanguage(detail.job.targetLang, locale)}
                    </dd>
                  </div>
                  <div className="border border-neutral-300 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.14em] text-neutral-700">
                      {locale === "pl" ? "Termin" : "Deadline"}
                    </dt>
                    <dd className="mt-1 font-medium">{formatDate(detail.job.dueAt, locale)}</dd>
                  </div>
                </dl>

                <div className="mt-5 border-t border-neutral-300 pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="statusChange"
                      className="min-w-[7.5rem] text-xs uppercase tracking-[0.16em] text-neutral-700"
                    >
                      {locale === "pl" ? "Zmien status" : "Move status"}
                    </label>
                    <select
                      id="statusChange"
                      defaultValue={detail.job.status}
                      onChange={(event) => {
                        void onChangeStatus(event.target.value);
                      }}
                      className="h-10 min-w-[16rem] border border-neutral-900 bg-paper px-3"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{localizeStatus(status, locale)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="mt-6 border-t border-neutral-300 pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                        {locale === "pl" ? "Zarzadzanie zleceniem" : "Job Management"}
                      </p>
                      <p className="text-xs text-neutral-700">
                        {locale === "pl" ? "Aktywny przydzial: " : "Active assignment: "}
                        <span className="font-medium text-ink">
                          {detail.activeAssignments?.[0]?.fullName ?? (locale === "pl" ? "nieprzypisane" : "unassigned")}
                        </span>
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-12">
                      <div className="md:col-span-5">
                        <label htmlFor="assignee" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                          {locale === "pl" ? "Przypisz tlumacza" : "Assign translator"}
                        </label>
                        <select
                          id="assignee"
                          value={selectedAssigneeId}
                          onChange={(event) => setSelectedAssigneeId(event.target.value)}
                          className="mt-1 h-10 w-full border border-neutral-900 bg-paper px-3"
                        >
                          <option value="">{locale === "pl" ? "Wybierz osobe" : "Select person"}</option>
                          {assignableUsers.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.fullName} ({person.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-end gap-2 md:col-span-5">
                        <button
                          type="button"
                          onClick={() => {
                            void onAssignSelected();
                          }}
                          className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
                        >
                          {locale === "pl" ? "Przypisz" : "Assign"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onRefuseSelected();
                          }}
                          className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
                        >
                          {locale === "pl" ? "Odrzuc zlecenie" : "Refuse Job"}
                        </button>
                      </div>

                      <div className="flex items-end md:col-span-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            void onDeleteSelected();
                          }}
                          className="h-10 border border-accent px-4 text-xs uppercase tracking-[0.16em] text-accent"
                        >
                          {locale === "pl" ? "Usun zlecenie" : "Delete Job"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="border border-neutral-900 p-4">
                <h3 className="text-lg font-semibold">{locale === "pl" ? "Dostawa / Eksport" : "Delivery / Export"}</h3>
                <p className="mt-2 text-sm text-neutral-700">
                  {locale === "pl"
                    ? "Przeslij finalne pliki tlumaczenia. Portal klienta umozliwi pobranie po dostarczeniu."
                    : "Upload finalized translated files. Customer portal can download once available."}
                </p>
                <form className="mt-3 flex items-end gap-3" onSubmit={onUploadDeliverable}>
                  <div className="flex-1">
                    <label htmlFor="deliverableFile" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                      {locale === "pl" ? "Plik finalny" : "Final file"}
                    </label>
                    <input
                      id="deliverableFile"
                      name="file"
                      type="file"
                      required
                      className="mt-1 w-full border border-neutral-900 bg-paper px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="border border-neutral-900 bg-ink px-4 py-2 text-xs uppercase tracking-[0.16em] text-paper"
                  >
                    {locale === "pl" ? "Przeslij" : "Upload"}
                  </button>
                </form>
                <ul className="mt-4 space-y-2 text-sm">
                  {detail.deliverables.length === 0 ? (
                    <li>{locale === "pl" ? "Brak przeslanych plikow finalnych." : "No deliverables uploaded yet."}</li>
                  ) : (
                    detail.deliverables.map((file) => (
                      <li key={file.id} className="border-b border-neutral-200 pb-2">
                        <p>{file.originalName}</p>
                        <p className="text-xs text-neutral-700">{formatDate(file.createdAt, locale)}</p>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="border border-neutral-900 p-4">
                <h3 className="text-lg font-semibold">{locale === "pl" ? "Notatki wewnetrzne" : "Internal Notes"}</h3>
                <form className="mt-3 space-y-2" onSubmit={onSubmitNote}>
                  <label htmlFor="noteContent" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                    {locale === "pl" ? "Dodaj notatke" : "Add note"}
                  </label>
                  <textarea
                    id="noteContent"
                    name="content"
                    required
                    rows={3}
                    className="w-full border border-neutral-900 bg-paper px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="border border-neutral-900 bg-ink px-4 py-2 text-xs uppercase tracking-[0.16em] text-paper"
                  >
                    {locale === "pl" ? "Zapisz notatke" : "Save Note"}
                  </button>
                </form>
                <ul className="mt-4 space-y-2 text-sm">
                  {detail.notes.slice(0, 12).map((note) => (
                    <li key={note.id} className="border-b border-neutral-200 pb-2">
                      <p>{note.content}</p>
                      <p className="text-xs text-neutral-700">{note.authorName ?? (locale === "pl" ? "Nieznany" : "Unknown")} • {formatDate(note.createdAt, locale)}</p>
                    </li>
                  ))}
                </ul>
              </section>

            </>
              );
            })()
          ) : (
            <section className="border border-neutral-900 p-6">
              <p>{locale === "pl" ? "Wybierz zlecenie z kolejki, aby otworzyc stanowisko pracy." : "Select a job from the assigned queue to open the workbench."}</p>
            </section>
          )}
        </div>
      </section>

      {detail ? (
        (() => {
          const sourceDocuments = detail.sourceDocuments ?? [];
          const selectedDoc =
            sourceDocuments.find((doc) => doc.id === selectedSourceDocumentId) ??
            sourceDocuments[0] ??
            null;
          return (
            <section className="border border-neutral-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{locale === "pl" ? "Podglad dokumentu zrodlowego" : "Source Document Viewer"}</h3>
                {sourceDocuments.length > 0 ? (
                  <div className="min-w-[20rem] space-y-1">
                    <label htmlFor="sourceDocSelect" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                      {locale === "pl" ? "Dokument zrodlowy" : "Source document"}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="sourceDocSelect"
                        value={selectedSourceDocumentId ?? selectedDoc?.id ?? ""}
                        onChange={(event) => setSelectedSourceDocumentId(event.target.value)}
                        className="h-10 w-full border border-neutral-900 bg-paper px-3 text-sm"
                      >
                        {sourceDocuments.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.originalName}
                          </option>
                        ))}
                      </select>
                      {selectedDoc ? (
                        <span className="whitespace-nowrap text-xs text-neutral-700">
                          {Math.round(selectedDoc.sizeBytes / 1024)} KB
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              {sourceDocuments.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-700">
                  {locale === "pl"
                    ? "Brak dokumentow zrodlowych przypisanych do tego zlecenia."
                    : "No source documents are attached to this job."}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedDoc ? (
                    <>
                      <iframe
                        title={locale === "pl" ? "Podglad dokumentu zrodlowego" : "Source document preview"}
                        src={sourceDocumentViewUrl(detail.job.id, selectedDoc.id)}
                        className="h-[98vh] min-h-[72rem] w-full border border-neutral-900 bg-paper"
                      />
                      <a
                        href={sourceDocumentDownloadUrl(detail.job.id, selectedDoc.id)}
                        className="inline-block underline underline-offset-4 text-sm"
                      >
                        {locale === "pl" ? "Pobierz dokument zrodlowy" : "Download source document"}
                      </a>

                      <div className="border border-neutral-900 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                          {locale === "pl" ? "AI tlumaczenie dokumentu" : "AI Document Translation"}
                        </p>
                        <p className="mt-2 text-sm text-neutral-700">
                          {locale === "pl"
                            ? "Przetlumacz wybrany plik z zachowaniem rodziny formatu. Po sprawdzeniu mozesz wyslac plik bezposrednio do portalu klienta."
                            : "Translate selected file and keep output in the same file family. After review, you can send it directly to customer portal."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void onTranslateSelectedSourceWithAi();
                            }}
                            disabled={isAiTranslating}
                            className="h-10 border border-neutral-900 bg-ink px-4 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-50"
                          >
                            {isAiTranslating
                              ? locale === "pl"
                                ? "Tlumaczenie..."
                                : "Translating..."
                              : locale === "pl"
                                ? "Przetlumacz przez AI"
                                : "Translate with AI"}
                          </button>

                          {selectedDocTranslationRun ? (
                            <a
                              href={aiTranslationDownloadUrl(detail.job.id, selectedDocTranslationRun.runId)}
                              className="inline-flex h-10 items-center border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em] underline underline-offset-4"
                            >
                              {locale === "pl" ? "Pobierz tlumaczenie" : "Download translation"}
                            </a>
                          ) : null}

                          {selectedDocTranslationRun ? (
                            <button
                              type="button"
                              disabled={
                                isSendingToCustomer ||
                                Boolean(selectedDocTranslationRun.publishedDeliverableId) ||
                                selectedDocTranslationRun.status !== "COMPLETED"
                              }
                              onClick={() => {
                                void onSendAiResultToCustomer();
                              }}
                              className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em] disabled:opacity-50"
                            >
                              {locale === "pl" ? "Wyslij do klienta" : "Send to customer"}
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-neutral-700">
                          {selectedDocTranslationRun
                            ? selectedDocTranslationRun.publishedDeliverableId
                              ? locale === "pl"
                                ? "Status: wyslane do klienta i dostepne w portalu."
                                : "Status: sent to customer and available in portal."
                              : selectedDocTranslationRun.status === "FAILED"
                                ? locale === "pl"
                                  ? "Status: tlumaczenie nieudane."
                                  : "Status: translation failed."
                                : locale === "pl"
                                  ? "Status: tlumaczenie gotowe do pobrania lub wysylki."
                                  : "Status: translation ready for download or delivery."
                            : locale === "pl"
                              ? "Brak tlumaczenia AI dla tego dokumentu."
                              : "No AI translation generated for this document yet."}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-700">
                      {locale === "pl" ? "Wybierz dokument, aby zobaczyc podglad." : "Select a document to preview."}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })()
      ) : null}

      {actionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg border border-neutral-900 bg-paper p-5"
          >
            {actionModal === "assign" ? (
              <>
                <h3 className="text-xl font-semibold tracking-tight">
                  {locale === "pl" ? "Potwierdz przypisanie" : "Confirm Assignment"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-800">
                  {locale === "pl"
                    ? `Czy przypisac to zlecenie do: ${selectedAssignee?.fullName ?? "-"}?`
                    : `Assign this job to: ${selectedAssignee?.fullName ?? "-"}?`}
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void onConfirmAssign();
                    }}
                    className="h-10 border border-neutral-900 bg-ink px-4 text-xs uppercase tracking-[0.16em] text-paper"
                  >
                    {locale === "pl" ? "Potwierdz" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
                  >
                    {locale === "pl" ? "Anuluj" : "Cancel"}
                  </button>
                </div>
              </>
            ) : null}

            {actionModal === "refuse" ? (
              <>
                <h3 className="text-xl font-semibold tracking-tight">
                  {locale === "pl" ? "Odrzucenie zlecenia" : "Refuse Job"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-800">
                  {locale === "pl"
                    ? "Opcjonalnie podaj powod odrzucenia. Status zostanie zmieniony na Odrzucone."
                    : "Optionally provide a reason. The status will be changed to Refused."}
                </p>
                <label htmlFor="refuseReason" className="mt-4 block text-xs uppercase tracking-[0.16em] text-neutral-700">
                  {locale === "pl" ? "Powod (opcjonalnie)" : "Reason (optional)"}
                </label>
                <textarea
                  id="refuseReason"
                  value={refuseReason}
                  onChange={(event) => setRefuseReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-neutral-900 bg-paper px-3 py-2"
                />
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void onConfirmRefuse();
                    }}
                    className="h-10 border border-neutral-900 bg-ink px-4 text-xs uppercase tracking-[0.16em] text-paper"
                  >
                    {locale === "pl" ? "Potwierdz odrzucenie" : "Confirm Refusal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
                  >
                    {locale === "pl" ? "Anuluj" : "Cancel"}
                  </button>
                </div>
              </>
            ) : null}

            {actionModal === "delete" ? (
              <>
                <h3 className="text-xl font-semibold tracking-tight">
                  {locale === "pl" ? "Usun zlecenie" : "Delete Job"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-800">
                  {locale === "pl"
                    ? "Czy na pewno usunac to zlecenie? Tej operacji nie mozna cofnac."
                    : "Are you sure you want to delete this job? This action cannot be undone."}
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void onConfirmDelete();
                    }}
                    className="h-10 border border-accent bg-paper px-4 text-xs uppercase tracking-[0.16em] text-accent"
                  >
                    {locale === "pl" ? "Tak, usun" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="h-10 border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
                  >
                    {locale === "pl" ? "Anuluj" : "Cancel"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string | null | undefined, locale: "en" | "pl" = "en") {
  if (!value) return locale === "pl" ? "Nie ustawiono" : "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === "pl" ? "Nie ustawiono" : "Not set";
  return date.toLocaleString(locale === "pl" ? "pl-PL" : "en-US");
}

function localizeStatus(status: string, locale: "en" | "pl") {
  if (locale !== "pl") return status;
  const map: Record<string, string> = {
    NEW: "Nowe",
    TRIAGED: "Po triage",
    IN_PROGRESS: "W trakcie",
    REVIEW: "Weryfikacja",
    WAITING_CUSTOMER: "Oczekiwanie na klienta",
    BLOCKED: "Zablokowane",
    READY_FOR_DELIVERY: "Gotowe do dostawy",
    DELIVERED: "Dostarczone",
    ARCHIVED: "Zarchiwizowane",
    REFUSED: "Odrzucone"
  };
  return map[status] ?? status;
}

function localizePriority(priority: string, locale: "en" | "pl") {
  if (locale !== "pl") return priority;
  const map: Record<string, string> = {
    LOW: "Niski",
    MEDIUM: "Sredni",
    HIGH: "Wysoki",
    URGENT: "Pilny"
  };
  return map[priority] ?? priority;
}

function localizeLanguage(language: string, locale: "en" | "pl") {
  if (locale !== "pl") return language;
  const map: Record<string, string> = {
    english: "angielski",
    polish: "polski",
    german: "niemiecki",
    french: "francuski",
    spanish: "hiszpanski",
    italian: "wloski",
    portuguese: "portugalski",
    dutch: "holenderski",
    arabic: "arabski",
    japanese: "japonski",
    chinese: "chinski"
  };
  const key = language.trim().toLowerCase();
  return map[key] ?? language;
}

function localizeJobTitle(title: string, locale: "en" | "pl") {
  if (locale !== "pl") return title;
  return title.replace(/\s+translation$/i, " tlumaczenie");
}
