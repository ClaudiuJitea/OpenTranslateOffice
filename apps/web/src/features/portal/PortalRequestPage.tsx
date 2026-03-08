import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { downloadPortalFile, fetchPortalRequest } from "./portal-client";
import { useI18n } from "../../i18n/I18nProvider";

export function PortalRequestPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPortalRequest>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("portalToken");
    if (!t) {
      navigate("/portal/login", { replace: true });
      return;
    }

    setToken(t);
    void (async () => {
      try {
        setData(await fetchPortalRequest(t));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load request");
      }
    })();
  }, [navigate]);

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-neutral-900 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("portal.request.kicker")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{t("portal.request.title")}</h1>
      </header>

      {error ? <p role="alert" className="border border-accent p-3 text-sm">{error}</p> : null}

      {data ? (
        <>
          <section className="border border-neutral-900 p-5">
            <p><span className="text-neutral-700">{locale === "pl" ? "Zgloszenie:" : "Request:"}</span> {data.request.requestNumber}</p>
            <p><span className="text-neutral-700">{locale === "pl" ? "Nazwa:" : "Name:"}</span> {data.request.fullName}</p>
            <p><span className="text-neutral-700">{locale === "pl" ? "Jezyki:" : "Language:"}</span> {data.request.sourceLanguage} {"->"} {data.request.targetLanguage}</p>
            <p><span className="text-neutral-700">{locale === "pl" ? "Status:" : "Status:"}</span> {data.request.status}</p>
          </section>

          <section className="border border-neutral-900 p-5">
            <h2 className="text-2xl font-semibold tracking-tight">{t("portal.request.downloads")}</h2>
            {data.deliverables.length === 0 ? (
              <p className="mt-2 text-sm">{t("portal.request.noFiles")}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.deliverables.map((file) => (
                  <li key={file.id} className="border-b border-neutral-200 pb-2">
                    <a
                      href={token ? downloadPortalFile(token, file.id) : "#"}
                      className="underline underline-offset-4"
                    >
                      {file.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p>{t("portal.request.loading")}</p>
      )}

      <Link to="/" className="inline-block underline underline-offset-4">{t("portal.request.home")}</Link>
    </section>
  );
}
