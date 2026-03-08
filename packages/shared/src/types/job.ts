export type JobStatus =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "REVIEW"
  | "WAITING_CUSTOMER"
  | "BLOCKED"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "ARCHIVED";

export interface IntakeTicketInput {
  fullName: string;
  companyName?: string;
  email: string;
  phone?: string;
  sourceLanguage: string;
  targetLanguage: string;
  documentType: string;
  fileType: string;
  certificationRequired: boolean;
  deadlineIso?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deliveryMethod?: string;
  appointmentType?: "CALL" | "IN_OFFICE" | "NONE";
  appointmentDateTimeIso?: string;
  notes?: string;
}
