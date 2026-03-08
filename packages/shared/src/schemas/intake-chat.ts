import { z } from "zod";

export const createIntakeChatSessionSchema = z.object({
  initialMessage: z.string().min(1).max(2000).optional(),
  locale: z.enum(["en", "pl"]).optional()
});

export const postIntakeChatMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  locale: z.enum(["en", "pl"]).optional()
});

export type CreateIntakeChatSessionInput = z.infer<typeof createIntakeChatSessionSchema>;
export type PostIntakeChatMessageInput = z.infer<typeof postIntakeChatMessageSchema>;
