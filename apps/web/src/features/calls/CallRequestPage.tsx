import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createCallRequest } from "./call-requests-client";
import { useI18n } from "../../i18n/I18nProvider";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function CallRequestPage() {
  const { locale } = useI18n();
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [submittedCallAt, setSubmittedCallAt] = useState<string | null>(null);
  const minDateTime = useMemo(() => new Date().toISOString().slice(0, 16), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fullName = String(form.get("fullName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const projectSummary = String(form.get("projectSummary") ?? "").trim();
    const declaredPageCount = Number(form.get("declaredPageCount"));
    const requestedCallAtRaw = String(form.get("requestedCallAt") ?? "").trim();

    if (!fullName) {
      setError(locale === "pl" ? "Imie i nazwisko jest wymagane." : "Full name is required.");
      setState("error");
      return;
    }

    if (phone.length < 5) {
      setError(locale === "pl" ? "Numer telefonu jest za krotki." : "Phone number is too short.");
      setState("error");
      return;
    }

    if (projectSummary.length < 10) {
      setError(
        locale === "pl"
          ? "Opis projektu musi miec co najmniej 10 znakow."
          : "Project summary must be at least 10 characters."
      );
      setState("error");
      return;
    }

    if (!Number.isInteger(declaredPageCount) || declaredPageCount <= 0) {
      setError(
        locale === "pl"
          ? "Liczba stron musi byc dodatnia liczba calkowita."
          : "Number of pages must be a positive whole number."
      );
      setState("error");
      return;
    }

    if (!requestedCallAtRaw) {
      setError(
        locale === "pl"
          ? "Data i godzina telefonu sa wymagane."
          : "Preferred call date and time are required."
      );
      setState("error");
      return;
    }

    setState("submitting");

    try {
      const requestedCallAtIso = new Date(requestedCallAtRaw).toISOString();
      const item = await createCallRequest({
        fullName,
        phone,
        projectSummary,
        declaredPageCount,
        requestedCallAtIso
      });

      setSubmittedName(item.fullName);
      setSubmittedCallAt(item.requestedCallAt);
      setState("success");
      formElement.reset();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : locale === "pl"
            ? "Nie mozna wyslac prosby o kontakt."
            : "Unable to submit call request."
      );
      setState("error");
    }
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-900 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
          {locale === "pl" ? "Kontakt telefoniczny" : "Phone Callback"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {locale === "pl" ? "Popros o oddzwonienie" : "Request a Callback"}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-neutral-800">
          {locale === "pl"
            ? "Zostaw podstawowe informacje, a nasz zespol tlumaczy oddzwoni we wskazanym terminie, aby omowic projekt."
            : "Leave a few details and one of our translators will call you back at the requested time to review the project."}
        </p>
      </header>

      {state === "success" ? (
        <section className="border border-neutral-900 p-6" aria-live="polite">
          <h2 className="text-2xl font-semibold tracking-tight">
            {locale === "pl" ? "Prosba o kontakt zapisana" : "Callback Request Received"}
          </h2>
          <p className="mt-2">
            {locale === "pl"
              ? `Zapisalismy prosbe dla ${submittedName ?? "klienta"}.`
              : `We recorded the callback request for ${submittedName ?? "the customer"}.`}
          </p>
          {submittedCallAt ? (
            <p className="mt-1 text-sm text-neutral-700">
              {locale === "pl" ? "Preferowany termin:" : "Requested time:"}{" "}
              {formatDateTime(submittedCallAt, locale)}
            </p>
          ) : null}
          <Link className="mt-4 inline-block underline underline-offset-4" to="/">
            {locale === "pl" ? "Wroc na strone glowna" : "Return to homepage"}
          </Link>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-8 md:grid-cols-2" noValidate>
        <Field label={locale === "pl" ? "Imie i nazwisko" : "Full Name"} name="fullName" required />
        <Field
          label={locale === "pl" ? "Numer telefonu" : "Phone Number"}
          name="phone"
          required
          placeholder={locale === "pl" ? "np. +48 600 000 000" : "e.g. +1 202 555 0143"}
        />
        <Field
          label={locale === "pl" ? "Liczba stron" : "Number of Pages"}
          name="declaredPageCount"
          type="number"
          required
          min={1}
          step={1}
          placeholder={locale === "pl" ? "np. 12" : "e.g. 12"}
        />
        <div className="space-y-2">
          <label htmlFor="requestedCallAt" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Data i godzina telefonu" : "Preferred Call Date / Time"}
          </label>
          <input
            id="requestedCallAt"
            name="requestedCallAt"
            type="datetime-local"
            min={minDateTime}
            required
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="projectSummary" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Czego dotyczy projekt" : "What Is the Project About"}
          </label>
          <textarea
            id="projectSummary"
            name="projectSummary"
            rows={5}
            required
            placeholder={
              locale === "pl"
                ? "Opisz dokument lub projekt, np. umowa handlowa, akt urodzenia, instrukcja techniczna."
                : "Describe the document or project, for example a commercial contract, birth certificate, or technical manual."
            }
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>

        {error ? (
          <p className="border border-accent p-3 text-sm md:col-span-2" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-4 md:col-span-2">
          <button
            type="submit"
            disabled={state === "submitting"}
            className="border border-neutral-900 bg-ink px-6 py-3 text-sm uppercase tracking-[0.16em] text-paper disabled:opacity-60"
          >
            {state === "submitting"
              ? locale === "pl"
                ? "Zapisywanie..."
                : "Submitting..."
              : locale === "pl"
                ? "Popros o telefon"
                : "Request Callback"}
          </button>
          <Link to="/" className="self-center underline underline-offset-4">
            {locale === "pl" ? "Anuluj" : "Cancel"}
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  min,
  step
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-xs uppercase tracking-[0.16em] text-neutral-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        className="w-full border border-neutral-900 bg-paper px-3 py-3"
      />
    </div>
  );
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
