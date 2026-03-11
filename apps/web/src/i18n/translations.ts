export type Locale = "en" | "pl";

type Dictionary = Record<string, string>;

export const translations: Record<Locale, Dictionary> = {
  en: {
    "nav.skipToContent": "Skip to content",
    "nav.home": "Home",
    "nav.workbench": "Workbench",
    "nav.admin": "Admin",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "nav.guest": "Guest",
    "nav.lang.en": "EN",
    "nav.lang.pl": "PL",

    "landing.kicker": "Editorial Translation Studio",
    "landing.title": "Precision Translation for Legal, Corporate, and International Teams.",
    "landing.subtitle":
      "Submit documents, confirm requirements, and generate a structured intake ticket your assigned language team can act on immediately.",
    "landing.cta.request": "Submit a Request",
    "landing.cta.talk": "Talk to an Agent",
    "landing.cta.status": "Check Request Status",
    "landing.trust": "Trust Signals",
    "landing.services": "Services",
    "landing.how": "How It Works",
    "landing.contact": "Contact",

    "login.kicker": "Employee Access",
    "login.title": "Sign In",
    "login.subtitle": "Sign in to access employee and admin workflows.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign In",
    "login.submitting": "Signing In",
    "login.home": "Return home",

    "portal.login.title": "Customer Portal",
    "portal.login.subtitle":
      "Sign in with the request number and portal password you received after submission.",
    "portal.login.requestNumber": "Request Number",
    "portal.login.portalPassword": "Portal Password",
    "portal.login.submit": "Access Request",

    "portal.request.kicker": "Customer Portal",
    "portal.request.title": "Request Status",
    "portal.request.downloads": "Downloads",
    "portal.request.noFiles": "No delivered files yet. Please check back later.",
    "portal.request.loading": "Loading request...",
    "portal.request.home": "Return home",

    "request.kicker": "Customer Intake",
    "request.title": "Submit Translation Request",
    "request.subtitle":
      "Provide complete project information and source files to generate a structured job-ready ticket for the translation team.",
    "request.submit": "Create Request Ticket",
    "request.submitting": "Submitting...",
    "request.cancel": "Cancel",

    "intake.kicker": "AI Intake",
    "intake.title": "Chat Intake Assistant",
    "intake.subtitle":
      "Provide required project details. The intake agent asks only missing fields and builds a structured ticket for operations handoff.",
    "intake.yourMessage": "Your message",
    "intake.send": "Send",
    "intake.uploadDocuments": "Upload Documents",
    "intake.uploadFiles": "Upload Files",
    "intake.uploading": "Uploading",
    "intake.timeframe": "Timeframe",
    "intake.standard": "Standard (2 days)",
    "intake.urgent": "Urgent (next day)",
    "intake.highPriority": "High Priority (same day)",
    "intake.fullForm": "Use full request form instead",
    "intake.openPortal": "Open customer portal"
  },
  pl: {
    "nav.skipToContent": "Przejdź do treści",
    "nav.home": "Start",
    "nav.workbench": "Panel",
    "nav.admin": "Admin",
    "nav.signIn": "Zaloguj",
    "nav.signOut": "Wyloguj",
    "nav.guest": "Gość",
    "nav.lang.en": "EN",
    "nav.lang.pl": "PL",

    "landing.kicker": "Studio Tłumaczeń",
    "landing.title": "Precyzyjne tłumaczenia dla zespołów prawnych, firmowych i międzynarodowych.",
    "landing.subtitle":
      "Prześlij dokumenty, potwierdź wymagania i utwórz uporządkowane zgłoszenie, z którym zespół językowy może od razu pracować.",
    "landing.cta.request": "Złóż zlecenie",
    "landing.cta.talk": "Porozmawiaj z agentem",
    "landing.cta.status": "Sprawdź status zlecenia",
    "landing.trust": "Dlaczego my",
    "landing.services": "Usługi",
    "landing.how": "Jak to działa",
    "landing.contact": "Kontakt",

    "login.kicker": "Dostęp pracownika",
    "login.title": "Logowanie",
    "login.subtitle": "Zaloguj się, aby korzystać z panelu pracownika i admina.",
    "login.email": "Email",
    "login.password": "Hasło",
    "login.submit": "Zaloguj",
    "login.submitting": "Logowanie",
    "login.home": "Wróć na stronę główną",

    "portal.login.title": "Portal klienta",
    "portal.login.subtitle":
      "Zaloguj się numerem zgłoszenia i hasłem portalowym otrzymanym po wysłaniu zlecenia.",
    "portal.login.requestNumber": "Numer zgłoszenia",
    "portal.login.portalPassword": "Hasło portalowe",
    "portal.login.submit": "Otwórz zgłoszenie",

    "portal.request.kicker": "Portal klienta",
    "portal.request.title": "Status zgłoszenia",
    "portal.request.downloads": "Pliki do pobrania",
    "portal.request.noFiles": "Brak dostarczonych plików. Sprawdź ponownie później.",
    "portal.request.loading": "Ładowanie zgłoszenia...",
    "portal.request.home": "Wróć na stronę główną",

    "request.kicker": "Przyjęcie zlecenia",
    "request.title": "Wyślij zlecenie tłumaczenia",
    "request.subtitle":
      "Podaj komplet informacji i prześlij pliki źródłowe, aby utworzyć gotowe zgłoszenie dla zespołu tłumaczy.",
    "request.submit": "Utwórz zgłoszenie",
    "request.submitting": "Wysyłanie...",
    "request.cancel": "Anuluj",

    "intake.kicker": "Przyjęcie AI",
    "intake.title": "Asystent czatu",
    "intake.subtitle":
      "Podaj wymagane informacje o projekcie. Asystent pyta tylko o brakujące pola i tworzy uporządkowane zgłoszenie.",
    "intake.yourMessage": "Twoja wiadomość",
    "intake.send": "Wyślij",
    "intake.uploadDocuments": "Prześlij dokumenty",
    "intake.uploadFiles": "Prześlij pliki",
    "intake.uploading": "Przesyłanie",
    "intake.timeframe": "Termin",
    "intake.standard": "Standard (2 dni)",
    "intake.urgent": "Pilne (na jutro)",
    "intake.highPriority": "Wysoki priorytet (tego samego dnia)",
    "intake.fullForm": "Użyj pełnego formularza",
    "intake.openPortal": "Otwórz portal klienta"
  }
};
