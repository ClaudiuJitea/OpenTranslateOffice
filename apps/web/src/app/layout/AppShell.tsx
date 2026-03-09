import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:p-2 focus:outline focus:outline-2 focus:outline-accent">
        {t("nav.skipToContent")}
      </a>
      <header className="border-b border-neutral-900 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="tracking-[0.22em]">OPEN TRANSLATE OFFICE</p>
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 text-sm uppercase tracking-[0.18em]"
          >
            <Link className="underline-offset-4 hover:underline" to="/">{t("nav.home")}</Link>
            {user?.role === "EMPLOYEE" || user?.role === "ADMIN" ? (
              <>
                <Link className="underline-offset-4 hover:underline" to="/dashboard">{t("nav.workbench")}</Link>
                <Link className="underline-offset-4 hover:underline" to="/calls">
                  {locale === "pl" ? "Telefony" : "Calls"}
                </Link>
              </>
            ) : null}
            {user?.role === "ADMIN" ? (
              <>
                <Link className="underline-offset-4 hover:underline" to="/admin">{t("nav.admin")}</Link>
                <Link className="underline-offset-4 hover:underline" to="/admin/calendar">
                  {locale === "pl" ? "Kalendarz" : "Calendar"}
                </Link>
              </>
            ) : null}
            <div className="flex items-center gap-2 text-xs tracking-[0.16em]">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={locale === "en" ? "underline underline-offset-4" : "underline-offset-4 hover:underline"}
                aria-pressed={locale === "en"}
              >
                {t("nav.lang.en")}
              </button>
              <button
                type="button"
                onClick={() => setLocale("pl")}
                className={locale === "pl" ? "underline underline-offset-4" : "underline-offset-4 hover:underline"}
                aria-pressed={locale === "pl"}
              >
                {t("nav.lang.pl")}
              </button>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  void logout();
                }}
                className="underline-offset-4 hover:underline"
              >
                {t("nav.signOut")}
              </button>
            ) : (
              <Link className="underline-offset-4 hover:underline" to="/login">{t("nav.signIn")}</Link>
            )}
            <span className="border-l border-neutral-800 pl-4 text-xs normal-case tracking-normal">
              {user ? `${user.fullName} (${user.role})` : t("nav.guest")}
            </span>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
