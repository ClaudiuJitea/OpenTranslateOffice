import { z } from "zod";

export const intakeRequestSchema = z.object({
  fullName: z.string().min(1),
  companyName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  sourceLanguage: z.string().min(2),
  targetLanguage: z.string().min(2),
  documentType: z.string().min(1),
  fileType: z.string().min(1),
  certificationRequired: z.coerce.boolean(),
  deadlineIso: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "deadlineIso must be a valid ISO date"
    }),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  deliveryMethod: z.string().optional(),
  appointmentType: z.enum(["CALL", "IN_OFFICE", "NONE"]).optional(),
  appointmentDateTimeIso: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "appointmentDateTimeIso must be a valid ISO date"
    }),
  notes: z.string().optional()
});

export type IntakeRequestInput = z.infer<typeof intakeRequestSchema>;
