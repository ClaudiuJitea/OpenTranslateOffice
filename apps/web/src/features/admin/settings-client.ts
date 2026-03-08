export interface IntegrationSettings {
  llmProvider: "openrouter";
  openrouterBaseUrl: string;
  openrouterModel: string;
  openrouterApiKey: string;
  voiceProvider: "elevenlabs";
  elevenlabsBaseUrl: string;
  elevenlabsApiKey: string;
  elevenlabsAgentId: string;
  elevenlabsWebhookSecret: string;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "CUSTOMER" | "EMPLOYEE" | "ADMIN";
  isActive: boolean;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function getIntegrationSettings() {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/integrations`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load integration settings");
  }

  const payload = (await response.json()) as { settings: IntegrationSettings };
  return payload.settings;
}

export async function updateIntegrationSettings(values: Partial<IntegrationSettings>) {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/integrations`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(values),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to update integration settings");
  }

  const payload = (await response.json()) as { settings: IntegrationSettings };
  return payload.settings;
}

export async function getAdminUsers() {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load users");
  }

  const payload = (await response.json()) as { items: AdminUser[] };
  return payload.items;
}

export async function createAdminUser(input: {
  fullName: string;
  email: string;
  role: "EMPLOYEE" | "ADMIN";
  password?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to create user");
  }
}

export async function updateAdminUser(
  userId: string,
  input: Partial<{
    fullName: string;
    role: "EMPLOYEE" | "ADMIN";
    isActive: boolean;
    password: string;
  }>
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update user");
  }
}
