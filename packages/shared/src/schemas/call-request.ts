import { z } from "zod";

export const callRequestSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(5),
  projectSummary: z.string().min(10),
  declaredPageCount: z.coerce.number().int().positive(),
  requestedCallAtIso: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "requestedCallAtIso must be a valid ISO date"
  })
});

export type CallRequestInput = z.infer<typeof callRequestSchema>;
