# AI Agent Workspace

A premium internal web application that gives Pinnacle Companies team members a world-class chat experience for collaborating with branded AI agents — replacing the clunky Microsoft Teams bot interface with something closer to Slack or Discord in quality and feel.

**In one sentence:** A Slack-quality internal portal where authenticated Pinnacle employees interact with branded AI agents (like Friday) and their specialist sub-agents through shared channels, threads, and private chats — with enterprise-grade access control via Microsoft Entra ID.

---

## Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- **Docker + Docker Compose** (for local PostgreSQL)
- **Microsoft Azure account** with an Entra ID (Azure AD) app registration
- **pnpm**, **npm**, or **yarn** for package management
- *(Production only)* Azure Database for PostgreSQL, Azure Blob Storage, Pusher account

---

## Quick Start (Local Dev)

### 1. Clone and install

```bash
git clone https://github.com/thepinnaclecompanies/agent-workspace.git
cd agent-workspace
npm install
```

### 2. Environment setup

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in the required values. See the [Environment Variables](#environment-variables) section below for a full reference.

### 3. Microsoft Entra ID setup

You need an Azure AD App Registration for SSO:

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. **Name:** `Pinnacle AI Workspace` (or similar)
3. **Supported account types:** Accounts in this organizational directory only (single tenant)
4. **Redirect URIs:** Add the following:
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id` *(for local dev)*
   - `https://your-production-domain.com/api/auth/callback/microsoft-entra-id` *(for prod)*
5. Click **Register**
6. Copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`
7. Copy the **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
8. Go to **Certificates & secrets** → **New client secret** → Copy the value → `AZURE_AD_CLIENT_SECRET`
9. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**:
   - `User.Read` *(required for profile)*
   - `GroupMember.Read.All` *(required for Entra group sync)*
10. Click **Grant admin consent for [your org]**

> **Important:** Without `GroupMember.Read.All`, the app can't determine which agents a user can access. Grant consent before testing.

### 4. Start database

```bash
docker-compose up -d db
```

This starts a PostgreSQL instance on `localhost:5432` using the credentials in `docker-compose.yml`. The `DATABASE_URL` in `.env.example` is pre-configured for this.

### 5. Run migrations + seed

```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed initial agents, channels, and access policies
```

The seed script creates a sample **Friday** agent with channels and sub-agents. Adjust `prisma/seed.ts` for your environment.

### 6. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Sign in with your Microsoft account. If you're in the PLATFORM_ADMIN group (configured in seed), you'll have full admin access.

---

## Project Structure

```
agent-workspace/
├── app/
│   ├── (auth)/login/        # Login page
│   ├── (workspace)/         # Main app (requires auth)
│   │   ├── layout.tsx       # Workspace layout with sidebar
│   │   ├── page.tsx         # Home / dashboard
│   │   ├── agents/[agentId]/
│   │   │   ├── page.tsx     # Agent overview
│   │   │   └── channels/[channelId]/page.tsx  # Channel chat
│   │   ├── dm/[agentId]/    # Direct message with agent
│   │   └── admin/           # Admin dashboard (PLATFORM_ADMIN only)
│   └── api/                 # API routes
│       ├── auth/[...nextauth]/route.ts
│       ├── agents/          # Agent + channel message routes
│       ├── conversations/   # DM conversation routes
│       ├── messages/        # Reactions
│       ├── files/upload/    # Azure Blob file uploads
│       ├── users/me/        # Current user profile
│       └── admin/           # Admin-only routes
├── components/
│   ├── auth/                # SignInButton
│   ├── sidebar/             # Sidebar navigation
│   ├── workspace/           # WorkspaceHeader
│   ├── agents/              # AgentHeader, AgentCard
│   ├── messages/            # MessageList, MessageComposer, ChannelView, DmView
│   ├── admin/               # AgentForm
│   └── ui/                  # Button, Input, Badge, Avatar, Dialog, Select, etc.
├── lib/
│   ├── auth.ts              # Auth.js v5 config with Entra ID
│   ├── prisma.ts            # Prisma client singleton
│   ├── access.ts            # Access control helpers
│   ├── types.ts             # Shared TypeScript types
│   ├── utils.ts             # Tailwind cn() helper
│   ├── azure-storage.ts     # Azure Blob upload/SAS URL
│   ├── entra.ts             # Microsoft Graph group sync
│   └── adapters/
│       ├── types.ts         # AgentAdapter interface + types
│       ├── factory.ts       # Adapter factory (openclaw / mock)
│       ├── openclaw-adapter.ts  # OpenClaw gateway HTTP adapter
│       └── mock-adapter.ts  # Mock adapter for local dev
├── prisma/
│   ├── schema.prisma        # Database schema (agws_* tables)
│   └── seed.ts              # Seed script
├── middleware.ts            # Next.js middleware (route protection)
├── docker-compose.yml       # Local PostgreSQL + app
└── Dockerfile               # Production Docker image
```

---

## Architecture

```
Browser → Next.js Server → OpenClaw Adapter → OpenClaw Gateway → AI Agent
                       ↓
                   PostgreSQL (Prisma)
                       ↓
                   Azure Blob Storage (files)
                       ↓
                   Microsoft Graph API (Entra groups)
                       ↓
                   Pusher (real-time events, optional)
```

**Key principles:**
- **Server-authoritative:** All access checks are server-side. Client never trusts itself.
- **Adapter isolation:** OpenClaw integration is behind an `AgentAdapter` interface. Swap backends without touching UI.
- **Schema isolation:** All tables use `agws_` prefix — zero coupling to existing schemas.
- **Streaming-first:** Messages use Server-Sent Events (SSE) for real-time streaming from agents.
- **Server Components by default:** React Server Components for pages, `'use client'` only where interactivity is needed.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Base URL of the app (e.g., `http://localhost:3000`) |
| `AZURE_AD_CLIENT_ID` | ✅ | Entra ID App Registration client ID |
| `AZURE_AD_CLIENT_SECRET` | ✅ | Entra ID client secret |
| `AZURE_AD_TENANT_ID` | ✅ | Azure tenant ID |
| `ADAPTER_MODE` | — | `mock` for dev (no OpenClaw needed), `openclaw` for prod. Default: `mock` |
| `OPENCLAW_FRIDAY_GATEWAY_URL` | — | Friday agent gateway URL |
| `OPENCLAW_FRIDAY_AUTH_TOKEN` | — | Friday agent auth token |
| `OPENCLAW_FLYNN_GATEWAY_URL` | — | Flynn agent gateway URL (optional) |
| `OPENCLAW_FLYNN_AUTH_TOKEN` | — | Flynn agent auth token (optional) |
| `PUSHER_APP_ID` | — | Pusher app ID (optional, enables real-time) |
| `PUSHER_KEY` | — | Pusher key |
| `PUSHER_SECRET` | — | Pusher secret |
| `PUSHER_CLUSTER` | — | Pusher cluster (default: `us2`) |
| `NEXT_PUBLIC_PUSHER_KEY` | — | Pusher key (client-side) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | — | Pusher cluster (client-side) |
| `AZURE_STORAGE_ACCOUNT_NAME` | — | Azure Storage account name (for file uploads) |
| `AZURE_STORAGE_ACCOUNT_KEY` | — | Azure Storage account key |
| `AZURE_STORAGE_CONTAINER_NAME` | — | Storage container name (default: `agws-attachments`) |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL |
| `PLATFORM_ADMIN_GROUP_ID` | — | Entra group whose members get PLATFORM_ADMIN role |

---

## Deployment (Azure Container Apps)

### 1. Build and push Docker image

```bash
# Login to Azure Container Registry
az acr login --name <your-acr-name>

# Build
docker build -t <acr-name>.azurecr.io/agent-workspace:latest .

# Push
docker push <acr-name>.azurecr.io/agent-workspace:latest
```

### 2. Deploy to Azure Container Apps

```bash
az containerapp create \
  --name agent-workspace \
  --resource-group pinnacle-rg \
  --environment pinnacle-env \
  --image <acr-name>.azurecr.io/agent-workspace:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --env-vars \
    DATABASE_URL=secretref:database-url \
    NEXTAUTH_SECRET=secretref:nextauth-secret \
    AZURE_AD_CLIENT_ID="<your-client-id>" \
    AZURE_AD_TENANT_ID="<your-tenant-id>" \
    AZURE_AD_CLIENT_SECRET=secretref:azure-ad-secret \
    NEXTAUTH_URL="https://agent-workspace.yourdomain.com" \
    ADAPTER_MODE=openclaw
```

> Store sensitive values as Container Apps secrets rather than plain env vars.

### 3. Add custom domain

```bash
az containerapp hostname add \
  --name agent-workspace \
  --resource-group pinnacle-rg \
  --hostname agent-workspace.yourdomain.com
```

### 4. Run migrations in production

```bash
# One-time migration job
az containerapp job create \
  --name agws-migrate \
  --resource-group pinnacle-rg \
  --environment pinnacle-env \
  --image <acr-name>.azurecr.io/agent-workspace:latest \
  --replica-timeout 300 \
  --command "npx prisma migrate deploy"
```

---

## Adding a New Agent

### Via Admin UI

1. Sign in as a PLATFORM_ADMIN
2. Navigate to **Admin → Agent Management**
3. Click **Add Agent**
4. Fill in:
   - **Name** (display name, e.g., "Friday")
   - **Slug** (URL-safe identifier, e.g., "friday")
   - **Adapter Type** (`openclaw` or `mock`)
   - **Adapter Config** (JSON with `gatewayUrl` and `authToken`)
   - **Brand Color** (hex, e.g., `#7c3aed`)
5. Click **Create Agent**
6. Go to **Admin → Access Policies** and add an access policy linking the new agent to an Entra group

### Via seed file

Edit `prisma/seed.ts` and add your agent:

```typescript
const newAgent = await prisma.agwsAgent.create({
  data: {
    slug: 'my-agent',
    name: 'My Agent',
    shortTagline: 'What this agent does',
    brandColor: '#0891b2',
    adapterType: 'openclaw',
    adapterConfig: {
      gatewayUrl: 'https://my-agent.example.com',
      authToken: 'your-token-here',
    },
    capabilities: ['chat', 'analysis'],
    channels: {
      create: [
        { slug: 'general', name: 'general', isDefault: true, sortOrder: 0 },
      ],
    },
  },
})
```

Then run `npm run db:seed`.

---

## OpenClaw Integration

The workspace connects to OpenClaw agents via the `OpenClawAdapter` in `lib/adapters/openclaw-adapter.ts`.

Each agent needs two things configured:
1. **`openclawGateway`** (or `adapterConfig.gatewayUrl`): The HTTPS URL of the OpenClaw gateway instance
2. **Auth token**: Set via `adapterConfig.authToken` or the `OPENCLAW_<SLUG>_AUTH_TOKEN` env var

The adapter sends messages to `POST /api/v1/messages` and receives a Server-Sent Events (SSE) stream with `content_delta`, `thinking`, and `message_end` events — which the workspace app proxies to the browser.

**Required OpenClaw API contract:**

```
POST /api/v1/messages
Content-Type: application/json
Authorization: Bearer <token>
Accept: text/event-stream

Body: {
  "message": "...",
  "conversation_id": "...",
  "channel_id": "...",
  "user": { "userId": "...", "displayName": "...", "email": "...", "groups": ["..."] },
  "history": [{ "role": "user|agent", "content": "...", "timestamp": "..." }]
}

Response (SSE):
data: {"type":"thinking","state":"processing","detail":"..."}
data: {"type":"content_delta","delta":"Hello "}
data: {"type":"content_delta","delta":"world!"}
data: {"type":"message_end","usage":{"prompt_tokens":50,"completion_tokens":10}}
```

---

## Development Without OpenClaw

Set `ADAPTER_MODE=mock` in your `.env.local`. The mock adapter returns canned streaming responses without any network calls.

This lets you develop and test the full streaming SSE pipeline, UI components, and database flows without needing a real OpenClaw instance running.

To switch back to real agents:
```bash
ADAPTER_MODE=openclaw
OPENCLAW_FRIDAY_GATEWAY_URL=https://friday.collectivedg.com
OPENCLAW_FRIDAY_AUTH_TOKEN=your-token-here
```

---

## Development Scripts

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking (no emit)
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema (dev only, no migration file)
npm run db:seed      # Run seed script
npm run db:studio    # Open Prisma Studio (visual DB explorer)
npm run db:generate  # Regenerate Prisma client
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Radix UI primitives |
| Auth | Auth.js v5 (NextAuth) + Microsoft Entra ID |
| Database | PostgreSQL via Prisma |
| Real-time | Pusher (optional) + Server-Sent Events |
| File Storage | Azure Blob Storage |
| AI Integration | OpenClaw Gateway (custom adapter) |
| Deployment | Docker + Azure Container Apps |
