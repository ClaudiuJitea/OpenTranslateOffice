import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalLogin } from "./portal-client";
import { useI18n } from "../../i18n/I18nProvider";

export function PortalLoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requestNumber = String(form.get("requestNumber") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();

    setError(null);
    try {
      const payload = await portalLogin(requestNumber, password);
      localStorage.setItem("portalToken", payload.token);
      navigate("/portal/request");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Portal login failed");
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6 border border-neutral-900 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">{t("portal.login.title")}</h1>
      <p className="leading-7 text-neutral-800">
        {t("portal.login.subtitle")}
      </p>
      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label={t("portal.login.requestNumber")} name="requestNumber" required />
        <Field label={t("portal.login.portalPassword")} name="password" type="password" required />
        <button className="border border-neutral-900 bg-ink px-6 py-3 text-xs uppercase tracking-[0.16em] text-paper" type="submit">
          {t("portal.login.submit")}
        </button>
      </form>
    </section>
  );
}

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-xs uppercase tracking-[0.16em] text-neutral-700">{label}</label>
      <input id={name} name={name} type={type} required={required} className="h-12 w-full border border-neutral-900 bg-paper px-3" />
    </div>
  );
}
