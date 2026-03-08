import type { JobStatus } from "../types/job";

export const JOB_STATUS_ORDER: JobStatus[] = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "REVIEW",
  "WAITING_CUSTOMER",
  "BLOCKED",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "ARCHIVED"
];
