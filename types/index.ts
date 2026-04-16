import type {
  AgwsAgent,
  AgwsChannel,
  AgwsSubAgent,
  AgwsMessage,
  AgwsUser,
  AgwsAttachment,
  AgwsReaction,
  AgwsConversation,
  PlatformRole,
  AgentAccessRole,
  AgentStatus,
  ConversationType,
  AuthorType,
  ContentType,
  OverrideAccess,
} from '@prisma/client'

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type {
  AgwsAgent,
  AgwsChannel,
  AgwsSubAgent,
  AgwsMessage,
  AgwsUser,
  AgwsAttachment,
  AgwsReaction,
  AgwsConversation,
  PlatformRole,
  AgentAccessRole,
  AgentStatus,
  ConversationType,
  AuthorType,
  ContentType,
  OverrideAccess,
}

// ─── Session User ─────────────────────────────────────────────────────────────

/**
 * The user object attached to Auth.js sessions.
 * Exposed to both server and client via useSession / auth().
 */
export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: PlatformRole
  entraId: string
  image?: string | null
}

// ─── Agent With Channels ──────────────────────────────────────────────────────

/**
 * An agent with its channels and sub-agents eagerly loaded.
 * Used in sidebar and agent overview pages.
 */
export interface AgentWithChannels extends AgwsAgent {
  channels: AgwsChannel[]
  subAgents: AgwsSubAgent[]
}

/**
 * AgentWithChannels plus the user's effective access role for this agent.
 */
export interface AgentWithAccess extends AgentWithChannels {
  userRole: AgentAccessRole | 'PLATFORM_ADMIN' | null
}

// ─── Message With Author ──────────────────────────────────────────────────────

/**
 * Author info embedded in a message (subset of AgwsUser for display).
 */
export interface MessageAuthor {
  id: string
  displayName: string
  email: string
  avatarUrl: string | null
  role: PlatformRole
}

/**
 * A message with its author, attachments, and reactions loaded.
 */
export interface MessageWithAuthor extends AgwsMessage {
  author: MessageAuthor | null
  attachments: AgwsAttachment[]
  reactions: ReactionWithUser[]
}

/**
 * A reaction with the user who reacted.
 */
export interface ReactionWithUser extends AgwsReaction {
  user: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
}

// ─── Conversation With Messages ───────────────────────────────────────────────

/**
 * A conversation with its messages fully loaded (for initial render).
 */
export interface ConversationWithMessages extends AgwsConversation {
  messages: MessageWithAuthor[]
  channel: AgwsChannel | null
  agent: AgwsAgent | null
  subAgent: AgwsSubAgent | null
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedMessages {
  messages: MessageWithAuthor[]
  cursor: string | null   // ID of the oldest message in this page (for infinite scroll)
  hasMore: boolean
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface ApiError {
  error: string
  code?: string
  statusCode?: number
}

export interface ApiSuccess<T = void> {
  data: T
  message?: string
}

// ─── Streaming ────────────────────────────────────────────────────────────────

/**
 * The shape of streaming message events sent over SSE from our API routes.
 * Mirrors the adapter's StreamChunk type but is used at the HTTP boundary.
 */
export type SSEEvent =
  | { type: 'message_start'; messageId: string }
  | { type: 'content_delta'; delta: string }
  | { type: 'thinking'; state: string; detail?: string }
  | { type: 'message_end'; messageId: string; usage?: Record<string, number> }
  | { type: 'error'; code: string; message: string }

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AccessPolicySummary {
  agentId: string
  agentName: string
  agentSlug: string
  groupId: string
  groupEntraId: string
  groupDisplayName: string
  role: AgentAccessRole
}

export interface UserOverrideSummary {
  userId: string
  userDisplayName: string
  userEmail: string
  agentId: string
  agentName: string
  access: OverrideAccess
  grantedBy: string
  expiresAt: Date | null
  reason: string | null
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'message.sent'
  | 'message.edited'
  | 'message.deleted'
  | 'reaction.added'
  | 'reaction.removed'
  | 'access.granted'
  | 'access.revoked'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'channel.created'
  | 'channel.archived'
  | 'file.uploaded'
  | 'file.deleted'
  | 'user.login'
  | 'user.groups_synced'
  | string // allow future extensibility
