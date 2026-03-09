export interface CallRequestRecord {
  id: string;
  fullName: string;
  phone: string;
  projectSummary: string;
  declaredPageCount: number;
  requestedCallAt: string | null;
  status: string;
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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to submit call request");
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
