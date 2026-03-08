import { z } from "zod";

export const intakeTicketSchema = z.object({
  fullName: z.string().min(1),
  companyName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  sourceLanguage: z.string().min(2),
  targetLanguage: z.string().min(2),
  documentType: z.string().min(1),
  fileType: z.string().min(1),
  certificationRequired: z.boolean(),
  deadlineIso: z.string().datetime().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  deliveryMethod: z.string().optional(),
  appointmentType: z.enum(["CALL", "IN_OFFICE", "NONE"]).optional(),
  appointmentDateTimeIso: z.string().datetime().optional(),
  notes: z.string().optional()
});

export type IntakeTicketSchema = z.infer<typeof intakeTicketSchema>;
