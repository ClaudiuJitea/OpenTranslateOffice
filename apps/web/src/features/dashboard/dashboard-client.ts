const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export interface JobSummary {
  id: string;
  title: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  priority: string;
  dueAt: string | null;
  certificationRequired: boolean;
}

export interface JobDetailResponse {
  job: JobSummary;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string | null;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    changedAt: string;
  }>;
  aiRuns: Array<{
    id: string;
    runType: string;
    provider: string;
    model: string;
    status: string;
    outputSummary: string | null;
    createdAt: string;
  }>;
  deliverables: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  sourceDocuments: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    extension: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  activeAssignments?: Array<{
    id: string;
    userId: string;
    fullName: string | null;
    email: string | null;
    role: string | null;
  }>;
}

export interface AiDocumentTranslationRun {
  runId: string;
  status: "COMPLETED" | "RUNNING" | "FAILED";
}

export interface AssignableUser {
  id: string;
  fullName: string;
  email: string;
  role: "EMPLOYEE" | "ADMIN";
}

export async function fetchAssignedJobs(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/jobs${query}`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load jobs");
  }

  const payload = (await response.json()) as { items: JobSummary[]; total: number };
  return payload;
}

export async function fetchJobDetail(jobId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    credentials: "include"
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("JOB_NOT_FOUND");
    }
    throw new Error("Unable to load job detail");
  }

  return (await response.json()) as JobDetailResponse;
}

export async function updateJobStatus(jobId: string, toStatus: string, reason?: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ toStatus, reason })
  });

  if (!response.ok) {
    throw new Error("Unable to update status");
  }
}

export async function addJobNote(jobId: string, content: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    throw new Error("Unable to add note");
  }
}

export async function runAiAction(jobId: string, action: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/ai/${action}`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to run AI action");
  }
}

export async function uploadDeliverable(jobId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/deliverables`, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Unable to upload deliverable");
  }
}

export async function fetchAssignableUsers() {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Unable to load assignable users");
  }
  const payload = (await response.json()) as {
    items: Array<{
      id: string;
      fullName: string;
      email: string;
      role: "CUSTOMER" | "EMPLOYEE" | "ADMIN";
      isActive: boolean;
    }>;
  };

  return payload.items
    .filter(
      (item): item is {
        id: string;
        fullName: string;
        email: string;
        role: "EMPLOYEE" | "ADMIN";
        isActive: boolean;
      } => item.isActive && (item.role === "EMPLOYEE" || item.role === "ADMIN")
    )
    .map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      role: item.role
    }));
}

export async function assignJob(jobId: string, assigneeUserId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ assigneeUserId })
  });
  if (!response.ok) {
    throw new Error("Unable to assign job");
  }
}

export async function refuseJob(jobId: string, reason?: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/refuse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reason })
  });
  if (!response.ok) {
    throw new Error("Unable to refuse job");
  }
}

export async function deleteJob(jobId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("JOB_NOT_FOUND");
    }
    throw new Error("Unable to delete job");
  }
}

export function sourceDocumentViewUrl(jobId: string, docId: string) {
  return `${API_BASE_URL}/api/jobs/${jobId}/source-documents/${docId}/view`;
}

export function sourceDocumentDownloadUrl(jobId: string, docId: string) {
  return `${API_BASE_URL}/api/jobs/${jobId}/source-documents/${docId}/download`;
}

export async function translateSourceDocumentWithAi(jobId: string, docId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/source-documents/${docId}/translate-ai`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to translate source document");
  }

  return (await response.json()) as AiDocumentTranslationRun;
}

export function aiTranslationDownloadUrl(jobId: string, runId: string) {
  return `${API_BASE_URL}/api/jobs/${jobId}/ai-translations/${runId}/download`;
}

export async function sendAiTranslationToCustomer(jobId: string, runId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/ai-translations/${runId}/send-to-customer`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to deliver AI translation to customer");
  }

  return (await response.json()) as { ok: true; deliverableId: string };
}
