import type {
  IntakeChatExtracted,
  IntakeFieldKey
} from "@oto/shared";

const REQUIRED_FIELDS: IntakeFieldKey[] = [
  "fullName",
  "email",
  "sourceLanguage",
  "targetLanguage",
  "documentType",
  "fileType",
  "certificationRequired",
  "urgency",
  "files"
];

const SOURCE_LANGUAGE_HINTS = [
  "english",
  "german",
  "french",
  "spanish",
  "italian",
  "arabic",
  "japanese",
  "chinese",
  "portuguese",
  "dutch"
];

export interface IntakeAssistantProvider {
  extract(message: string, current: IntakeChatExtracted): IntakeChatExtracted;
  missingFields(extracted: IntakeChatExtracted, uploadedFilesCount: number): IntakeFieldKey[];
  completeness(extracted: IntakeChatExtracted, uploadedFilesCount: number): number;
  nextPrompt(
    missing: IntakeFieldKey[],
    extracted: IntakeChatExtracted,
    locale?: "en" | "pl"
  ): string;
}

export class RuleBasedIntakeAssistant implements IntakeAssistantProvider {
  extract(message: string, current: IntakeChatExtracted) {
    const next: IntakeChatExtracted = { ...current };
    const lower = message.toLowerCase();

    if (!next.email) {
      const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch) {
        next.email = emailMatch[0].toLowerCase();
      }
    }

    if (!next.fullName) {
      const nameMatch = message.match(/(?:my name is|i am|this is)\s+([A-Za-z][A-Za-z\s'-]{2,60})/i);
      if (nameMatch?.[1]) {
        next.fullName = compact(nameMatch[1]);
      }
    }

    if (!next.sourceLanguage || !next.targetLanguage) {
      const pairMatch = message.match(/from\s+([A-Za-z]+)\s+to\s+([A-Za-z]+)/i);
      if (pairMatch) {
        if (!next.sourceLanguage) {
          next.sourceLanguage = normalizeLang(pairMatch[1]);
        }
        if (!next.targetLanguage) {
          next.targetLanguage = normalizeLang(pairMatch[2]);
        }
      }
    }

    if (!next.sourceLanguage || !next.targetLanguage) {
      const foundLangs = SOURCE_LANGUAGE_HINTS.filter((lang) => lower.includes(lang));
      if (foundLangs.length >= 2) {
        if (!next.sourceLanguage) {
          next.sourceLanguage = normalizeLang(foundLangs[0]);
        }
        if (!next.targetLanguage) {
          next.targetLanguage = normalizeLang(foundLangs[1]);
        }
      }
    }

    if (!next.documentType) {
      if (lower.includes("contract")) next.documentType = "Contract";
      else if (lower.includes("certificate")) next.documentType = "Certificate";
      else if (lower.includes("manual")) next.documentType = "Manual";
      else if (lower.includes("transcript")) next.documentType = "Transcript";
    }

    if (!next.fileType) {
      const extMatch = lower.match(/\b(pdf|docx|doc|txt|rtf|odt)\b/i);
      if (extMatch?.[1]) {
        next.fileType = extMatch[1].toUpperCase();
      }
    }

    if (next.certificationRequired === undefined) {
      if (lower.includes("certified") || lower.includes("sworn")) {
        next.certificationRequired = true;
      }
      if (/(not certified|no certification|not sworn)/i.test(lower)) {
        next.certificationRequired = false;
      }
    }

    if (!next.deadlineIso) {
      const isoMatch = message.match(/(20\d{2}-\d{2}-\d{2})/);
      if (isoMatch?.[1]) {
        next.deadlineIso = new Date(`${isoMatch[1]}T17:00:00.000Z`).toISOString();
      }
    }

    if (!next.urgency) {
      if (lower.includes("same day") || lower.includes("high priority")) {
        next.urgency = "URGENT";
      } else if (lower.includes("next day") || lower.includes("urgent")) {
        next.urgency = "HIGH";
      } else if (lower.includes("standard") || lower.includes("2 days") || lower.includes("two days")) {
        next.urgency = "MEDIUM";
      }
    }

    return next;
  }

  missingFields(extracted: IntakeChatExtracted, uploadedFilesCount: number) {
    return REQUIRED_FIELDS.filter((field) => {
      if (field === "files") {
        return uploadedFilesCount <= 0;
      }
      const value = extracted[field];
      return value === undefined || value === null || value === "";
    });
  }

  completeness(extracted: IntakeChatExtracted, uploadedFilesCount: number) {
    const completeCount = REQUIRED_FIELDS.length - this.missingFields(extracted, uploadedFilesCount).length;
    return Math.round((completeCount / REQUIRED_FIELDS.length) * 100);
  }

  nextPrompt(
    missing: IntakeFieldKey[],
    extracted: IntakeChatExtracted,
    locale: "en" | "pl" = "en"
  ) {
    if (missing.length === 0) {
      if (locale === "pl") {
        return [
          "Dziekuje. Mam komplet informacji potrzebnych do utworzenia zgloszenia.",
          `Podsumowanie: ${summaryLine(extracted)}`,
          "Mozesz dodac dane opcjonalne, np. preferencje kontaktu lub uwagi.",
          "Jesli cokolwiek jest niejasne, zapytaj mnie, a poprowadze Cie krok po kroku."
        ].join(" ");
      }

      return [
        "Thank you. I have enough information to create a job-ready intake record.",
        `Summary: ${summaryLine(extracted)}`,
        "You can continue with optional details such as appointment preference, delivery method, or internal notes.",
        "If anything is unclear, ask me and I will guide you step by step."
      ].join(" ");
    }

    return buildNextPrompt(missing, extracted, locale);
  }
}

function buildNextPrompt(
  missing: IntakeFieldKey[],
  extracted: IntakeChatExtracted,
  locale: "en" | "pl" = "en"
) {
  const introName = firstName(extracted.fullName);

  const needsIdentity = missing.includes("fullName");
  if (needsIdentity) {
    if (locale === "pl") {
      return "Zacznijmy od imienia i nazwiska, ktore ma widniec przy zgloszeniu. Jesli nie masz pewnosci, co wpisac, po prostu zapytaj.";
    }
    return "Let us start with your full name as it should appear on the request. If you are unsure what to include, just ask and I will help.";
  }

  const needsContactOrLanguages =
    missing.includes("email") || missing.includes("sourceLanguage") || missing.includes("targetLanguage");
  if (needsContactOrLanguages) {
    if (locale === "pl") {
      return [
        introName ? `Dziekuje, ${introName}.` : "Dziekuje.",
        "Teraz podaj prosze adres email do kontaktu oraz napisz, z jakiego jezyka i na jaki jezyk mamy tlumaczyc dokument.",
        "Jesli nie masz pewnosci co do jezyka, opisz dokument, a pomoge go rozpoznac."
      ].join(" ");
    }

    return [
      introName ? `Thank you, ${introName}.` : "Thank you.",
      "Next, please share the email address you want us to use and tell me the source language and the target language for the translation.",
      "If you are unsure about the language, describe the document and I can help identify it."
    ].join(" ");
  }

  const needsDocumentProfile =
    missing.includes("documentType") ||
    missing.includes("fileType") ||
    missing.includes("certificationRequired");
  if (needsDocumentProfile) {
    if (locale === "pl") {
      return [
        "Dobrze.",
        "Powiedz jeszcze, jaki to rodzaj dokumentu, w jakim formacie pliku go przesylasz oraz czy potrzebujesz tlumaczenia przysieglego lub certyfikowanego.",
        "Przyklad typu dokumentu: akt urodzenia, umowa, dyplom, raport medyczny, instrukcja techniczna albo CV."
      ].join(" ");
    }

    return [
      "Good.",
      "Please also tell me what kind of document this is, which file format you are uploading, and whether you need a certified or sworn translation.",
      "For document type, examples include: birth certificate, contract, diploma, medical report, technical manual, or resume."
    ].join(" ");
  }

  const needsUrgencyOrFiles = missing.includes("urgency") || missing.includes("files");
  if (needsUrgencyOrFiles) {
    if (locale === "pl") {
      return [
        "Na koniec wybierz termin realizacji i przeslij dokument.",
        "Mozesz wybrac: standard (2 dni), pilne (na jutro) albo wysoki priorytet (tego samego dnia).",
        "Jesli upload sprawia problem, napisz mi to od razu i przeprowadze Cie dalej."
      ].join(" ");
    }

    return [
      "Finally, choose the turnaround and upload the document.",
      "You can select: standard (2 days), urgent (next day), or high priority (same day).",
      "If the upload gives you trouble, tell me and I will help you through it."
    ].join(" ");
  }

  const key = missing[0];
  return promptFor(key, extracted, locale);
}

function promptFor(
  key: IntakeFieldKey,
  extracted: IntakeChatExtracted,
  locale: "en" | "pl" = "en"
) {
  if (locale === "pl") {
    switch (key) {
      case "fullName":
        return "Podaj prosze swoje imie i nazwisko tak, jak ma widniec w zgloszeniu. Jesli cos jest niejasne, po prostu zapytaj.";
      case "email":
        return "Podaj prosze adres email, na ktory mamy wysylac aktualizacje i gotowe tlumaczenie.";
      case "sourceLanguage":
        return "Jaki jest jezyk zrodlowy dokumentu? Jesli nie masz pewnosci, pomoge go rozpoznac.";
      case "targetLanguage":
        return "Na jaki jezyk mamy przetlumaczyc dokument?";
      case "documentType":
        return "Jaki to typ dokumentu? Np. akt urodzenia, akt malzenstwa, umowa, dyplom, transkrypt ocen, raport medyczny, sprawozdanie finansowe, instrukcja techniczna lub tresc strony/aplikacji.";
      case "fileType":
        return "Jaki typ pliku przesylasz (PDF, DOCX, DOC, TXT, RTF, ODT)? Jesli nie masz pewnosci, napisz nazwe pliku z rozszerzeniem.";
      case "certificationRequired":
        return "Czy potrzebujesz tlumaczenia certyfikowanego/przysieglego?";
      case "urgency":
        return "Wybierz termin realizacji: standard (2 dni), pilne (na jutro) albo wysoki priorytet (tego samego dnia).";
      case "files":
        return "Przeslij co najmniej jeden dokument zrodlowy. Jesli pojawi sie problem z uploadem, napisz i pomoge.";
    }
  }

  switch (key) {
    case "fullName":
      return "Please share your full name as it should appear on the request. If anything is unclear, just ask and I will help.";
    case "email":
      return "Please share the email address you want us to use for updates and delivery.";
    case "sourceLanguage":
      return "What is the source language of your document? If needed, I can help identify it.";
    case "targetLanguage":
      return "What target language do you need for the translation?";
    case "documentType":
      return "What is the document type? For example: birth certificate, marriage certificate, legal contract, diploma, academic transcript, medical report, financial statement, technical manual, or website/app content. If none match, describe it in your own words.";
    case "fileType":
      return "Which file type are you uploading (PDF, DOCX, DOC, TXT, RTF, or ODT)? If you are not sure, just tell me what you see in the file name.";
    case "certificationRequired":
      if (extracted.documentType?.toLowerCase().includes("certificate")) {
        return "Do you require certified translation for this request?";
      }
      return "Should this be handled as a certified translation?";
    case "urgency":
      return "Choose your timeframe: standard (2 days), urgent (next day), or high priority (same day). If this is time-sensitive, tell me and I can help pick the right option.";
    case "files":
      return "Please upload at least one source document to continue. If upload fails, tell me and I will guide you.";
  }
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLang(value: string) {
  const compacted = compact(value).toLowerCase();
  return compacted[0].toUpperCase() + compacted.slice(1);
}

function summaryLine(extracted: IntakeChatExtracted) {
  return [
    extracted.fullName,
    extracted.email,
    `${extracted.sourceLanguage} -> ${extracted.targetLanguage}`,
    extracted.documentType,
    extracted.fileType,
    extracted.certificationRequired ? "Certified" : "Non-certified"
  ]
    .filter(Boolean)
    .join(" | ");
}

function firstName(fullName: string | undefined) {
  if (!fullName) return "";
  return compact(fullName).split(" ")[0] ?? "";
}
