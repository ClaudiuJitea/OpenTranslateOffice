import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";

export function LandingPage() {
  const { t, locale } = useI18n();

  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
      script.async = true;
      script.type = "text/javascript";
      document.body.appendChild(script);
    }

    const handleCallEnd = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { status, conversationId } = customEvent.detail || {};
      if (status === "disconnected" && conversationId) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
          await fetch(`${API_BASE_URL}/api/voice/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId })
          });
        } catch (error) {
          console.error("Failed to sync conversation data:", error);
        }
      }
    };
    window.addEventListener("elevenlabs-convai:call", handleCallEnd);

    return () => {
      window.removeEventListener("elevenlabs-convai:call", handleCallEnd);
    };
  }, []);

  return (
    <div className="space-y-20">
      <section className="grid gap-8 border-b border-neutral-900 pb-12 md:grid-cols-12">
        <div className="md:col-span-8">
          <p className="mb-6 text-xs uppercase tracking-[0.22em] text-neutral-700">
            {t("landing.kicker")}
          </p>
          <h1 className="text-5xl font-semibold tracking-tight md:text-7xl">
            {t("landing.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-800">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/request"
              className="border border-neutral-900 bg-ink px-6 py-3 text-sm uppercase tracking-[0.16em] text-paper transition-colors hover:bg-neutral-800"
            >
              {t("landing.cta.request")}
            </Link>
            <Link
              to="/request-call"
              className="border border-neutral-900 px-6 py-3 text-sm uppercase tracking-[0.16em] transition-colors hover:bg-neutral-100"
            >
              {locale === "pl" ? "Zamów telefon" : "Request a Call"}
            </Link>
            <Link
              to="/intake/chat"
              className="border border-neutral-900 px-6 py-3 text-sm uppercase tracking-[0.16em] underline underline-offset-4 transition-colors hover:bg-neutral-100"
            >
              {t("landing.cta.talk")}
            </Link>
          </div>
          <div className="mt-5">
            <Link
              to="/portal/login"
              className="text-sm uppercase tracking-[0.16em] underline underline-offset-4 transition-colors hover:text-neutral-700"
            >
              {t("landing.cta.status")}
            </Link>
          </div>
        </div>
        <aside className="flex h-full flex-col gap-4 border-l border-neutral-900 pl-6 md:col-span-4">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("landing.trust")}</p>
            <ul className="space-y-3 text-sm leading-6">
              {locale === "pl" ? (
                <>
                  <li>Ponad 120 par językowych</li>
                  <li>Tłumaczenia przysięgłe i certyfikowane</li>
                  <li>Priorytetowa obsługa zleceń pilnych</li>
                  <li>Poufna i audytowalna obsługa dokumentów</li>
                </>
              ) : (
                <>
                  <li>120+ language pairs</li>
                  <li>Certified translations with sworn workflows</li>
                  <li>Same-day triage for urgent requests</li>
                  <li>Confidential handling and auditable delivery</li>
                </>
              )}
            </ul>
          </div>

          <div className="mt-auto border border-neutral-900 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
              {locale === "pl" ? "Asystent głosowy" : "Voice Assistant"}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-800">
              {locale === "pl"
                ? "Możesz od razu porozmawiać z naszym asystentem głosowym."
                : "You can also speak with our voice assistant right away."}
            </p>
            <div className="mt-4">
              <elevenlabs-convai agent-id="TE2whnZuzf9NnKgTyO35"></elevenlabs-convai>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="border border-neutral-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("landing.services")}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {locale === "pl"
              ? "Dokumenty, przysięgłe, ustne, lokalizacja"
              : "Document, Certified, Interpretation, Localization"}
          </h2>
          <p className="mt-3 leading-7 text-neutral-800">
            {locale === "pl"
              ? "Obsługujemy akty stanu cywilnego, umowy, dokumenty sądowe, instrukcje techniczne, strony wielojęzyczne oraz komunikację zarządczą."
              : "We support personal certificates, contracts, court filings, technical manuals, multilingual websites, and executive communications."}
          </p>
        </article>
        <article className="border border-neutral-900 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">{t("landing.how")}</p>
          <ol className="mt-3 space-y-2 leading-7">
            {locale === "pl" ? (
              <>
                <li>1. Przesyłasz pliki i potwierdzasz wymagania.</li>
                <li>2. Wykonujemy triage, przydzielamy tłumacza i walidujemy terminologię.</li>
                <li>3. Finalizujemy i dostarczamy plik w tej samej rodzinie formatu.</li>
              </>
            ) : (
              <>
                <li>1. Upload source files and confirm requirements.</li>
                <li>2. We triage, assign linguists, and validate terminology.</li>
                <li>3. Review, finalize, and deliver in the source document family.</li>
              </>
            )}
          </ol>
        </article>
      </section>

      <section className="border-t border-neutral-900 pt-10">
        <h2 className="text-3xl font-semibold tracking-tight">{t("landing.contact")}</h2>
        <p className="mt-3 leading-7 text-neutral-800">
          {locale === "pl"
            ? "W sprawie SLA dla firm oraz procesów wrażliwych prawnie skontaktuj się z naszym zespołem operacyjnym."
            : "For enterprise SLAs or legal-sensitive workflows, contact our operations desk."}
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.16em]">operations@oto.local</p>
      </section>
    </div>
  );
}
