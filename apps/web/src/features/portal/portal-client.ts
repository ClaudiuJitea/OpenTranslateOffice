const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function portalLogin(requestNumber: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestNumber, password })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Portal login failed");
  }

  return (await response.json()) as { token: string };
}

export async function fetchPortalRequest(token: string) {
  const response = await fetch(`${API_BASE_URL}/api/portal/request`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load portal request");
  }

  return (await response.json()) as {
    request: {
      requestNumber: string;
      fullName: string;
      sourceLanguage: string;
      targetLanguage: string;
      status: string;
      dueAt: string | null;
      createdAt: string;
    };
    deliverables: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
    }>;
  };
}

export function downloadPortalFile(token: string, fileId: string) {
  return `${API_BASE_URL}/api/portal/request/files/${fileId}/download?token=${encodeURIComponent(token)}`;
}
