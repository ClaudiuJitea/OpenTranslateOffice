import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import {
  createIntakeChatSession,
  getIntakeChatSession,
  sendIntakeChatMessage,
  uploadIntakeChatFiles,
  type IntakeChatSession
} from "./intake-client";

export function IntakeSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [session, setSession] = useState<IntakeChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const completionModalSeenRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      setIsLoading(true);
      setError(null);
      try {
        if (!sessionId) {
          const created = await createIntakeChatSession(
            locale === "pl"
              ? "Witamy w Open Translate Office. Pomoge Ci krok po kroku zebrac wymagania do tlumaczenia. Zaczynamy od imienia i nazwiska."
              : undefined,
            locale
          );
          if (!cancelled) {
            navigate(`/intake/${created.id}`, { replace: true });
          }
          return;
        }

        const loaded = await getIntakeChatSession(sessionId);
        if (!cancelled) {
          setSession(loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : locale === "pl" ? "Nie mozna uruchomic sesji." : "Unable to initialize intake session");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [navigate, sessionId, locale]);

  const missingLabels = useMemo(
    () =>
      (session?.missing ?? []).map((field) => ({
        key: field,
        label: prettyFieldLabel(field, locale)
      })),
    [session?.missing, locale]
  );

  useEffect(() => {
    if (!session) return;
    const isComplete =
      session.completenessScore >= 100 &&
      session.uploadedFilesCount > 0 &&
      session.missing.length === 0 &&
      Boolean(session.portalCredentials);
    if (!isComplete) return;
    if (completionModalSeenRef.current.has(session.id)) return;
    completionModalSeenRef.current.add(session.id);
    setShowCompletionModal(true);
  }, [session]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [session?.id, session?.messages.length]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const content = String(formData.get("message") ?? "").trim();
    if (!content) {
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      const updated = await sendIntakeChatMessage(session.id, content, locale);
      setSession(updated);
      formElement.reset();
      inputRef.current?.focus();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  async function onUploadFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const list = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const updated = await uploadIntakeChatFiles(session.id, list, locale);
      setSession(updated);
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function applyTimeframe(value: "standard" | "urgent" | "high-priority") {
    if (!session) return;
    const message =
      value === "standard"
        ? "timeframe standard 2 days"
        : value === "urgent"
          ? "timeframe urgent next day"
          : "timeframe high priority same day";
    try {
      setError(null);
      const updated = await sendIntakeChatMessage(session.id, message, locale);
      setSession(updated);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to set timeframe");
    }
  }

  return (
    <section className="relative grid gap-8 lg:grid-cols-12">
      <header className="space-y-3 border-b border-neutral-900 pb-6 lg:col-span-12">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("intake.kicker")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{t("intake.title")}</h1>
        <p className="max-w-3xl leading-7 text-neutral-800">
          {t("intake.subtitle")}
        </p>
      </header>

      <aside className="space-y-6 border border-neutral-900 p-5 lg:col-span-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Sesja" : "Session"}</p>
          <p className="mt-1 text-sm">{session?.id ?? (locale === "pl" ? "Przygotowanie..." : "Preparing...")}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Kompletnosc" : "Completeness"}</p>
          <p className="mt-1 text-3xl font-semibold">{session?.completenessScore ?? 0}%</p>
          <div className="mt-2 h-2 w-full border border-neutral-900" aria-hidden="true">
            <div
              className="h-full bg-ink"
              style={{ width: `${session?.completenessScore ?? 0}%` }}
            />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Dostawca LLM" : "LLM Provider"}</p>
          <p className="mt-1 text-sm">{session?.providerUsed ?? "system"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Przeslane pliki" : "Uploaded Files"}</p>
          <p className="mt-1 text-sm">{session?.uploadedFilesCount ?? 0}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Brakujace pola wymagane" : "Missing Required Fields"}</p>
          {missingLabels.length === 0 ? (
            <p className="mt-2 text-sm">{locale === "pl" ? "Brak brakujacych wymaganych pol." : "No missing required fields."}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {missingLabels.map((field) => (
                <li key={field.key} className="border-b border-neutral-200 pb-1">
                  {field.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/request" className="inline-block underline underline-offset-4">
          {t("intake.fullForm")}
        </Link>

        {session?.portalCredentials ? (
          <div className="border border-neutral-900 p-3 text-sm">
            <p className="font-medium">{locale === "pl" ? "Dane sledzenia" : "Tracking Credentials"}</p>
            <p>{locale === "pl" ? "Zgloszenie:" : "Request:"} {session.portalCredentials.requestNumber}</p>
            <p>{locale === "pl" ? "Haslo:" : "Password:"} {session.portalCredentials.portalPassword}</p>
            <Link to="/portal/login" className="mt-2 inline-block underline underline-offset-4">
              {t("intake.openPortal")}
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="flex h-[75vh] min-h-[30rem] max-h-[46rem] flex-col overflow-hidden border border-neutral-900 lg:col-span-8">
        <div ref={messagesContainerRef} className="editorial-scrollbar flex-1 space-y-3 overflow-y-auto p-5">
          {isLoading ? <p>{locale === "pl" ? "Ladowanie sesji..." : "Loading session..."}</p> : null}
          {error ? (
            <p role="alert" className="border border-accent p-3 text-sm">
              {error}
            </p>
          ) : null}
          {session?.messages.map((message) => (
            <article
              key={message.id}
              className={message.speaker === "USER" ? "ml-10 border border-neutral-900 p-3" : "mr-10 border border-neutral-300 bg-neutral-50 p-3"}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-neutral-700">{message.speaker}</p>
              <p className="mt-1 leading-7">{message.content}</p>
            </article>
          ))}
        </div>

        <form onSubmit={onSubmit} className="border-t border-neutral-900 p-4">
          <label htmlFor="message" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {t("intake.yourMessage")}
          </label>
          <div className="mt-2 flex gap-3">
            <input
              ref={inputRef}
              id="message"
              name="message"
              required
              className="w-full border border-neutral-900 bg-paper px-3 py-3"
              placeholder={locale === "pl" ? "Wpisz odpowiedz" : "Type your response"}
            />
            <button
              type="submit"
              disabled={isSending || isLoading || !session}
              className="border border-neutral-900 bg-ink px-5 py-3 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-60"
            >
              {isSending ? (locale === "pl" ? "Wysylanie" : "Sending") : t("intake.send")}
            </button>
          </div>
        </form>

        <div className="border-t border-neutral-900 p-4">
          <form onSubmit={onUploadFiles} className="space-y-2">
            <label htmlFor="chat-files" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
              {t("intake.uploadDocuments")}
            </label>
            <input
              id="chat-files"
              name="files"
              type="file"
              multiple
              required
              className="w-full border border-neutral-900 bg-paper px-3 py-2"
            />
            <button
              type="submit"
              disabled={uploading || !session}
              className="border border-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.16em]"
            >
              {uploading ? t("intake.uploading") : t("intake.uploadFiles")}
            </button>
          </form>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{t("intake.timeframe")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { void applyTimeframe("standard"); }} className="border border-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.16em]">{t("intake.standard")}</button>
              <button type="button" onClick={() => { void applyTimeframe("urgent"); }} className="border border-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.16em]">{t("intake.urgent")}</button>
              <button type="button" onClick={() => { void applyTimeframe("high-priority"); }} className="border border-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.16em]">{t("intake.highPriority")}</button>
            </div>
          </div>
        </div>
      </div>

      {showCompletionModal && session?.portalCredentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-complete-title"
            className="w-full max-w-xl border border-neutral-900 bg-paper p-6"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-700">{locale === "pl" ? "Zgloszenie gotowe" : "Request Ready"}</p>
            <h2 id="request-complete-title" className="mt-2 text-2xl font-semibold tracking-tight">
              {locale === "pl" ? "Twoje zgloszenie zostalo utworzone" : "Your request was created successfully"}
            </h2>
            <p className="mt-3 leading-7 text-neutral-800">
              {locale === "pl"
                ? "Uzyj tych danych w portalu klienta, aby sledzic status i pobrac tlumaczenie po dostarczeniu."
                : "Use these credentials in the customer portal to track status and download the translated file when it is delivered."}
            </p>

            <div className="mt-5 space-y-2 border border-neutral-900 p-4 text-sm">
              <p>
                {locale === "pl" ? "Numer zgloszenia:" : "Request number:"} <span className="font-semibold">{session.portalCredentials.requestNumber}</span>
              </p>
              <p>
                {locale === "pl" ? "Haslo:" : "Password:"} <span className="font-semibold">{session.portalCredentials.portalPassword}</span>
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false);
                  navigate("/intake/chat");
                }}
                className="border border-neutral-900 bg-ink px-4 py-2 text-xs uppercase tracking-[0.16em] text-paper"
              >
                {locale === "pl" ? "Utworz nowe zgloszenie" : "Create New Request"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false);
                  navigate("/");
                }}
                className="border border-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.16em]"
              >
                {locale === "pl" ? "Strona glowna" : "Main Page"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function prettyFieldLabel(value: string, locale: "en" | "pl") {
  if (locale === "pl") {
    switch (value) {
      case "fullName":
        return "Imie i nazwisko";
      case "email":
        return "Email";
      case "sourceLanguage":
        return "Jezyk zrodlowy";
      case "targetLanguage":
        return "Jezyk docelowy";
      case "documentType":
        return "Typ dokumentu";
      case "fileType":
        return "Typ pliku";
      case "certificationRequired":
        return "Wymagana certyfikacja";
      case "urgency":
        return "Termin";
      case "files":
        return "Przeslane pliki";
      default:
        return value;
    }
  }

  switch (value) {
    case "fullName":
      return "Full name";
    case "email":
      return "Email";
    case "sourceLanguage":
      return "Source language";
    case "targetLanguage":
      return "Target language";
    case "documentType":
      return "Document type";
    case "fileType":
      return "File type";
    case "certificationRequired":
      return "Certification requirement";
    case "urgency":
      return "Timeframe";
    case "files":
      return "Uploaded files";
    default:
      return value;
  }
}
