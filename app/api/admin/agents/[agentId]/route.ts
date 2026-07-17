import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

interface RouteParams {
  params: { agentId: string }
}

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).nullable().optional(),
  shortTagline: z.string().max(100).nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  adapterType: z.string().optional(),
  adapterConfig: z.record(z.unknown()).nullable().optional(),
  openclawGateway: z.string().url().nullable().optional(),
  openclawAgentId: z.string().nullable().optional(),
  capabilities: z.array(z.string()).optional(),
  ownerTeam: z.string().max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
})

function requireAdmin(role: string) {
  return role !== 'PLATFORM_ADMIN'
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (requireAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { agentId } = params
    const rawBody = await req.json()
    const result = UpdateAgentSchema.safeParse(rawBody)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 422 }
      )
    }

    // Check slug uniqueness if being changed
    if (result.data.slug) {
      const existing = await prisma.agwsAgent.findFirst({
        where: { slug: result.data.slug, NOT: { id: agentId } },
      })
      if (existing) {
        return NextResponse.json({ error: `Slug "${result.data.slug}" is already taken` }, { status: 409 })
      }
    }

    const agent = await prisma.agwsAgent.update({
      where: { id: agentId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: result.data as any,
    })

    await prisma.agwsAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'agent.updated',
        resourceId: agentId,
        resourceType: 'AgwsAgent',
        metadata: { changes: Object.keys(result.data) },
      },
    }).catch(() => {})

    return NextResponse.json(agent)
  } catch (err) {
    console.error('[PATCH /api/admin/agents/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (requireAdmin(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { agentId } = params

    // Soft delete: set status to INACTIVE
    await prisma.agwsAgent.update({
      where: { id: agentId },
      data: { status: 'INACTIVE' },
    })

    await prisma.agwsAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'agent.deleted',
        resourceId: agentId,
        resourceType: 'AgwsAgent',
      },
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/agents/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
