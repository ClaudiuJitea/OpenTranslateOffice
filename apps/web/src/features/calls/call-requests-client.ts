export interface CallRequestRecord {
  id: string;
  source: "WEB" | "ELEVENLABS";
  fullName: string;
  phone: string;
  projectSummary: string;
  declaredPageCount: number;
  requestedCallAt: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function createCallRequest(input: {
  fullName: string;
  phone: string;
  projectSummary: string;
  declaredPageCount: number;
  requestedCallAtIso: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/call-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      details?: {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
    } | null;
    const fieldErrors = payload?.details?.fieldErrors ?? {};
    const firstFieldError = Object.values(fieldErrors).flat().find(Boolean);
    const firstFormError = payload?.details?.formErrors?.find(Boolean);
    throw new Error(
      firstFieldError ?? firstFormError ?? payload?.error ?? "Unable to submit call request"
    );
  }

  const payload = (await response.json()) as { item: CallRequestRecord };
  return payload.item;
}

export async function getStaffCallRequests() {
  const response = await fetch(`${API_BASE_URL}/api/staff/call-requests`, {
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to load call requests");
  }

  const payload = (await response.json()) as { items: CallRequestRecord[] };
  return payload.items;
}

export async function syncLatestRecording() {
  const response = await fetch(`${API_BASE_URL}/api/voice/sync-latest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to sync latest recording");
  }

  const payload = await response.json() as {
    success: boolean;
    importedCount: number;
    latestConversationId: string | null;
  };
  return payload;
}

export async function updateCallRequestStatus(
  id: string,
  status: CallRequestRecord["status"]
) {
  const response = await fetch(`${API_BASE_URL}/api/staff/call-requests/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status }),
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to update call request status");
  }

  const payload = (await response.json()) as { item: CallRequestRecord };
  return payload.item;
}

export async function deleteCallRequest(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/staff/call-requests/${id}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to delete call request");
  }
}
