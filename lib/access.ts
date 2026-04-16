import { prisma } from '@/lib/prisma'
import type { AgwsChannel, AgwsAgent, AgwsSubAgent, AgentAccessRole } from '@prisma/client'

// ─── Error ──────────────────────────────────────────────────────────────────

export class AccessDeniedError extends Error {
  statusCode = 403
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentWithAccess extends AgwsAgent {
  channels: AgwsChannel[]
  subAgents: AgwsSubAgent[]
  userRole: AgentAccessRole | 'PLATFORM_ADMIN' | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check whether the given user is a PLATFORM_ADMIN.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.agwsUser.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'PLATFORM_ADMIN'
}

/**
 * Get the user's explicit role for a specific agent (via access policy tied to
 * their Entra groups). Does NOT consider PLATFORM_ADMIN — use canAccessAgent for
 * that full check.
 */
export async function getUserAgentRole(
  userId: string,
  agentId: string
): Promise<AgentAccessRole | null> {
  // Get the user's group IDs
  const userGroups = await prisma.agwsUserGroup.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((ug) => ug.groupId)

  if (groupIds.length === 0) return null

  // Find the most privileged role from any matching policy
  const policies = await prisma.agwsAccessPolicy.findMany({
    where: {
      agentId,
      groupId: { in: groupIds },
    },
    select: { role: true },
  })

  if (policies.length === 0) return null

  // AGENT_ADMIN > MEMBER
  const isAdmin = policies.some((p) => p.role === 'AGENT_ADMIN')
  return isAdmin ? 'AGENT_ADMIN' : 'MEMBER'
}

/**
 * Can this user access the given agent?
 *
 * Priority order:
 * 1. PLATFORM_ADMIN → always yes
 * 2. Explicit GRANT override (not expired) → yes
 * 3. Explicit REVOKE override → no
 * 4. Group-based access policy → yes if any group matches
 * 5. Default → no
 */
export async function canAccessAgent(userId: string, agentId: string): Promise<boolean> {
  // 1. PLATFORM_ADMIN always has access
  const admin = await isPlatformAdmin(userId)
  if (admin) return true

  // 2 & 3. Check explicit overrides
  const override = await prisma.agwsUserAgentOverride.findUnique({
    where: { userId_agentId: { userId, agentId } },
    select: { access: true, expiresAt: true },
  })

  if (override) {
    const expired = override.expiresAt && override.expiresAt < new Date()

    if (override.access === 'GRANT' && !expired) {
      return true
    }

    if (override.access === 'REVOKE') {
      return false
    }
    // Expired GRANT falls through to group check
  }

  // 4. Group-based access policy
  const userGroups = await prisma.agwsUserGroup.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((ug) => ug.groupId)

  if (groupIds.length === 0) return false

  const matchingPolicy = await prisma.agwsAccessPolicy.findFirst({
    where: {
      agentId,
      groupId: { in: groupIds },
    },
    select: { id: true },
  })

  return matchingPolicy !== null
}

/**
 * Assert agent access or throw 403.
 */
export async function assertAgentAccess(userId: string, agentId: string): Promise<void> {
  const allowed = await canAccessAgent(userId, agentId)
  if (!allowed) {
    throw new AccessDeniedError(`User ${userId} does not have access to agent ${agentId}`)
  }
}

/**
 * Get all agents the user can access, with their channels and sub-agents.
 */
export async function getUserAgents(userId: string): Promise<AgentWithAccess[]> {
  const isAdmin = await isPlatformAdmin(userId)

  // Get all active agents with their channels and sub-agents
  const allAgents = await prisma.agwsAgent.findMany({
    where: { status: 'ACTIVE' },
    include: {
      channels: {
        where: { isArchived: false },
        orderBy: { sortOrder: 'asc' },
      },
      subAgents: {
        where: { status: 'ACTIVE' },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  if (isAdmin) {
    return allAgents.map((agent) => ({
      ...agent,
      userRole: 'PLATFORM_ADMIN' as const,
    }))
  }

  // For non-admins, filter by access
  const userGroups = await prisma.agwsUserGroup.findMany({
    where: { userId },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((ug) => ug.groupId)

  // Get all explicit overrides for this user
  const overrides = await prisma.agwsUserAgentOverride.findMany({
    where: { userId },
    select: { agentId: true, access: true, expiresAt: true },
  })

  const overrideMap = new Map(overrides.map((o) => [o.agentId, o]))

  // Get group-based policies
  const policies = await prisma.agwsAccessPolicy.findMany({
    where: groupIds.length > 0 ? { groupId: { in: groupIds } } : { id: 'never' },
    select: { agentId: true, role: true },
  })

  const policyMap = new Map<string, AgentAccessRole>()
  for (const policy of policies) {
    const existing = policyMap.get(policy.agentId)
    if (!existing || policy.role === 'AGENT_ADMIN') {
      policyMap.set(policy.agentId, policy.role)
    }
  }

  const accessible: AgentWithAccess[] = []

  for (const agent of allAgents) {
    const override = overrideMap.get(agent.id)
    let allowed = false
    let userRole: AgentAccessRole | null = null

    if (override) {
      const expired = override.expiresAt && override.expiresAt < new Date()
      if (override.access === 'REVOKE') continue
      if (override.access === 'GRANT' && !expired) {
        allowed = true
        userRole = policyMap.get(agent.id) ?? 'MEMBER'
      }
    }

    if (!allowed && policyMap.has(agent.id)) {
      allowed = true
      userRole = policyMap.get(agent.id)!
    }

    if (allowed) {
      accessible.push({ ...agent, userRole })
    }
  }

  return accessible
}

/**
 * Get channels for an agent — only if user has access.
 */
export async function getAgentChannels(
  userId: string,
  agentId: string
): Promise<AgwsChannel[]> {
  await assertAgentAccess(userId, agentId)

  return prisma.agwsChannel.findMany({
    where: {
      agentId,
      isArchived: false,
    },
    orderBy: { sortOrder: 'asc' },
  })
}
