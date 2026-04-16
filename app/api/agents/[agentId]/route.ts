import { auth } from '@/lib/auth'
import { assertAgentAccess, isPlatformAdmin } from '@/lib/access'
import { AccessDeniedError } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: { agentId: string }
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentId } = params
    const userId = session.user.id

    await assertAgentAccess(userId, agentId)

    const isAdmin = await isPlatformAdmin(userId)

    const agent = await prisma.agwsAgent.findUnique({
      where: { id: agentId },
      include: {
        channels: {
          where: { isArchived: false },
          orderBy: { sortOrder: 'asc' },
        },
        subAgents: {
          where: { status: 'ACTIVE' },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { accessPolicies: true },
        },
        // Only include full policy details for admins
        ...(isAdmin && {
          accessPolicies: {
            include: { group: true },
          },
        }),
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[GET /api/agents/[agentId]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
