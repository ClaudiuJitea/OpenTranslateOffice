import type { IntakeChatExtracted, IntakeFieldKey } from "@oto/shared";
import { getIntegrationSettings } from "../settings/integration-settings";

interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

interface IntakeLLMResult {
  extracted: IntakeChatExtracted;
  assistantReply?: string;
}

export class OpenRouterClient {
  async extractAndReply(input: {
    userMessage: string;
    current: IntakeChatExtracted;
    missing: IntakeFieldKey[];
    uploadedFilesCount: number;
    locale?: "en" | "pl";
  }): Promise<IntakeLLMResult | null> {
    const settings = await getIntegrationSettings();
    if (!settings.openrouterApiKey || !settings.openrouterModel || !settings.openrouterBaseUrl) {
      return null;
    }

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: [
          "You are a customer-facing intake assistant for a premium translation agency.",
          "Return ONLY valid JSON.",
          "Do not invent missing information.",
          'Output schema: { "extracted": { ...partial updates... }, "assistantReply": string }',
          "Only include values if explicitly present in the user message.",
          "Allowed extracted keys: fullName, companyName, email, phone, sourceLanguage, targetLanguage, documentType, fileType, pageCountDeclared, certificationRequired, deadlineIso, urgency, deliveryMethod, appointmentType, appointmentDateTimeIso, notes."
          ,
          "assistantReply must sound calm, clear, and professional.",
          "assistantReply must feel conversational and supportive, not like a form or checklist.",
          "Ask only for information that is still missing.",
          "Prefer grouped follow-up questions instead of single-field interrogation when appropriate.",
          "Do not ask for the full request in one message.",
          "Ask for at most 2 closely related pieces of information at a time.",
          "If the user only greets you or says hello, respond with one warm sentence and ask only for their name first.",
          "Do not list more than 2 required items in a single reply.",
          "Avoid long compound requests joined with many commas.",
          "If asking about document type, include 2-4 concrete examples.",
          "If asking about document size, ask for the approximate number of pages and mention that it will be verified after upload.",
          "If asking about urgency, use these options exactly: standard (2 days), urgent (next day), high priority (same day).",
          "If asking about file type, mention common formats such as PDF, DOCX, DOC, RTF, ODT.",
          "Do not mention internal logic, confidence scores, validation, or JSON.",
          "Keep assistantReply under 70 words.",
          "If the user seems confused, reassure briefly and explain what to provide next."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          locale: input.locale ?? "en",
          current: input.current,
          missing: input.missing,
          uploadedFilesCount: input.uploadedFilesCount,
          userMessage: input.userMessage
        })
      }
    ];

    const response = await fetch(`${settings.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openrouterApiKey}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "OpenTranslateOffice"
      },
      body: JSON.stringify({
        model: settings.openrouterModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as IntakeLLMResult;
      return {
        extracted: parsed.extracted ?? {},
        assistantReply: parsed.assistantReply
      };
    } catch {
      return null;
    }
  }
}
