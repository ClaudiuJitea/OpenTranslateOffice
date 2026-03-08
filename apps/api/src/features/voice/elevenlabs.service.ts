import { intakeMessages } from "@oto/db";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/runtime";
import { getIntegrationSettings } from "../../services/settings/integration-settings";

export class ElevenLabsService {
  private readonly db = getDb();

  async createClientSession(context: { intakeSessionId: string }) {
    const settings = await getIntegrationSettings();
    if (!settings.elevenlabsApiKey || !settings.elevenlabsAgentId) {
      return { configured: false as const };
    }

    const url = new URL("/v1/convai/conversation/get_signed_url", settings.elevenlabsBaseUrl);
    url.searchParams.set("agent_id", settings.elevenlabsAgentId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "xi-api-key": settings.elevenlabsApiKey
      }
    });

    if (!response.ok) {
      return { configured: false as const };
    }

    const payload = (await response.json()) as { signed_url?: string; expires_at_unix_secs?: number };
    if (!payload.signed_url) {
      return { configured: false as const };
    }

    return {
      configured: true as const,
      intakeSessionId: context.intakeSessionId,
      signedUrl: payload.signed_url,
      expiresAtUnixSecs: payload.expires_at_unix_secs ?? null
    };
  }

  async handleWebhookEvent(payload: unknown, signature: string) {
    const settings = await getIntegrationSettings();
    if (settings.elevenlabsWebhookSecret) {
      if (!signature || signature !== settings.elevenlabsWebhookSecret) {
        return;
      }
    }

    const parsed = payload as {
      intakeSessionId?: string;
      transcript?: { text?: string; speaker?: string };
      text?: string;
      speaker?: string;
    };

    const sessionId = String(parsed.intakeSessionId ?? "").trim();
    const content = parsed.transcript?.text ?? parsed.text;
    if (!sessionId || !content) {
      return;
    }

    await this.db.insert(intakeMessages).values({
      id: randomUUID(),
      sessionId,
      speaker: parsed.transcript?.speaker ?? parsed.speaker ?? "VOICE",
      content,
      createdAt: new Date()
    });
  }
}
