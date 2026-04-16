import type { PlatformRole, AgentStatus, AgentAccessRole, AuthorType, ContentType } from '@prisma/client'

// ──────────────────────────────────────────────────────────────
// SESSION / USER
// ──────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: PlatformRole
  entraId: string
  image?: string | null
}

// ──────────────────────────────────────────────────────────────
// AGENT TYPES (for UI layer)
// ──────────────────────────────────────────────────────────────

export interface ChannelSidebarItem {
  id: string
  slug: string
  name: string
  isDefault: boolean
  unreadCount: number
}

export interface SubAgentSidebarItem {
  id: string
  name: string
  slug: string
  description?: string | null
  avatarUrl?: string | null
  brandColor?: string | null
  status: AgentStatus
}

export interface AgentWithSidebarData {
  id: string
  slug: string
  name: string
  description?: string | null
  shortTagline?: string | null
  avatarUrl?: string | null
  brandColor?: string | null
  status: AgentStatus
  channels: ChannelSidebarItem[]
  subAgents: SubAgentSidebarItem[]
  totalUnread: number
}

export interface AgentChannel {
  id: string
  slug: string
  name: string
  description?: string | null
  isDefault: boolean
  isArchived: boolean
  sortOrder: number
}

export interface AgentWithChannels {
  id: string
  slug: string
  name: string
  description?: string | null
  shortTagline?: string | null
  avatarUrl?: string | null
  brandColor?: string | null
  brandColorDark?: string | null
  status: AgentStatus
  capabilities: string[]
  ownerTeam?: string | null
  channels: AgentChannel[]
}

// ──────────────────────────────────────────────────────────────
// DIRECT MESSAGES
// ──────────────────────────────────────────────────────────────

export interface DmConversation {
  id: string
  agentName: string
  agentAvatarUrl?: string | null
  agentBrandColor?: string | null
  agentStatus: AgentStatus
  lastMessage?: string | null
  lastMessageAt?: Date | null
  unreadCount: number
}

// ──────────────────────────────────────────────────────────────
// MESSAGES
// ──────────────────────────────────────────────────────────────

export interface MessageAuthor {
  id: string
  displayName: string
  email: string
  avatarUrl?: string | null
}

export interface MessageAttachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  blobUrl: string
  sasUrl?: string | null
}

export interface MessageReaction {
  emoji: string
  count: number
  userIds: string[]
  hasReacted: boolean
}

export interface MessageWithAuthor {
  id: string
  conversationId: string
  authorId?: string | null
  authorType: AuthorType
  agentId?: string | null
  agentName?: string | null
  agentAvatarUrl?: string | null
  agentBrandColor?: string | null
  content: string
  contentType: ContentType
  isStreaming: boolean
  editedAt?: Date | null
  deletedAt?: Date | null
  parentMessageId?: string | null
  parentMessagePreview?: string | null
  createdAt: Date
  author?: MessageAuthor | null
  attachments: MessageAttachment[]
  reactions: MessageReaction[]
}

// ──────────────────────────────────────────────────────────────
// RECENT THREADS
// ──────────────────────────────────────────────────────────────

export interface RecentThread {
  id: string
  title?: string | null
  agentName: string
  agentBrandColor?: string | null
  lastMessageAt?: Date | null
  href: string
}
