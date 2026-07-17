import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
  shortTagline: z.string().max(100).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Brand color must be a valid hex color')
    .optional(),
  adapterType: z.string().default('openclaw'),
  adapterConfig: z.record(z.unknown()).optional(),
  openclawGateway: z.string().url().optional(),
  openclawAgentId: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  ownerTeam: z.string().max(100).optional(),
  sortOrder: z.number().int().default(0),
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

    const agents = await prisma.agwsAgent.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { channels: true, subAgents: true, accessPolicies: true },
        },
      },
    })

    return NextResponse.json(agents)
  } catch (err) {
    console.error('[GET /api/admin/agents]', err)
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
    const result = CreateAgentSchema.safeParse(rawBody)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    // Check slug uniqueness
    const existing = await prisma.agwsAgent.findUnique({ where: { slug: data.slug } })
    if (existing) {
      return NextResponse.json({ error: `Slug "${data.slug}" is already taken` }, { status: 409 })
    }

    const agent = await prisma.agwsAgent.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        shortTagline: data.shortTagline,
        brandColor: data.brandColor,
        adapterType: data.adapterType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adapterConfig: (data.adapterConfig ?? undefined) as any,
        openclawGateway: data.openclawGateway,
        openclawAgentId: data.openclawAgentId,
        capabilities: data.capabilities,
        ownerTeam: data.ownerTeam,
        sortOrder: data.sortOrder,
      },
    })

    // Audit log
    await prisma.agwsAuditLog.create({
      data: {
        userId: session.user.id,
        action: 'agent.created',
        resourceId: agent.id,
        resourceType: 'AgwsAgent',
        metadata: { slug: agent.slug, name: agent.name },
      },
    }).catch((err) => console.warn('[admin/agents POST] audit log failed:', err))

    return NextResponse.json(agent, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/agents]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
