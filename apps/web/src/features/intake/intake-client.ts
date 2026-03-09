export interface IntakeRequestPayload {
  fullName: string;
  companyName?: string;
  email: string;
  phone?: string;
  sourceLanguage: string;
  targetLanguage: string;
  documentType: string;
  fileType: string;
  pageCountDeclared?: number;
  certificationRequired: boolean;
  deadlineIso?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deliveryMethod?: string;
  appointmentType?: "CALL" | "IN_OFFICE" | "NONE";
  appointmentDateTimeIso?: string;
  notes?: string;
}

export interface IntakeChatSession {
  id: string;
  status: "IN_PROGRESS" | "READY_FOR_REVIEW";
  providerUsed?: "openrouter" | "fallback" | "system";
  completenessScore: number;
  uploadedFilesCount: number;
  missing: Array<
    | "fullName"
    | "email"
    | "sourceLanguage"
    | "targetLanguage"
    | "documentType"
    | "fileType"
    | "pageCountDeclared"
    | "certificationRequired"
    | "urgency"
    | "files"
  >;
  extracted: Record<string, unknown>;
  portalCredentials?: {
    requestNumber: string;
    portalPassword: string;
  };
  messages: Array<{
    id: string;
    speaker: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string;
  }>;
}

export interface VoiceSessionResponse {
  configured: boolean;
  intakeSessionId?: string;
  signedUrl?: string;
  expiresAtUnixSecs?: number | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function submitIntakeRequest(payload: IntakeRequestPayload, files: File[]) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    formData.append(key, String(value));
  });

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/api/intake/requests`, {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(errorBody?.error ?? "Failed to submit request");
  }

  return (await response.json()) as {
    intakeSessionId: string;
    requestNumber?: string;
    portalPassword?: string;
    status: string;
    files: Array<{ name: string; sizeBytes: number }>;
  };
}

export async function createIntakeChatSession(initialMessage?: string, locale?: "en" | "pl") {
  const response = await fetch(`${API_BASE_URL}/api/intake/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      initialMessage
        ? { initialMessage, locale }
        : locale
          ? { locale }
          : {}
    ),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Failed to start chat intake session");
  }

  return (await response.json()) as IntakeChatSession;
}

export async function getIntakeChatSession(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/intake/chat/sessions/${sessionId}`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load chat intake session");
  }

  return (await response.json()) as IntakeChatSession;
}

export async function sendIntakeChatMessage(
  sessionId: string,
  content: string,
  locale?: "en" | "pl"
) {
  const response = await fetch(`${API_BASE_URL}/api/intake/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(locale ? { content, locale } : { content }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to send message");
  }

  return (await response.json()) as IntakeChatSession;
}

export async function createVoiceSession(intakeSessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/voice/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ intakeSessionId }),
    credentials: "include"
  });

  const payload = (await response.json().catch(() => ({}))) as
    | VoiceSessionResponse
    | { error?: string };

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? "Unable to start voice session");
  }

  return payload as VoiceSessionResponse;
}

export async function uploadIntakeChatFiles(
  sessionId: string,
  files: File[],
  locale?: "en" | "pl"
) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  if (locale) {
    formData.append("locale", locale);
  }

  const response = await fetch(`${API_BASE_URL}/api/intake/chat/sessions/${sessionId}/files`, {
    method: "POST",
    body: formData,
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to upload files");
  }

  return (await response.json()) as IntakeChatSession;
}
