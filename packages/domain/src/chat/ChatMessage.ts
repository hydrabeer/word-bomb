import { z } from "zod";

export const ChatMessageSchema = z.object({
  roomCode: z.string().length(4),
  sender: z.string().min(1).max(20),
  message: z.string().min(1).max(300),
  timestamp: z.number().nonnegative(),
  type: z.enum(["user", "system"]).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
