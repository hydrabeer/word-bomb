import { z } from 'zod';
import type {
  ChatMessageDraft,
  ChatMessagePayload,
} from '@word-bomb/types/socket';

export const ChatMessageSchema = z.object({
  roomCode: z.string().length(4),
  sender: z.string().min(1).max(20),
  message: z.string().min(1).max(300),
  timestamp: z.number().nonnegative(),
  type: z.enum(['user', 'system']).default('user'),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Narrowing helper for runtime checks at boundaries */
export function isChatMessage(x: unknown): x is ChatMessage {
  return ChatMessageSchema.safeParse(x).success;
}

/** Validate or throw – convenient for receive paths */
export function parseChatMessage(x: unknown): ChatMessage {
  return ChatMessageSchema.parse(x);
}

export const ChatMessageInboundSchema = ChatMessageSchema.omit({
  timestamp: true,
}).strict();

type ChatMessageInbound = z.infer<typeof ChatMessageInboundSchema>;

export function toAuthoritativeChatMessage(raw: unknown): ChatMessagePayload {
  const data: ChatMessageInbound = ChatMessageInboundSchema.parse(
    raw,
  ) satisfies ChatMessageDraft;
  return {
    ...data,
    timestamp: Date.now(), // server is source of truth for timestamp
  };
}
