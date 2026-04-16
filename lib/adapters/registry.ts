import { prisma } from '@/lib/prisma'
import { OpenClawAdapter } from './openclaw-adapter'
import { MockAdapter } from './mock-adapter'
import type { AgentAdapter } from './types'

// ─── Cache ────────────────────────────────────────────────────────────────────

// Module-level cache — survives across requests in the same Node.js process
const adapterCache = new Map<string, AgentAdapter>()

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Load (or return cached) adapter for the given agent.
 * Reads adapterType and adapterConfig from the DB.
 */
export async function getAdapterForAgent(agentId: string): Promise<AgentAdapter> {
  if (adapterCache.has(agentId)) {
    return adapterCache.get(agentId)!
  }

  const agent = await prisma.agwsAgent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      slug: true,
      adapterType: true,
      adapterConfig: true,
      openclawGateway: true,
    },
  })

  if (!agent) {
    throw new Error(`[adapter-registry] Agent not found: ${agentId}`)
  }

  const adapter = createAdapter(agent.adapterType, agent.adapterConfig, agent.openclawGateway)
  adapterCache.set(agentId, adapter)
  return adapter
}

/**
 * Like getAdapterForAgent but looks up by slug instead of ID.
 */
export async function getAdapterForAgentSlug(slug: string): Promise<AgentAdapter> {
  const agent = await prisma.agwsAgent.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!agent) {
    throw new Error(`[adapter-registry] Agent not found by slug: ${slug}`)
  }

  return getAdapterForAgent(agent.id)
}

/**
 * Evict a specific agent's adapter from the cache (e.g. after config update).
 */
export function evictAdapter(agentId: string): void {
  adapterCache.delete(agentId)
}

/**
 * Clear the entire adapter cache (e.g. for testing).
 */
export function clearAdapterCache(): void {
  adapterCache.clear()
}

// ─── Internal Factory ─────────────────────────────────────────────────────────

function createAdapter(
  adapterType: string,
  adapterConfig: unknown,
  openclawGateway?: string | null
): AgentAdapter {
  const config = (adapterConfig ?? {}) as Record<string, unknown>

  switch (adapterType) {
    case 'openclaw': {
      const gatewayUrl =
        (typeof config.gatewayUrl === 'string' ? config.gatewayUrl : null) ??
        openclawGateway ??
        process.env.OPENCLAW_GATEWAY_URL

      const authToken =
        (typeof config.authToken === 'string' ? config.authToken : null) ??
        process.env.OPENCLAW_AUTH_TOKEN

      if (!gatewayUrl) {
        throw new Error(
          '[adapter-registry] OpenClaw adapter requires gatewayUrl in adapterConfig, ' +
            'openclawGateway field, or OPENCLAW_GATEWAY_URL env var'
        )
      }

      if (!authToken) {
        throw new Error(
          '[adapter-registry] OpenClaw adapter requires authToken in adapterConfig ' +
            'or OPENCLAW_AUTH_TOKEN env var'
        )
      }

      return new OpenClawAdapter({
        gatewayUrl,
        authToken,
        timeoutMs: typeof config.timeoutMs === 'number' ? config.timeoutMs : 30_000,
      })
    }

    case 'mock': {
      return new MockAdapter({
        delayMs: typeof config.delayMs === 'number' ? config.delayMs : 75,
      })
    }

    default:
      throw new Error(
        `[adapter-registry] Unknown adapter type: "${adapterType}". ` +
          `Supported types: "openclaw", "mock"`
      )
  }
}
