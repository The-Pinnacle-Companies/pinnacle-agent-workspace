/**
 * Adapter factory — resolves which AgentAdapter to use for a given agent.
 */

import type { AgentAdapter } from './types'
import { OpenClawAdapter } from './openclaw-adapter'
import { MockAdapter } from './mock-adapter'
import type { AgwsAgent } from '@prisma/client'

/**
 * Create an adapter for the given agent.
 * Priority:
 *  1. If ADAPTER_MODE=mock → always MockAdapter (local dev)
 *  2. If agent.adapterType === "openclaw" → OpenClawAdapter using agent config
 *  3. Fallback → MockAdapter
 */
export function getAdapter(agent: AgwsAgent): AgentAdapter {
  if (process.env.ADAPTER_MODE === 'mock') {
    return new MockAdapter()
  }

  if (agent.adapterType === 'openclaw') {
    const config = (agent.adapterConfig ?? {}) as Record<string, string>
    const gatewayUrl =
      config.gatewayUrl ??
      agent.openclawGateway ??
      process.env.OPENCLAW_FRIDAY_GATEWAY_URL ??
      ''
    const authToken =
      config.authToken ?? process.env[`OPENCLAW_${agent.slug.toUpperCase()}_AUTH_TOKEN`] ?? ''

    if (!gatewayUrl || !authToken) {
      console.warn(
        `[adapter-factory] Agent "${agent.slug}" is missing gateway config — falling back to mock`
      )
      return new MockAdapter()
    }

    return new OpenClawAdapter({
      gatewayUrl,
      authToken,
      agentId: agent.openclawAgentId ?? undefined,
      timeoutMs: config.timeoutMs ? parseInt(config.timeoutMs, 10) : 45000,
    })
  }

  // Fallback
  return new MockAdapter()
}
