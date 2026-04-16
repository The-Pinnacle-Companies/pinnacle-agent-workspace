import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAgents } from '@/lib/access'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const [dbUser, accessibleAgents] = await Promise.all([
      prisma.agwsUser.findUnique({
        where: { id: userId },
        include: {
          groupMemberships: {
            include: { group: { select: { id: true, entraId: true, displayName: true } } },
          },
        },
      }),
      getUserAgents(userId),
    ])

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      avatarUrl: dbUser.avatarUrl,
      role: dbUser.role,
      entraId: dbUser.entraId,
      lastLoginAt: dbUser.lastLoginAt,
      createdAt: dbUser.createdAt,
      groupMemberships: dbUser.groupMemberships.map((gm) => ({
        id: gm.group.id,
        entraId: gm.group.entraId,
        displayName: gm.group.displayName,
      })),
      accessibleAgentCount: accessibleAgents.length,
    })
  } catch (err) {
    console.error('[GET /api/users/me]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
