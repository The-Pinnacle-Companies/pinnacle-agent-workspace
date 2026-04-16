import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CreatePolicySchema = z.object({
  agentId: z.string().cuid(),
  entraGroupId: z.string().uuid('Entra Group ID must be a valid UUID'),
  entraGroupName: z.string().min(1, 'Group display name is required').max(200),
  role: z.enum(['MEMBER', 'AGENT_ADMIN']).default('MEMBER'),
})

function requireAdmin(role: string) {
  return role !== 'PLATFORM_ADMIN'
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (requireAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [policies, overrides] = await Promise.all([
      prisma.agwsAccessPolicy.findMany({
        include: {
          agent: { select: { id: true, name: true, slug: true } },
          group: { select: { id: true, entraId: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agwsUserAgentOverride.findMany({
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          agent: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({ policies, overrides })
  } catch (err) {
    console.error('[GET /api/admin/access]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (requireAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rawBody = await req.json()
    const result = CreatePolicySchema.safeParse(rawBody)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 422 }
      )
    }

    const { agentId, entraGroupId, entraGroupName, role } = result.data

    // Upsert the Entra group record
    const group = await prisma.agwsEntraGroup.upsert({
      where: { entraId: entraGroupId },
      update: { displayName: entraGroupName, syncedAt: new Date() },
      create: { entraId: entraGroupId, displayName: entraGroupName },
    })

    // Create the access policy (check for duplicate first)
    const existingPolicy = await prisma.agwsAccessPolicy.findUnique({
      where: { agentId_groupId: { agentId, groupId: group.id } },
    })

    if (existingPolicy) {
      return NextResponse.json(
        { error: 'A policy for this agent and group already exists' },
        { status: 409 }
      )
    }

    const policy = await prisma.agwsAccessPolicy.create({
      data: { agentId, groupId: group.id, role },
      include: {
        agent: { select: { id: true, name: true } },
        group: { select: { id: true, entraId: true, displayName: true } },
      },
    })

    await prisma.agwsAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'access_policy.created',
        resourceId: policy.id,
        resourceType: 'AgwsAccessPolicy',
        metadata: { agentId, entraGroupId, role },
      },
    }).catch(() => {})

    return NextResponse.json(policy, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/access]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
