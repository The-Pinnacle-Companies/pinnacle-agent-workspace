# AI Agent Workspace — Full Product Spec & Architecture
**Internal App for The Pinnacle Companies**
**Version:** 1.0 | **Date:** 2026-04-15 | **Author:** Robbie (AI)

---

## 1. PRODUCT SUMMARY

**AI Agent Workspace** is a premium internal web application that gives Pinnacle team members a world-class chat experience for collaborating with branded AI agents — replacing the clunky Microsoft Teams bot interface with something closer to Slack or Discord in quality and feel.

**In one sentence:** A Slack-quality internal portal where authenticated Pinnacle employees interact with branded AI agents (like Friday) and their specialist sub-agents through shared channels, threads, and private chats — with enterprise-grade access control via Microsoft Entra ID.

**What it replaces:** The current Teams bot experience.
**What it's not:** A public-facing product. Not a Teams replacement. Not a general-purpose chat app.

---

## 2. ASSUMPTIONS & DECISIONS

| # | Assumption / Decision | Rationale |
|---|---|---|
| 1 | Next.js 14 App Router (monorepo) | Best Azure/Vercel deploy story; server components reduce client JS |
| 2 | Auth.js v5 (NextAuth) + Azure AD provider | Most mature Entra integration; server-side session handling |
| 3 | PostgreSQL via Prisma | Clean schema isolation; Prisma migrations; Azure Database for PostgreSQL |
| 4 | Tailwind CSS + shadcn/ui | Premium look without heavy design system cost; fully customizable |
| 5 | Pusher or Ably for real-time (optional fallback: SSE) | Managed WebSocket; avoids self-hosting complexity in MVP; swap later |
| 6 | Azure Blob Storage for file attachments | Native Azure; no third-party cost; generates SAS URLs |
| 7 | Separate DB schema `agent_workspace` | Isolates from legacy QB tables; still same Azure PG instance |
| 8 | OpenClaw adapter via HTTP to gateway | Agents live behind OpenClaw; app is the UX layer, not the agent runtime |
| 9 | Entra groups fetched at login and cached in DB | Can't query Graph API on every request; cache with TTL |
| 10 | Agent access = Entra group membership | Primary authorization; admin overrides possible but secondary |
| 11 | Sub-agents are persistent, not ephemeral | They represent recurring specialist workflows under a main agent |
| 12 | Messages stored in app DB even if OpenClaw has memory | App owns the UX persistence; OpenClaw memory is its own thing |
| 13 | Docker + Azure Container Apps for deployment | Portable; Azure-native; easy CI/CD |
| 14 | Mobile responsive but desktop-first | Internal tool; most usage will be desktop |
| 15 | No AI inference directly in app | App routes messages to OpenClaw; never calls model APIs directly |

---

## 3. ARCHITECTURE PROPOSAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                           │
│   Next.js App Router · React · Tailwind · shadcn/ui             │
│   Pusher client · SSE for streaming · React Query               │
└────────────────────┬───────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼───────────────────────────────────────────┐
│                    NEXT.JS SERVER (Node.js)                     │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth.js v5 │  │  API Routes  │  │  Server Components   │  │
│  │  Entra ID   │  │  /api/*      │  │  RSC + Actions       │  │
│  └─────────────┘  └──────┬───────┘  └──────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │              OpenClaw Adapter Layer                      │   │
│  │  AgentAdapter interface · HTTP client · SSE proxy        │   │
│  └────────────────────────┬────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼────────┐ ┌────────▼───────┐ ┌──────────▼────────┐
│  Azure PG DB   │ │ OpenClaw       │ │ Azure Blob Storage │
│  (Prisma)      │ │ Gateway(s)     │ │ (file uploads)     │
│  schema:       │ │ robbie / friday│ │                    │
│  agent_ws_*    │ │ /api/v1/*      │ │                    │
└────────────────┘ └────────────────┘ └────────────────────┘
        │
┌───────▼────────┐
│ Microsoft      │
│ Graph API      │
│ (Entra groups) │
└────────────────┘
```

### Key Architectural Principles
- **Server-authoritative:** All access checks happen server-side. Client never trusts itself.
- **Adapter isolation:** OpenClaw integration is behind an interface. Swap adapters without touching UI.
- **Schema isolation:** All tables prefixed `agws_` (Agent Workspace). Zero coupling to existing tables.
- **Streaming-first:** Designed for SSE streaming from agents; non-streaming is a graceful degradation.

---

## 4. UX / INFORMATION ARCHITECTURE

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px fixed)  │  MAIN CONTENT (flex)   │ RIGHT PANEL   │
│                        │                        │ (320px, opt.) │
│ [🏔️ Pinnacle AI]       │ ┌────────────────────┐ │               │
│                        │ │ CHANNEL HEADER     │ │ Thread detail │
│ 🏠 Home                │ │ #general           │ │  or           │
│                        │ │ Friday · Marketing │ │ Agent info    │
│ ─── AGENTS ────        │ └────────────────────┘ │               │
│                        │                        │               │
│ 🟣 Friday              │  [message list]        │               │
│  ├ # general           │                        │               │
│  ├ # campaigns         │                        │               │
│  ├ # content           │  [composer]            │               │
│  └ ─ Sub-agents        │                        │               │
│     ├ SEO              │                        │               │
│     ├ Content          │                        │               │
│     └ Social           │                        │               │
│                        │                        │               │
│ 🔵 [Next Agent...]     │                        │               │
│                        │                        │               │
│ ─── DIRECT ────        │                        │               │
│ 💬 Friday (private)    │                        │               │
│ 💬 SEO (private)       │                        │               │
│                        │                        │               │
│ ─── RECENT ────        │                        │               │
│ 🧵 Campaign thread     │                        │               │
│                        │                        │               │
│ ──────────────         │                        │               │
│ ⚙️ Admin               │                        │               │
│ 👤 [User avatar]       │                        │               │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Page Inventory

| Route | Description |
|---|---|
| `/` | Home — recent activity, pinned channels |
| `/agents/[agentId]` | Agent overview with capability header |
| `/agents/[agentId]/channels/[channelId]` | Channel view |
| `/agents/[agentId]/channels/[channelId]/threads/[threadId]` | Thread view (right panel or full) |
| `/agents/[agentId]/sub-agents/[subAgentId]` | Sub-agent dedicated view |
| `/dm/[agentId]` | Private 1:1 chat with agent |
| `/admin` | Admin dashboard |
| `/admin/agents` | Agent + sub-agent registry |
| `/admin/access` | Access policy editor (group → agent mapping) |
| `/admin/audit` | Audit log viewer |

### 4.3 Agent Module Header (Key UX Component)

```
┌────────────────────────────────────────────────────────┐
│  [Avatar/Icon]  Friday                         🟢 Online │
│  🎯 Marketing AI                              [Manage]  │
│                                                         │
│  The Pinnacle Companies' marketing intelligence agent.  │
│  Handles campaigns, content strategy, SEO, and social.  │
│                                                         │
│  [📝 Content] [🔍 SEO] [📱 Social] [📊 Analytics]      │
│                                                         │
│  Owned by: Marketing Team · Access: Marketing-All      │
└────────────────────────────────────────────────────────┘
```

### 4.4 Joyful UX Touches (Required)
- **Thinking animation:** Animated orb/pulse with agent brand color when agent is processing
- **Streaming text:** Characters appear word-by-word with subtle fade-in
- **Message reactions:** Emoji reactions on messages
- **Thread previews:** Hover previews on thread links
- **Empty states:** Illustrated, on-brand, with a call to action
- **Unread indicators:** Red badges, bold channel names, unread line separator
- **Drag-drop upload:** Full-area drop zone when dragging files into chat
- **Smooth transitions:** Page transitions, sidebar collapse, panel open/close
- **Agent status chip:** Live "thinking," "running task," "idle" states
- **Keyboard shortcuts:** ⌘K command palette, ⌘/ shortcuts panel

---

## 5. PERMISSION MODEL

### 5.1 Roles

| Role | Description | How Assigned |
|---|---|---|
| `PLATFORM_ADMIN` | Full access to all agents, admin UI | Entra group or manual grant |
| `AGENT_ADMIN` | Can manage a specific agent's settings | Entra group or manual grant |
| `MEMBER` | Can see + use agents they have access to | Default for authenticated users |

### 5.2 Access Layers

```
Layer 1: Authentication
  └─ Must be authenticated via Entra ID
  └─ Session validated server-side on every request

Layer 2: Platform Access
  └─ User must be in at least one mapped Entra group
  └─ Otherwise: 403 "Access not granted" splash

Layer 3: Agent Visibility
  └─ Agent is visible only if:
       (a) User is in an Entra group mapped to that agent, OR
       (b) User has PLATFORM_ADMIN role, OR
       (c) Admin has granted user explicit agent access

Layer 4: Channel/DM Access
  └─ Agent channels: visible to all with agent access
  └─ Private DMs: per-user, always private
  └─ Threads: inherit channel access

Layer 5: Admin Functions
  └─ Admin UI: PLATFORM_ADMIN or AGENT_ADMIN only
  └─ Agent config: AGENT_ADMIN for that agent
  └─ Access policy edits: PLATFORM_ADMIN only
```

### 5.3 Entra Group Mappings (DB-backed)

```
agws_access_policies
  agent_id → entra_group_id → role (MEMBER | AGENT_ADMIN)

agws_user_agent_overrides
  user_id → agent_id → access (GRANT | REVOKE) → granted_by → expires_at
```

### 5.4 Data Isolation
- Queries always filter by `user_id` or verified group membership
- No client-side ID guessing can bypass server authorization
- All agent-proxied messages include user context for audit

---

## 6. DATA MODEL & PRISMA SCHEMA

```prisma
// schema.prisma
// All tables use prefix agws_ for isolation

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────────────────────────
// IDENTITY
// ──────────────────────────────────────────────────────────────

model AgwsUser {
  id              String   @id @default(cuid())
  entraId         String   @unique  // Entra object ID
  email           String   @unique
  displayName     String
  avatarUrl       String?
  role            PlatformRole @default(MEMBER)
  lastLoginAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  groupMemberships AgwsUserGroup[]
  messages         AgwsMessage[]
  agentOverrides   AgwsUserAgentOverride[]
  dmConversations  AgwsConversation[] @relation("DmUser")
  auditLogs        AgwsAuditLog[]

  @@map("agws_users")
}

model AgwsEntraGroup {
  id          String   @id @default(cuid())
  entraId     String   @unique  // Entra group object ID
  displayName String
  syncedAt    DateTime @default(now())

  members     AgwsUserGroup[]
  policies    AgwsAccessPolicy[]

  @@map("agws_entra_groups")
}

model AgwsUserGroup {
  userId   String
  groupId  String

  user     AgwsUser       @relation(fields: [userId], references: [id], onDelete: Cascade)
  group    AgwsEntraGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@id([userId, groupId])
  @@map("agws_user_groups")
}

enum PlatformRole {
  MEMBER
  AGENT_ADMIN
  PLATFORM_ADMIN
}

// ──────────────────────────────────────────────────────────────
// AGENTS
// ──────────────────────────────────────────────────────────────

model AgwsAgent {
  id              String   @id @default(cuid())
  slug            String   @unique   // e.g. "friday"
  name            String             // e.g. "Friday"
  description     String?
  shortTagline    String?            // e.g. "Marketing AI"
  avatarUrl       String?
  brandColor      String?            // hex, e.g. "#7C3AED"
  brandColorDark  String?
  status          AgentStatus @default(ACTIVE)
  openclawGateway String?            // e.g. "https://friday.collectivedg.com"
  openclawAgentId String?            // internal ID in OpenClaw
  adapterType     String   @default("openclaw")
  adapterConfig   Json?              // flexible config blob
  ownerTeam       String?
  capabilities    String[] @default([])  // chip labels
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  subAgents        AgwsSubAgent[]
  channels         AgwsChannel[]
  accessPolicies   AgwsAccessPolicy[]
  userOverrides    AgwsUserAgentOverride[]
  conversations    AgwsConversation[]

  @@map("agws_agents")
}

model AgwsSubAgent {
  id              String   @id @default(cuid())
  agentId         String
  slug            String
  name            String
  description     String?
  avatarUrl       String?
  brandColor      String?
  status          AgentStatus @default(ACTIVE)
  openclawAgentId String?
  adapterConfig   Json?
  capabilities    String[] @default([])
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  agent        AgwsAgent          @relation(fields: [agentId], references: [id], onDelete: Cascade)
  conversations AgwsConversation[]

  @@unique([agentId, slug])
  @@map("agws_sub_agents")
}

enum AgentStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
}

// ──────────────────────────────────────────────────────────────
// ACCESS CONTROL
// ──────────────────────────────────────────────────────────────

model AgwsAccessPolicy {
  id        String   @id @default(cuid())
  agentId   String
  groupId   String
  role      AgentAccessRole @default(MEMBER)
  createdAt DateTime @default(now())

  agent AgwsAgent      @relation(fields: [agentId], references: [id], onDelete: Cascade)
  group AgwsEntraGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([agentId, groupId])
  @@map("agws_access_policies")
}

model AgwsUserAgentOverride {
  id        String   @id @default(cuid())
  userId    String
  agentId   String
  access    OverrideAccess  // GRANT or REVOKE
  grantedBy String
  expiresAt DateTime?
  reason    String?
  createdAt DateTime @default(now())

  user  AgwsUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  agent AgwsAgent @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([userId, agentId])
  @@map("agws_user_agent_overrides")
}

enum AgentAccessRole {
  MEMBER
  AGENT_ADMIN
}

enum OverrideAccess {
  GRANT
  REVOKE
}

// ──────────────────────────────────────────────────────────────
// CHANNELS
// ──────────────────────────────────────────────────────────────

model AgwsChannel {
  id          String   @id @default(cuid())
  agentId     String
  slug        String
  name        String             // e.g. "general", "campaigns"
  description String?
  isDefault   Boolean  @default(false)
  isArchived  Boolean  @default(false)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  agent         AgwsAgent        @relation(fields: [agentId], references: [id], onDelete: Cascade)
  conversations AgwsConversation[]

  @@unique([agentId, slug])
  @@map("agws_channels")
}

// ──────────────────────────────────────────────────────────────
// CONVERSATIONS (threads in channels, or DMs)
// ──────────────────────────────────────────────────────────────

model AgwsConversation {
  id           String           @id @default(cuid())
  type         ConversationType // CHANNEL_THREAD | DIRECT_MESSAGE
  agentId      String?
  subAgentId   String?
  channelId    String?
  dmUserId     String?          // for DM: the human user
  title        String?
  isArchived   Boolean  @default(false)
  lastMessageAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  agent    AgwsAgent?    @relation(fields: [agentId], references: [id])
  subAgent AgwsSubAgent? @relation(fields: [subAgentId], references: [id])
  channel  AgwsChannel?  @relation(fields: [channelId], references: [id])
  dmUser   AgwsUser?     @relation("DmUser", fields: [dmUserId], references: [id])
  messages AgwsMessage[]

  @@map("agws_conversations")
}

enum ConversationType {
  CHANNEL_THREAD
  DIRECT_MESSAGE
}

// ──────────────────────────────────────────────────────────────
// MESSAGES
// ──────────────────────────────────────────────────────────────

model AgwsMessage {
  id              String      @id @default(cuid())
  conversationId  String
  authorId        String?     // null = agent message
  authorType      AuthorType
  agentId         String?     // which agent sent it (if agent)
  content         String      // markdown
  contentType     ContentType @default(TEXT)
  isStreaming     Boolean     @default(false)
  editedAt        DateTime?
  deletedAt       DateTime?
  metadata        Json?       // agent thinking trace, tool calls, etc.
  parentMessageId String?     // for thread replies
  createdAt       DateTime    @default(now())

  conversation AgwsConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  author       AgwsUser?        @relation(fields: [authorId], references: [id])
  attachments  AgwsAttachment[]
  reactions    AgwsReaction[]

  @@map("agws_messages")
}

enum AuthorType {
  USER
  AGENT
  SYSTEM
}

enum ContentType {
  TEXT
  MARKDOWN
  SYSTEM_EVENT
}

// ──────────────────────────────────────────────────────────────
// ATTACHMENTS
// ──────────────────────────────────────────────────────────────

model AgwsAttachment {
  id           String   @id @default(cuid())
  messageId    String
  fileName     String
  fileSize     Int
  mimeType     String
  blobUrl      String   // Azure Blob Storage URL
  sasUrl       String?  // temporary SAS URL (refreshed on request)
  uploadedAt   DateTime @default(now())

  message AgwsMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@map("agws_attachments")
}

// ──────────────────────────────────────────────────────────────
// REACTIONS
// ──────────────────────────────────────────────────────────────

model AgwsReaction {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  message AgwsMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, emoji])
  @@map("agws_reactions")
}

// ──────────────────────────────────────────────────────────────
// AUDIT LOG
// ──────────────────────────────────────────────────────────────

model AgwsAuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String   // e.g. "message.sent", "access.granted", "agent.updated"
  resourceId String?
  resourceType String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  user AgwsUser? @relation(fields: [userId], references: [id])

  @@map("agws_audit_logs")
}
```

---

## 7. API & BACKEND DESIGN

### 7.1 Route Structure

```
/api/
├── auth/
│   └── [...nextauth]/route.ts     # Auth.js Entra ID
│
├── agents/
│   ├── route.ts                   # GET: list accessible agents
│   └── [agentId]/
│       ├── route.ts               # GET: agent detail
│       ├── channels/
│       │   ├── route.ts           # GET: list channels for agent
│       │   └── [channelId]/
│       │       ├── route.ts       # GET: channel detail
│       │       └── messages/
│       │           └── route.ts   # GET: messages, POST: new message
│       └── sub-agents/
│           └── route.ts           # GET: sub-agents
│
├── conversations/
│   ├── route.ts                   # GET: user's DMs, POST: start DM
│   └── [conversationId]/
│       ├── route.ts               # GET: conversation detail
│       └── messages/
│           └── route.ts           # GET/POST messages
│
├── messages/
│   └── [messageId]/
│       ├── route.ts               # PATCH: edit, DELETE: delete
│       └── reactions/
│           └── route.ts           # POST: add, DELETE: remove reaction
│
├── files/
│   └── upload/route.ts            # POST: get SAS upload URL
│
├── users/
│   └── me/route.ts                # GET: current user + groups
│
└── admin/
    ├── agents/route.ts            # GET/POST agents
    ├── agents/[id]/route.ts       # PATCH/DELETE agent
    ├── access/route.ts            # GET/POST access policies
    ├── access/[id]/route.ts       # PATCH/DELETE policy
    └── audit/route.ts             # GET audit logs
```

### 7.2 Streaming (SSE)

```
POST /api/conversations/[id]/messages
  Body: { content, attachments }
  Response: text/event-stream
  
Events:
  data: {"type":"message_start","messageId":"..."}
  data: {"type":"content_delta","delta":"Hello, I "}
  data: {"type":"content_delta","delta":"can help with that."}
  data: {"type":"thinking","state":"searching","detail":"Looking at campaigns..."}
  data: {"type":"message_end","messageId":"...","usage":{...}}
  data: {"type":"error","code":"...","message":"..."}
```

### 7.3 Real-time Events (Pusher)

```
Channel naming:
  agent-{agentId}          # All users with agent access
  channel-{channelId}      # Channel activity
  conversation-{convId}    # Thread/DM activity
  user-{userId}            # User-specific notifications

Events:
  message.new              # New message in channel/thread
  message.updated          # Edit or reaction
  agent.status_changed     # Online/offline/thinking
  channel.unread           # Unread count update
```

---

## 8. OPENCLAW ADAPTER DESIGN

### 8.1 Adapter Interface

```typescript
// src/lib/adapters/types.ts

export interface AgentAdapter {
  /** Send a message and get a streaming response */
  sendMessage(params: SendMessageParams): Promise<ReadableStream<StreamChunk>>

  /** Get static agent metadata */
  getAgentMetadata(agentId: string): Promise<AgentMetadata>

  /** Get agent capabilities */
  getCapabilities(agentId: string): Promise<Capability[]>

  /** Run a background task (fire and forget with callback) */
  runTask(params: TaskParams): Promise<TaskResult>

  /** Check agent thinking/status state */
  getThinkingState(agentId: string): Promise<ThinkingState>

  /** Health check */
  ping(): Promise<boolean>
}

export interface SendMessageParams {
  agentId: string
  conversationId: string
  userContext: UserContext
  message: string
  attachments?: AttachmentRef[]
  threadId?: string
  channelId?: string
  history?: MessageContext[]
}

export interface UserContext {
  userId: string
  displayName: string
  email: string
  groups: string[]
}

export type StreamChunk =
  | { type: 'content_delta'; delta: string }
  | { type: 'thinking'; state: string; detail?: string }
  | { type: 'message_end'; usage?: Record<string, number> }
  | { type: 'error'; code: string; message: string }
```

### 8.2 OpenClaw Implementation

```typescript
// src/lib/adapters/openclaw-adapter.ts

export class OpenClawAdapter implements AgentAdapter {
  private gatewayUrl: string
  private authToken: string

  constructor(config: OpenClawAdapterConfig) {
    this.gatewayUrl = config.gatewayUrl        // e.g. https://friday.collectivedg.com
    this.authToken = config.authToken
  }

  async sendMessage(params: SendMessageParams): Promise<ReadableStream<StreamChunk>> {
    const res = await fetch(`${this.gatewayUrl}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message: params.message,
        conversation_id: params.conversationId,
        user: params.userContext,
        attachments: params.attachments,
        channel_id: params.channelId,
        thread_id: params.threadId,
      }),
    })

    if (!res.ok) throw new AdapterError(res.status, await res.text())
    return this.transformSSEStream(res.body!)
  }

  // ... transformSSEStream maps OpenClaw SSE events → StreamChunk format
}
```

### 8.3 Adapter Registry

```typescript
// src/lib/adapters/registry.ts
// Lazy-loads adapter per agent from DB config

const adapterCache = new Map<string, AgentAdapter>()

export async function getAdapterForAgent(agentId: string): Promise<AgentAdapter> {
  if (adapterCache.has(agentId)) return adapterCache.get(agentId)!

  const agent = await prisma.agwsAgent.findUnique({ where: { id: agentId } })
  if (!agent) throw new Error('Agent not found')

  const adapter = createAdapter(agent.adapterType, agent.adapterConfig)
  adapterCache.set(agentId, adapter)
  return adapter
}
```

---

## 9. MVP PHASES

### Phase 0: Foundation (Week 1)
- [ ] Next.js 14 project scaffold with TypeScript
- [ ] Tailwind + shadcn/ui setup
- [ ] Prisma schema + Azure PG connection
- [ ] Auth.js v5 + Entra ID (Microsoft provider)
- [ ] Entra group sync at login
- [ ] Basic layout shell (sidebar, main area)
- [ ] Docker + docker-compose for local dev
- [ ] Environment variable structure + README

### Phase 1: Agent Registry (Week 1-2)
- [ ] Seed data: Friday agent + SEO/Content/Social sub-agents
- [ ] Agent list API + access filtering
- [ ] Agent module header component
- [ ] Sub-agent sidebar listing
- [ ] Agent status (static for now)

### Phase 2: Channels + Basic Chat (Week 2-3)
- [ ] Default channels per agent (seeded)
- [ ] Channel list in sidebar
- [ ] Message list (paginated, infinite scroll up)
- [ ] Message composer (text, Enter to send)
- [ ] Message persistence in DB
- [ ] System messages (joined channel, etc.)
- [ ] Message timestamps, author avatars

### Phase 3: OpenClaw Integration (Week 3)
- [ ] Adapter interface implementation
- [ ] OpenClaw HTTP adapter (Friday gateway)
- [ ] SSE streaming to browser
- [ ] Agent thinking indicator (animated)
- [ ] Streamed message rendering
- [ ] Agent response persistence after stream

### Phase 4: Threads + DMs (Week 4)
- [ ] Thread creation from any message
- [ ] Thread detail right panel
- [ ] DM creation (user → agent)
- [ ] DM conversation persistence
- [ ] Recent threads in sidebar

### Phase 5: Real-time (Week 4)
- [ ] Pusher integration (or Ably)
- [ ] Live new messages in channels
- [ ] Unread badges + bold channel names
- [ ] Agent typing/thinking live state
- [ ] Unread separator line

### Phase 6: File Upload (Week 5)
- [ ] Azure Blob Storage integration
- [ ] SAS URL generation
- [ ] Drag-drop upload zone in composer
- [ ] File picker button
- [ ] Attachment preview in messages
- [ ] File forwarded to agent adapter

### Phase 7: Admin (Week 5-6)
- [ ] Admin layout (PLATFORM_ADMIN only)
- [ ] Agent registry CRUD
- [ ] Access policy editor (group → agent)
- [ ] User override grants/revokes
- [ ] Audit log viewer

### Phase 8: Polish (Week 6)
- [ ] Emoji reactions
- [ ] Command palette (⌘K)
- [ ] Keyboard shortcuts
- [ ] Empty states (illustrated)
- [ ] Mobile responsive pass
- [ ] Error boundaries + toast notifications
- [ ] Loading skeletons everywhere
- [ ] Message edit + delete
- [ ] Agent status from OpenClaw ping

---

## 10. TECH STACK SUMMARY

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js | 14.x (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Components | shadcn/ui | latest |
| Icons | Lucide React | latest |
| Animation | Framer Motion | 11.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 15 |
| Auth | Auth.js v5 | 5.x |
| Real-time | Pusher | 8.x |
| HTTP Client | native fetch (server), React Query (client) | |
| File Storage | Azure Blob Storage SDK | 12.x |
| Deployment | Docker + Azure Container Apps | |
| Dev DB | Docker PostgreSQL | |

---

## 11. PROJECT STRUCTURE

```
agent-workspace/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (workspace)/
│   │   ├── layout.tsx            # Shell with sidebar
│   │   ├── page.tsx              # Home
│   │   ├── agents/
│   │   │   └── [agentId]/
│   │   │       ├── page.tsx
│   │   │       └── channels/
│   │   │           └── [channelId]/
│   │   │               └── page.tsx
│   │   ├── dm/
│   │   │   └── [agentId]/page.tsx
│   │   └── admin/
│   │       └── ...
│   └── api/
│       └── ...
│
├── components/
│   ├── ui/                       # shadcn base components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── AgentSection.tsx
│   │   └── RightPanel.tsx
│   ├── agents/
│   │   ├── AgentHeader.tsx       # The branded module header
│   │   ├── AgentStatusBadge.tsx
│   │   └── AgentCapabilityChips.tsx
│   ├── chat/
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── MessageComposer.tsx
│   │   ├── ThinkingIndicator.tsx  # Animated orb
│   │   ├── StreamingMessage.tsx
│   │   ├── FileUploadZone.tsx
│   │   └── ReactionPicker.tsx
│   └── admin/
│       └── ...
│
├── lib/
│   ├── auth.ts                   # Auth.js config
│   ├── prisma.ts                 # Prisma client singleton
│   ├── adapters/
│   │   ├── types.ts              # AgentAdapter interface
│   │   ├── openclaw-adapter.ts
│   │   ├── registry.ts
│   │   └── mock-adapter.ts       # Dev/test
│   ├── access.ts                 # Access control helpers
│   ├── entra.ts                  # Graph API helpers
│   └── azure-storage.ts          # Blob storage helpers
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   # Friday + sub-agents seed data
│
├── types/
│   └── index.ts
│
├── middleware.ts                  # Auth middleware (protect all routes)
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

*This spec is the single source of truth for the AI Agent Workspace. Implementation follows Phases 0–8 in sequence.*
