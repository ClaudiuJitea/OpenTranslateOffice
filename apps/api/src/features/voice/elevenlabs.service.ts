import { appSettings, callRequests, intakeMessages } from "@oto/db";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/runtime";
import { getIntegrationSettings } from "../../services/settings/integration-settings";

const LAST_SYNC_AT_KEY = "elevenlabs.lastSyncedConversationAtMs";
const LAST_SYNC_ID_KEY = "elevenlabs.lastSyncedConversationId";

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

  async syncConversationData(conversationId: string) {
    const settings = await getIntegrationSettings();
    if (!settings.elevenlabsApiKey) {
      throw new Error("ElevenLabs API Key is not configured");
    }

    const url = new URL(
      `/v1/convai/conversations/${conversationId}`,
      settings.elevenlabsBaseUrl
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "xi-api-key": settings.elevenlabsApiKey
      }
    });

    if (!response.ok) {
      console.error("Failed to fetch ElevenLabs conversation data", await response.text());
      throw new Error("Failed to fetch conversation data");
    }

    const payload = await response.json() as Record<string, any>;

    const dataCollection = payload?.analysis?.data_collection_results ?? {};
    const normalizedResults = normalizeDataCollection(dataCollection);

    const name = firstNonEmptyText([
      extractResult(normalizedResults, ["name", "fullname", "clientname"])
    ], "Unknown Name");
    const phone = firstNonEmptyText([
      extractResult(normalizedResults, ["phone", "phonenumber", "contactnumber"])
    ], "Unknown Phone");
    const projectTranslation = firstNonEmptyText([
      extractResult(normalizedResults, [
        "translationproject",
        "projecttranslation",
        "projectsummary",
        "translationdetails",
        "summary"
      ])
    ], "No project details provided");
    const numberOfPages = parsePageCount(
      extractResult(normalizedResults, ["pages", "numberofpages", "pagecount"])
    );
    const now = new Date();

    await this.db.insert(callRequests).values({
      id: conversationId,
      source: "ELEVENLABS",
      fullName: name,
      phone,
      projectSummary: projectTranslation,
      declaredPageCount: numberOfPages,
      requestedCallAt: new Date(payload?.metadata?.start_time_unix_secs ? payload.metadata.start_time_unix_secs * 1000 : Date.now()),
      status: "PENDING",
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: callRequests.id,
      set: {
        source: "ELEVENLABS",
        fullName: name,
        phone,
        projectSummary: projectTranslation,
        declaredPageCount: numberOfPages,
        requestedCallAt: new Date(payload?.metadata?.start_time_unix_secs ? payload.metadata.start_time_unix_secs * 1000 : Date.now()),
        status: "PENDING",
        updatedAt: now
      }
    });

    // Also try to sync the transcript into intake messages if available
    if (Array.isArray(payload?.transcript)) {
      for (const msg of payload.transcript) {
        if (!msg.message) continue;
        await this.db.insert(intakeMessages).values({
          id: randomUUID(),
          sessionId: conversationId,
          speaker: msg.role === "agent" ? "VOICE" : "USER",
          content: msg.message,
          createdAt: msg.time_in_call_secs 
            ? new Date((payload?.metadata?.start_time_unix_secs * 1000) + (msg.time_in_call_secs * 1000))
            : new Date()
        }).onConflictDoNothing();
      }
    }

    return { success: true, conversationId };
  }

  async syncNewConversationData() {
    const settings = await getIntegrationSettings();
    if (!settings.elevenlabsApiKey || !settings.elevenlabsAgentId) {
      throw new Error("ElevenLabs API Key or Agent ID is not configured");
    }

    const cursor = await this.getLastSyncCursor();
    const url = new URL("/v1/convai/conversations", settings.elevenlabsBaseUrl);
    url.searchParams.set("agent_id", settings.elevenlabsAgentId);
    url.searchParams.set("page_size", "100");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "xi-api-key": settings.elevenlabsApiKey
      }
    });

    if (!response.ok) {
      console.error("Failed to list ElevenLabs conversations", await response.text());
      throw new Error("Failed to list conversations");
    }

    const payload = await response.json() as { conversations?: Array<Record<string, any>> };
    const conversations: Array<Record<string, any>> = Array.isArray(payload?.conversations)
      ? payload.conversations
      : [];
    const normalized = conversations
      .map((conversation: Record<string, any>) => normalizeConversationSummary(conversation))
      .filter(
        (conversation: NormalizedConversationSummary | null): conversation is NormalizedConversationSummary =>
          Boolean(conversation)
      )
      .sort((left: NormalizedConversationSummary, right: NormalizedConversationSummary) => {
        if (right.startedAtMs !== left.startedAtMs) {
          return right.startedAtMs - left.startedAtMs;
        }

        return right.id.localeCompare(left.id);
      });

    if (normalized.length === 0) {
      throw new Error("No recent conversations found to sync");
    }

    const pending = normalized.filter((conversation: NormalizedConversationSummary) => {
      if (!cursor) {
        return true;
      }

      if (conversation.startedAtMs > cursor.startedAtMs) {
        return true;
      }

      return conversation.startedAtMs === cursor.startedAtMs && conversation.id !== cursor.conversationId;
    });

    const toSync = pending
      .sort((left: NormalizedConversationSummary, right: NormalizedConversationSummary) => left.startedAtMs - right.startedAtMs)
      .slice(0, 100);

    if (toSync.length === 0) {
      return {
        success: true,
        importedCount: 0,
        latestConversationId: cursor?.conversationId ?? null
      };
    }

    for (const conversation of toSync) {
      await this.syncConversationData(conversation.id);
    }

    const newestSynced = toSync[toSync.length - 1];
    await this.setLastSyncCursor(newestSynced);

    return {
      success: true,
      importedCount: toSync.length,
      latestConversationId: newestSynced.id
    };
  }

  private async getLastSyncCursor() {
    const rows = await this.db
      .select({
        key: appSettings.key,
        value: appSettings.value
      })
      .from(appSettings);

    const map = new Map(rows.map((row) => [row.key, row.value]));
    const startedAtMs = Number(map.get(LAST_SYNC_AT_KEY));
    const conversationId = map.get(LAST_SYNC_ID_KEY) ?? null;

    if (!Number.isFinite(startedAtMs) || !conversationId) {
      return null;
    }

    return {
      startedAtMs,
      conversationId
    };
  }

  private async setLastSyncCursor(conversation: NormalizedConversationSummary) {
    const now = new Date();

    await this.db
      .insert(appSettings)
      .values({
        key: LAST_SYNC_AT_KEY,
        value: String(conversation.startedAtMs),
        updatedAt: now,
        updatedBy: "system"
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(conversation.startedAtMs),
          updatedAt: now,
          updatedBy: "system"
        }
      });

    await this.db
      .insert(appSettings)
      .values({
        key: LAST_SYNC_ID_KEY,
        value: conversation.id,
        updatedAt: now,
        updatedBy: "system"
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: conversation.id,
          updatedAt: now,
          updatedBy: "system"
        }
      });
  }
}

interface NormalizedConversationSummary {
  id: string;
  startedAtMs: number;
}

function normalizeConversationSummary(input: Record<string, any>): NormalizedConversationSummary | null {
  const id = String(input?.conversation_id ?? input?.id ?? "").trim();
  if (!id) {
    return null;
  }

  const startedAtMs = resolveConversationStartedAtMs(input);
  return {
    id,
    startedAtMs
  };
}

function resolveConversationStartedAtMs(input: Record<string, any>) {
  const unixSecondsCandidates = [
    input?.start_time_unix_secs,
    input?.created_at_unix_secs,
    input?.metadata?.start_time_unix_secs,
    input?.metadata?.created_at_unix_secs
  ];

  for (const value of unixSecondsCandidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value * 1000;
    }
  }

  const isoCandidates = [
    input?.start_time,
    input?.created_at,
    input?.metadata?.start_time,
    input?.metadata?.created_at
  ];

  for (const value of isoCandidates) {
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
      return new Date(value).getTime();
    }
  }

  return Date.now();
}

function normalizeDataCollection(input: Record<string, unknown>) {
  const normalized = new Map<string, unknown>();

  for (const [key, value] of Object.entries(input)) {
    normalized.set(normalizeKey(key), value);
  }

  return normalized;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractResult(results: Map<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = results.get(normalizeKey(key));
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
      return (value as { value?: unknown }).value ?? null;
    }

    return value;
  }

  return null;
}

function firstNonEmptyText(values: unknown[], fallback: string) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }

  return fallback;
}

function parsePageCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return 0;
  }

  const numericMatch = text.match(/\d+/);
  if (numericMatch?.[0]) {
    return Number(numericMatch[0]);
  }

  const wordMap: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12
  };

  return wordMap[text] ?? 0;
}
