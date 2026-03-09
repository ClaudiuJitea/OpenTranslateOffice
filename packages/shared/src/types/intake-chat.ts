export type IntakeFieldKey =
  | "fullName"
  | "email"
  | "sourceLanguage"
  | "targetLanguage"
  | "documentType"
  | "fileType"
  | "pageCountDeclared"
  | "certificationRequired"
  | "urgency"
  | "files";

export interface IntakeChatExtracted {
  fullName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  documentType?: string;
  fileType?: string;
  pageCountDeclared?: number;
  pageCountVerified?: number;
  certificationRequired?: boolean;
  deadlineIso?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deliveryMethod?: string;
  appointmentType?: "CALL" | "IN_OFFICE" | "NONE";
  appointmentDateTimeIso?: string;
  notes?: string;
}

export interface IntakeChatSessionDTO {
  id: string;
  status: "IN_PROGRESS" | "READY_FOR_REVIEW";
  providerUsed?: "openrouter" | "fallback" | "system";
  completenessScore: number;
  uploadedFilesCount: number;
  missing: IntakeFieldKey[];
  extracted: IntakeChatExtracted;
  portalCredentials?: {
    requestNumber: string;
    portalPassword: string;
  };
  messages: Array<{
    id: string;
    speaker: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string;
  }>;
}
