import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";

interface LocationState {
  from?: {
    pathname: string;
  };
}

export function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6 border border-neutral-900 p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">{t("login.kicker")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{t("login.title")}</h1>
        <p className="text-sm leading-6 text-neutral-800">
          {t("login.subtitle")}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
            <label htmlFor="email" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {t("login.email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
            {t("login.password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full border border-neutral-900 bg-paper px-3 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="border border-neutral-900 bg-ink px-6 py-3 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-60"
        >
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </button>
      </form>

      <Link to="/" className="inline-block underline underline-offset-4">
        {t("login.home")}
      </Link>
    </section>
  );
}
