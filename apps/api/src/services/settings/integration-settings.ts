import { appSettings } from "@oto/db";
import { eq, inArray } from "drizzle-orm";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";

const db = getDb();

const DEFAULTS = {
  llmProvider: env.LLM_PROVIDER,
  openrouterBaseUrl: env.OPENROUTER_BASE_URL,
  openrouterModel: env.OPENROUTER_MODEL,
  openrouterApiKey: env.OPENROUTER_API_KEY ?? "",
  voiceProvider: env.VOICE_PROVIDER,
  elevenlabsBaseUrl: env.ELEVENLABS_BASE_URL,
  elevenlabsApiKey: env.ELEVENLABS_API_KEY ?? "",
  elevenlabsAgentId: env.ELEVENLABS_AGENT_ID ?? "",
  elevenlabsWebhookSecret: env.ELEVENLABS_WEBHOOK_SECRET ?? ""
} as const;

const KEYS = Object.keys(DEFAULTS) as Array<keyof typeof DEFAULTS>;

type IntegrationSettings = typeof DEFAULTS;

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, KEYS));

  const map = new Map(rows.map((row) => [row.key, row.value]));

  const openrouterApiKey = normalizeSecretValue(
    map.get("openrouterApiKey"),
    DEFAULTS.openrouterApiKey
  );
  const elevenlabsApiKey = normalizeSecretValue(
    map.get("elevenlabsApiKey"),
    DEFAULTS.elevenlabsApiKey
  );
  const elevenlabsWebhookSecret = normalizeSecretValue(
    map.get("elevenlabsWebhookSecret"),
    DEFAULTS.elevenlabsWebhookSecret
  );

  return {
    llmProvider: (map.get("llmProvider") ?? DEFAULTS.llmProvider) as IntegrationSettings["llmProvider"],
    openrouterBaseUrl: map.get("openrouterBaseUrl") ?? DEFAULTS.openrouterBaseUrl,
    openrouterModel: map.get("openrouterModel") ?? DEFAULTS.openrouterModel,
    openrouterApiKey,
    voiceProvider: (map.get("voiceProvider") ?? DEFAULTS.voiceProvider) as IntegrationSettings["voiceProvider"],
    elevenlabsBaseUrl: map.get("elevenlabsBaseUrl") ?? DEFAULTS.elevenlabsBaseUrl,
    elevenlabsApiKey,
    elevenlabsAgentId: map.get("elevenlabsAgentId") ?? DEFAULTS.elevenlabsAgentId,
    elevenlabsWebhookSecret
  };
}

export async function updateIntegrationSettings(
  input: Partial<IntegrationSettings>,
  updatedBy?: string
) {
  const entries = Object.entries(input) as Array<[keyof IntegrationSettings, string]>;
  const now = new Date();

  for (const [key, value] of entries) {
    if (!KEYS.includes(key)) {
      continue;
    }

    await db
      .insert(appSettings)
      .values({
        key,
        value: String(value),
        updatedAt: now,
        updatedBy
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: String(value),
          updatedAt: now,
          updatedBy
        }
      });
  }

  return getIntegrationSettings();
}

export function redactSecrets(settings: IntegrationSettings) {
  return {
    ...settings,
    openrouterApiKey: mask(settings.openrouterApiKey),
    elevenlabsApiKey: mask(settings.elevenlabsApiKey),
    elevenlabsWebhookSecret: mask(settings.elevenlabsWebhookSecret)
  };
}

function mask(value: string) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalizeSecretValue(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  // If a redacted placeholder was accidentally persisted, keep using env/default secret.
  if (isMaskedSecret(value)) {
    return fallback;
  }

  return value;
}

function isMaskedSecret(value: string) {
  return value.includes("...") && value.length <= 24;
}
