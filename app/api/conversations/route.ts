import { auth } from '@/lib/auth'
import { canAccessAgent } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET: List user's DM conversations
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = await prisma.agwsConversation.findMany({
      where: {
        type: 'DIRECT_MESSAGE',
        dmUserId: session.user.id,
        isArchived: false,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            brandColor: true,
            status: true,
          },
        },
        subAgent: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            brandColor: true,
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    const formatted = conversations.map((conv) => ({
      id: conv.id,
      agentId: conv.agentId,
      subAgentId: conv.subAgentId,
      agentName: conv.agent?.name,
      agentAvatarUrl: conv.agent?.avatarUrl,
      agentBrandColor: conv.agent?.brandColor,
      subAgentName: conv.subAgent?.name,
      lastMessage: conv.messages[0]?.content?.slice(0, 100) ?? null,
      lastMessageAt: conv.lastMessageAt,
    }))

    return NextResponse.json(formatted)
  } catch (err) {
    console.error('[GET /api/conversations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create or retrieve DM conversation
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    let body: { agentId: string; subAgentId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Access check
    const hasAccess = await canAccessAgent(userId, body.agentId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Upsert: find existing DM conversation for this user + agent (+ optional sub-agent)
    let conversation = await prisma.agwsConversation.findFirst({
      where: {
        type: 'DIRECT_MESSAGE',
        dmUserId: userId,
        agentId: body.agentId,
        subAgentId: body.subAgentId ?? null,
        isArchived: false,
      },
    })

    if (!conversation) {
      conversation = await prisma.agwsConversation.create({
        data: {
          type: 'DIRECT_MESSAGE',
          agentId: body.agentId,
          subAgentId: body.subAgentId ?? null,
          dmUserId: userId,
        },
      })
    }

    return NextResponse.json({ id: conversation.id })
  } catch (err) {
    console.error('[POST /api/conversations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
