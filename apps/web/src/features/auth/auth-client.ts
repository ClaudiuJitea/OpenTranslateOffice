export type Role = "CUSTOMER" | "EMPLOYEE" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function loginWithPassword(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Login failed");
  }

  const payload = (await response.json()) as { user: SessionUser };
  return payload.user;
}

export async function logoutSession() {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
}

export async function fetchSessionUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { user: SessionUser };
    return payload.user;
  } catch {
    return null;
  }
}
