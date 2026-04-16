import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)))
    const filterUserId = url.searchParams.get('userId') ?? undefined
    const filterAction = url.searchParams.get('action') ?? undefined
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: Parameters<typeof prisma.agwsAuditLog.findMany>[0]['where'] = {}

    if (filterUserId) where.userId = filterUserId
    if (filterAction) where.action = { contains: filterAction, mode: 'insensitive' }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const [total, logs] = await Promise.all([
      prisma.agwsAuditLog.count({ where }),
      prisma.agwsAuditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/audit]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
