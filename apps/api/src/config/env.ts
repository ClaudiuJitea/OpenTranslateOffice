import { config as loadDotEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";

loadDotEnv();
loadDotEnv({ path: path.resolve(process.cwd(), ".env") });
loadDotEnv({ path: path.resolve(process.cwd(), "..", ".env") });
loadDotEnv({ path: path.resolve(process.cwd(), "..", "..", ".env") });

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default("./dev.sqlite"),
  JWT_SECRET: z.string().min(32).default("change-me-in-env-before-production-unsafe-key"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  LLM_PROVIDER: z.enum(["openrouter"]).default("openrouter"),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_API_KEY: optionalNonEmptyString,
  OPENROUTER_MODEL: z.string().min(1).default("google/gemini-3.1-flash-lite-preview"),
  VOICE_PROVIDER: z.enum(["elevenlabs"]).default("elevenlabs"),
  ELEVENLABS_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
  ELEVENLABS_API_KEY: optionalNonEmptyString,
  ELEVENLABS_AGENT_ID: optionalNonEmptyString,
  ELEVENLABS_WEBHOOK_SECRET: optionalNonEmptyString,
  FILE_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),
  LIBREOFFICE_PREVIEW_ENABLED: booleanString,
  LIBREOFFICE_DOCKER_BIN: z.string().default("docker"),
  LIBREOFFICE_CONTAINER_NAME: z.string().default("oto-libreoffice"),
  LIBREOFFICE_CONTAINER_STORAGE_ROOT: z.string().default("/workspace/storage"),
  LIBREOFFICE_CONVERT_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

export const env = envSchema.parse(process.env);
