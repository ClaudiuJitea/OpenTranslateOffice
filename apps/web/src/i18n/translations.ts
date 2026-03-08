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
    "nav.skipToContent": "Przejdz do tresci",
    "nav.home": "Start",
    "nav.workbench": "Panel",
    "nav.admin": "Admin",
    "nav.signIn": "Zaloguj",
    "nav.signOut": "Wyloguj",
    "nav.guest": "Gosc",
    "nav.lang.en": "EN",
    "nav.lang.pl": "PL",

    "landing.kicker": "Studio Tlumaczen",
    "landing.title": "Precyzyjne tlumaczenia dla zespolow prawnych, firmowych i miedzynarodowych.",
    "landing.subtitle":
      "Przeslij dokumenty, potwierdz wymagania i utworz uporzadkowane zgloszenie, z ktorym zespol jezykowy moze od razu pracowac.",
    "landing.cta.request": "Zloz zlecenie",
    "landing.cta.talk": "Porozmawiaj z agentem",
    "landing.cta.status": "Sprawdz status zlecenia",
    "landing.trust": "Dlaczego my",
    "landing.services": "Uslugi",
    "landing.how": "Jak to dziala",
    "landing.contact": "Kontakt",

    "login.kicker": "Dostep pracownika",
    "login.title": "Logowanie",
    "login.subtitle": "Zaloguj sie, aby korzystac z panelu pracownika i admina.",
    "login.email": "Email",
    "login.password": "Haslo",
    "login.submit": "Zaloguj",
    "login.submitting": "Logowanie",
    "login.home": "Wroc na strone glowna",

    "portal.login.title": "Portal klienta",
    "portal.login.subtitle":
      "Zaloguj sie numerem zgloszenia i haslem portalowym otrzymanym po wyslaniu zlecenia.",
    "portal.login.requestNumber": "Numer zgloszenia",
    "portal.login.portalPassword": "Haslo portalowe",
    "portal.login.submit": "Otworz zgloszenie",

    "portal.request.kicker": "Portal klienta",
    "portal.request.title": "Status zgloszenia",
    "portal.request.downloads": "Pliki do pobrania",
    "portal.request.noFiles": "Brak dostarczonych plikow. Sprawdz ponownie pozniej.",
    "portal.request.loading": "Ladowanie zgloszenia...",
    "portal.request.home": "Wroc na strone glowna",

    "request.kicker": "Przyjecie zlecenia",
    "request.title": "Wyslij zlecenie tlumaczenia",
    "request.subtitle":
      "Podaj komplet informacji i przeslij pliki zrodlowe, aby utworzyc gotowe zgloszenie dla zespolu tlumaczy.",
    "request.submit": "Utworz zgloszenie",
    "request.submitting": "Wysylanie...",
    "request.cancel": "Anuluj",

    "intake.kicker": "Przyjecie AI",
    "intake.title": "Asystent czatu",
    "intake.subtitle":
      "Podaj wymagane informacje o projekcie. Asystent pyta tylko o brakujace pola i tworzy uporzadkowane zgloszenie.",
    "intake.yourMessage": "Twoja wiadomosc",
    "intake.send": "Wyslij",
    "intake.uploadDocuments": "Przeslij dokumenty",
    "intake.uploadFiles": "Przeslij pliki",
    "intake.uploading": "Przesylanie",
    "intake.timeframe": "Termin",
    "intake.standard": "Standard (2 dni)",
    "intake.urgent": "Pilne (na jutro)",
    "intake.highPriority": "Wysoki priorytet (tego samego dnia)",
    "intake.fullForm": "Uzyj pelnego formularza",
    "intake.openPortal": "Otworz portal klienta"
  }
};
