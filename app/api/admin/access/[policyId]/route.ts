import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: { policyId: string }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { policyId } = params

    // Verify it exists
    const policy = await prisma.agwsAccessPolicy.findUnique({
      where: { id: policyId },
      select: { id: true, agentId: true, groupId: true },
    })

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
    }

    await prisma.agwsAccessPolicy.delete({ where: { id: policyId } })

    await prisma.agwsAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'access_policy.deleted',
        resourceId: policyId,
        resourceType: 'AgwsAccessPolicy',
        metadata: { agentId: policy.agentId, groupId: policy.groupId },
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/access/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
