// ─── Adapter Interface ────────────────────────────────────────────────────────

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

// ─── Message / Stream ─────────────────────────────────────────────────────────

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

export interface AttachmentRef {
  fileName: string
  mimeType: string
  blobUrl: string
  sasUrl?: string
}

export interface MessageContext {
  role: 'user' | 'assistant' | 'system'
  content: string
  authorName?: string
  createdAt?: string
}

export type StreamChunk =
  | { type: 'content_delta'; delta: string }
  | { type: 'thinking'; state: string; detail?: string }
  | { type: 'message_end'; usage?: Record<string, number> }
  | { type: 'error'; code: string; message: string }

// ─── Agent Metadata ───────────────────────────────────────────────────────────

export interface AgentMetadata {
  agentId: string
  name: string
  description?: string
  version?: string
  capabilities: Capability[]
}

export interface Capability {
  id: string
  name: string
  description?: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskParams {
  agentId: string
  taskType: string
  payload: Record<string, unknown>
  userContext: UserContext
  callbackUrl?: string
}

export interface TaskResult {
  taskId: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  message?: string
}

// ─── Thinking / Status ───────────────────────────────────────────────────────

export type ThinkingState =
  | { state: 'idle' }
  | { state: 'thinking'; detail?: string }
  | { state: 'running_task'; taskId?: string; detail?: string }
  | { state: 'error'; detail?: string }

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AdapterError extends Error {
  statusCode: number
  body: string

  constructor(statusCode: number, body: string) {
    super(`[adapter] HTTP ${statusCode}: ${body}`)
    this.name = 'AdapterError'
    this.statusCode = statusCode
    this.body = body
  }
}

export class AdapterTimeoutError extends Error {
  constructor(url: string) {
    super(`[adapter] Request timed out: ${url}`)
    this.name = 'AdapterTimeoutError'
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OpenClawAdapterConfig {
  gatewayUrl: string   // e.g. "https://friday.collectivedg.com"
  authToken: string
  timeoutMs?: number   // default 30000
}

export interface MockAdapterConfig {
  delayMs?: number     // ms between words (default 75)
}
