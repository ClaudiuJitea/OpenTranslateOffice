import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { submitIntakeRequest } from "./intake-client";
import { useI18n } from "../../i18n/I18nProvider";

type SubmissionState = "idle" | "submitting" | "success" | "error";

export function RequestSubmissionPage() {
  const { t, locale } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<SubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [portalPassword, setPortalPassword] = useState<string | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 16), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    if (files.length === 0) {
      setError(locale === "pl" ? "Wymagany jest co najmniej jeden plik." : "At least one file is required.");
      return;
    }

    setState("submitting");
    try {
      const result = await submitIntakeRequest(
        {
          fullName: String(form.get("fullName") ?? ""),
          companyName: optionalValue(form.get("companyName")),
          email: String(form.get("email") ?? ""),
          phone: optionalValue(form.get("phone")),
          sourceLanguage: String(form.get("sourceLanguage") ?? ""),
          targetLanguage: String(form.get("targetLanguage") ?? ""),
          documentType: String(form.get("documentType") ?? ""),
          fileType: String(form.get("fileType") ?? ""),
          certificationRequired: form.get("certificationRequired") === "on",
          deadlineIso: optionalValue(form.get("deadlineIso"))
            ? new Date(String(form.get("deadlineIso"))).toISOString()
            : undefined,
          urgency: optionalValue(form.get("urgency")) as
            | "LOW"
            | "MEDIUM"
            | "HIGH"
            | "URGENT"
            | undefined,
          deliveryMethod: optionalValue(form.get("deliveryMethod")),
          appointmentType: optionalValue(form.get("appointmentType")) as
            | "CALL"
            | "IN_OFFICE"
            | "NONE"
            | undefined,
          appointmentDateTimeIso: optionalValue(form.get("appointmentDateTimeIso"))
            ? new Date(String(form.get("appointmentDateTimeIso"))).toISOString()
            : undefined,
          notes: optionalValue(form.get("notes"))
        },
        files
      );
      setSessionId(result.intakeSessionId);
      setRequestNumber(result.requestNumber ?? null);
      setPortalPassword(result.portalPassword ?? null);
      setState("success");
      event.currentTarget.reset();
      setFiles([]);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : locale === "pl"
            ? "Nie mozna wyslac zgloszenia."
            : "Unable to submit request."
      );
      setState("error");
    }
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-900 pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("request.kicker")}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t("request.title")}</h1>
        <p className="mt-3 max-w-3xl leading-7 text-neutral-800">
          {t("request.subtitle")}
        </p>
      </header>

      {state === "success" ? (
        <section className="border border-neutral-900 bg-paper p-6" aria-live="polite">
          <h2 className="text-2xl font-semibold tracking-tight">{locale === "pl" ? "Zgloszenie wyslane" : "Request Submitted"}</h2>
          <p className="mt-2">{locale === "pl" ? "ID referencyjne:" : "Reference ID:"} {sessionId}</p>
          {requestNumber ? <p className="mt-1">{locale === "pl" ? "Numer zgloszenia:" : "Request Number:"} {requestNumber}</p> : null}
          {portalPassword ? (
            <p className="mt-1">
              {locale === "pl" ? "Haslo portalowe:" : "Portal Password:"} <span className="font-semibold">{portalPassword}</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-neutral-700">
            {locale === "pl"
              ? "Zapisz te dane. Sluza do sledzenia statusu i pobrania finalnych plikow."
              : "Save these credentials. They are used to track status and download final translated files."}
          </p>
          <Link className="mt-3 inline-block underline underline-offset-4" to="/portal/login">
            {locale === "pl" ? "Otworz portal klienta" : "Open Customer Portal"}
          </Link>
          <Link className="mt-4 inline-block underline underline-offset-4" to="/">
            {locale === "pl" ? "Wroc na strone glowna" : "Return to homepage"}
          </Link>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-8 md:grid-cols-2" noValidate>
        <Field label={locale === "pl" ? "Imie i nazwisko" : "Full Name"} name="fullName" required />
        <Field label={locale === "pl" ? "Nazwa firmy" : "Company Name"} name="companyName" />
        <Field label={locale === "pl" ? "Email" : "Email"} name="email" type="email" required />
        <Field label={locale === "pl" ? "Telefon" : "Phone"} name="phone" />
        <Field label={locale === "pl" ? "Jezyk zrodlowy" : "Source Language"} name="sourceLanguage" required placeholder={locale === "pl" ? "np. Niemiecki" : "e.g. German"} />
        <Field label={locale === "pl" ? "Jezyk docelowy" : "Target Language"} name="targetLanguage" required placeholder={locale === "pl" ? "np. Angielski" : "e.g. English"} />
        <Field label={locale === "pl" ? "Typ dokumentu" : "Document Type"} name="documentType" required placeholder={locale === "pl" ? "Umowa, akt, instrukcja" : "Contract, certificate, manual"} />
        <Field label={locale === "pl" ? "Glowny typ pliku" : "Primary File Type"} name="fileType" required placeholder="PDF, DOCX" />

        <div className="space-y-2">
          <label htmlFor="deadlineIso" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Termin oddania" : "Deadline"}
          </label>
          <input
            id="deadlineIso"
            name="deadlineIso"
            type="datetime-local"
            min={todayIso}
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="urgency" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Priorytet" : "Urgency"}
          </label>
          <select id="urgency" name="urgency" className="w-full border border-neutral-900 bg-paper px-3 py-3">
            <option value="">{locale === "pl" ? "Wybierz priorytet" : "Select urgency"}</option>
            <option value="LOW">{locale === "pl" ? "Niski" : "Low"}</option>
            <option value="MEDIUM">{locale === "pl" ? "Sredni" : "Medium"}</option>
            <option value="HIGH">{locale === "pl" ? "Wysoki" : "High"}</option>
            <option value="URGENT">{locale === "pl" ? "Pilny" : "Urgent"}</option>
          </select>
        </div>

        <Field label={locale === "pl" ? "Sposob dostawy" : "Delivery Method"} name="deliveryMethod" placeholder={locale === "pl" ? "Email, portal bezpieczny" : "Email, secure portal"} />

        <div className="space-y-2">
          <label htmlFor="appointmentType" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Spotkanie" : "Appointment"}
          </label>
          <select id="appointmentType" name="appointmentType" className="w-full border border-neutral-900 bg-paper px-3 py-3">
            <option value="">{locale === "pl" ? "Bez spotkania" : "No appointment"}</option>
            <option value="CALL">{locale === "pl" ? "Telefon" : "Call"}</option>
            <option value="IN_OFFICE">{locale === "pl" ? "W biurze" : "In-office"}</option>
            <option value="NONE">{locale === "pl" ? "Brak" : "None"}</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="appointmentDateTimeIso" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Data i godzina spotkania" : "Appointment Date / Time"}
          </label>
          <input
            id="appointmentDateTimeIso"
            name="appointmentDateTimeIso"
            type="datetime-local"
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="notes" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Dodatkowe uwagi" : "Additional Notes"}
          </label>
          <textarea id="notes" name="notes" rows={4} className="w-full border border-neutral-900 bg-paper px-3 py-3" />
        </div>

        <div className="space-y-3 md:col-span-2">
          <label className="inline-flex items-center gap-3">
            <input name="certificationRequired" type="checkbox" className="h-5 w-5 border-neutral-900" />
            <span className="text-sm">{locale === "pl" ? "Wymagane tlumaczenie certyfikowane" : "Certified translation is required"}</span>
          </label>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="files" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {locale === "pl" ? "Przeslij dokumenty" : "Upload Documents"}
          </label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            required
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="w-full border border-neutral-900 bg-paper px-3 py-3 file:mr-4 file:border-0 file:bg-ink file:px-4 file:py-2 file:text-paper"
          />
          <p className="text-sm text-neutral-700">
            {locale === "pl"
              ? "Obslugiwane: PDF, DOC, DOCX, TXT, RTF, ODT. Maksymalnie 10 plikow, 25MB kazdy."
              : "Supported: PDF, DOC, DOCX, TXT, RTF, ODT. Maximum 10 files, 25MB each."}
          </p>
        </div>

        {error ? (
          <p className="md:col-span-2 border border-accent p-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="md:col-span-2 flex gap-4">
          <button
            type="submit"
            disabled={state === "submitting"}
            className="border border-neutral-900 bg-ink px-6 py-3 text-sm uppercase tracking-[0.16em] text-paper disabled:opacity-60"
          >
            {state === "submitting" ? t("request.submitting") : t("request.submit")}
          </button>
          <Link to="/" className="self-center underline underline-offset-4">
            {t("request.cancel")}
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
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        className="w-full border border-neutral-900 bg-paper px-3 py-3"
      />
    </div>
  );
}

function optionalValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
