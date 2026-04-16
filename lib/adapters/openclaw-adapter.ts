import type {
  AgentAdapter,
  SendMessageParams,
  AgentMetadata,
  Capability,
  TaskParams,
  TaskResult,
  ThinkingState,
  StreamChunk,
  OpenClawAdapterConfig,
} from './types'
import { AdapterError, AdapterTimeoutError } from './types'

// ─────────────────────────────────────────────────────────────────────────────

export class OpenClawAdapter implements AgentAdapter {
  private gatewayUrl: string
  private authToken: string
  private timeoutMs: number

  constructor(config: OpenClawAdapterConfig) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/$/, '') // strip trailing slash
    this.authToken = config.authToken
    this.timeoutMs = config.timeoutMs ?? 30_000
  }

  // ─── sendMessage ────────────────────────────────────────────────────────────

  async sendMessage(params: SendMessageParams): Promise<ReadableStream<StreamChunk>> {
    const url = `${this.gatewayUrl}/api/v1/messages`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    let res: Response

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: params.message,
          conversation_id: params.conversationId,
          agent_id: params.agentId,
          user: params.userContext,
          attachments: params.attachments ?? [],
          channel_id: params.channelId ?? null,
          thread_id: params.threadId ?? null,
          history: params.history ?? [],
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if ((err as Error).name === 'AbortError') {
        throw new AdapterTimeoutError(url)
      }
      throw new Error(`[openclaw-adapter] Connection error: ${(err as Error).message}`)
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)')
      if (res.status === 401 || res.status === 403) {
        throw new AdapterError(res.status, `Auth failure: ${body}`)
      }
      throw new AdapterError(res.status, body)
    }

    const contentType = res.headers.get('content-type') ?? ''

    // If the gateway returns SSE, transform the stream
    if (contentType.includes('text/event-stream')) {
      return this.transformSSEStream(res.body!)
    }

    // If gateway returns regular JSON (non-streaming fallback), wrap it
    const json = await res.json()
    return this.syntheticStreamFromJSON(json)
  }

  // ─── SSE Transform ──────────────────────────────────────────────────────────

  /**
   * Transform OpenClaw's raw SSE ReadableStream<Uint8Array> into ReadableStream<StreamChunk>.
   *
   * OpenClaw SSE format:
   *   data: {"type":"content_delta","delta":"Hello"}
   *   data: {"type":"thinking","state":"searching","detail":"..."}
   *   data: {"type":"message_end","usage":{...}}
   *   data: {"type":"error","code":"...","message":"..."}
   *   data: [DONE]
   */
  private transformSSEStream(body: ReadableStream<Uint8Array>): ReadableStream<StreamChunk> {
    const decoder = new TextDecoder()
    let buffer = ''

    const reader = body.getReader()

    return new ReadableStream<StreamChunk>({
      async pull(controller) {
        while (true) {
          let done: boolean
          let value: Uint8Array | undefined

          try {
            ;({ done, value } = await reader.read())
          } catch (err) {
            controller.error(err)
            return
          }

          if (done) {
            // Flush any remaining buffer
            if (buffer.trim()) {
              const chunk = parseSSEBuffer(buffer)
              if (chunk) controller.enqueue(chunk)
            }
            controller.close()
            return
          }

          buffer += decoder.decode(value, { stream: true })

          // SSE events are separated by double newline
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? '' // last (possibly incomplete) chunk stays in buffer

          for (const event of events) {
            const chunk = parseSSEBuffer(event)
            if (chunk) {
              controller.enqueue(chunk)
              if (chunk.type === 'message_end' || chunk.type === 'error') {
                controller.close()
                return
              }
            }
          }
        }
      },

      cancel() {
        reader.cancel()
      },
    })
  }

  // ─── Synthetic stream from JSON ──────────────────────────────────────────────

  private syntheticStreamFromJSON(json: unknown): ReadableStream<StreamChunk> {
    return new ReadableStream<StreamChunk>({
      start(controller) {
        try {
          let content = ''

          if (typeof json === 'string') {
            content = json
          } else if (json && typeof json === 'object') {
            const obj = json as Record<string, unknown>
            content =
              (typeof obj.content === 'string' ? obj.content : '') ||
              (typeof obj.message === 'string' ? obj.message : '') ||
              (typeof obj.text === 'string' ? obj.text : '') ||
              JSON.stringify(json)
          } else {
            content = String(json)
          }

          // Emit thinking first
          controller.enqueue({ type: 'thinking', state: 'processing' })

          // Emit full content as a single delta
          controller.enqueue({ type: 'content_delta', delta: content })

          // Emit end
          controller.enqueue({ type: 'message_end', usage: {} })
        } finally {
          controller.close()
        }
      },
    })
  }

  // ─── getAgentMetadata ────────────────────────────────────────────────────────

  async getAgentMetadata(agentId: string): Promise<AgentMetadata> {
    const url = `${this.gatewayUrl}/api/v1/agents/${agentId}`
    const res = await this.get(url)

    if (!res.ok) {
      throw new AdapterError(res.status, await res.text().catch(() => ''))
    }

    const json = await res.json()
    return {
      agentId,
      name: json.name ?? agentId,
      description: json.description,
      version: json.version,
      capabilities: (json.capabilities ?? []).map((c: string | Record<string, string>) =>
        typeof c === 'string' ? { id: c, name: c } : { id: c.id ?? c.name, name: c.name }
      ),
    }
  }

  // ─── getCapabilities ─────────────────────────────────────────────────────────

  async getCapabilities(agentId: string): Promise<Capability[]> {
    const meta = await this.getAgentMetadata(agentId)
    return meta.capabilities
  }

  // ─── runTask ─────────────────────────────────────────────────────────────────

  async runTask(params: TaskParams): Promise<TaskResult> {
    const url = `${this.gatewayUrl}/api/v1/tasks`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: params.agentId,
          task_type: params.taskType,
          payload: params.payload,
          user: params.userContext,
          callback_url: params.callbackUrl ?? null,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new AdapterError(res.status, await res.text().catch(() => ''))
      }

      const json = await res.json()
      return {
        taskId: json.task_id ?? json.taskId ?? 'unknown',
        status: json.status ?? 'queued',
        message: json.message,
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if ((err as Error).name === 'AbortError') throw new AdapterTimeoutError(url)
      throw err
    }
  }

  // ─── getThinkingState ────────────────────────────────────────────────────────

  async getThinkingState(_agentId: string): Promise<ThinkingState> {
    const url = `${this.gatewayUrl}/api/v1/status`

    try {
      const res = await this.get(url)

      if (!res.ok) return { state: 'idle' }

      const json = await res.json()
      const state = json.state ?? json.status ?? 'idle'

      switch (state) {
        case 'thinking':
          return { state: 'thinking', detail: json.detail }
        case 'running_task':
          return { state: 'running_task', taskId: json.task_id, detail: json.detail }
        case 'error':
          return { state: 'error', detail: json.detail ?? 'Unknown error' }
        default:
          return { state: 'idle' }
      }
    } catch {
      return { state: 'idle' }
    }
  }

  // ─── ping ────────────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    const url = `${this.gatewayUrl}/api/v1/health`

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.authToken}` },
        signal: AbortSignal.timeout(5_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ─── Shared GET helper ───────────────────────────────────────────────────────

  private get(url: string): Promise<Response> {
    return fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    })
  }
}

// ─── SSE Parsing ─────────────────────────────────────────────────────────────

function parseSSEBuffer(raw: string): StreamChunk | null {
  const lines = raw.split('\n')

  for (const line of lines) {
    if (!line.startsWith('data:')) continue

    const data = line.slice(5).trim()

    if (data === '[DONE]') return null

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>

      switch (parsed.type) {
        case 'content_delta':
          return { type: 'content_delta', delta: String(parsed.delta ?? '') }

        case 'thinking':
          return {
            type: 'thinking',
            state: String(parsed.state ?? 'thinking'),
            detail: parsed.detail ? String(parsed.detail) : undefined,
          }

        case 'message_end':
          return {
            type: 'message_end',
            usage:
              parsed.usage && typeof parsed.usage === 'object'
                ? (parsed.usage as Record<string, number>)
                : undefined,
          }

        case 'error':
          return {
            type: 'error',
            code: String(parsed.code ?? 'unknown'),
            message: String(parsed.message ?? 'Unknown error'),
          }

        default:
          // Unknown event type — skip
          return null
      }
    } catch {
      // Malformed JSON — skip
      return null
    }
  }

  return null
}
