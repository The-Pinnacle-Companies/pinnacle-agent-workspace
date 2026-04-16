import { auth } from '@/lib/auth'
import { assertAgentAccess, AccessDeniedError } from '@/lib/access'
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
    await assertAgentAccess(session.user.id, agentId)

    const channels = await prisma.agwsChannel.findMany({
      where: { agentId, isArchived: false },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(channels)
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[GET /api/agents/[agentId]/channels]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
