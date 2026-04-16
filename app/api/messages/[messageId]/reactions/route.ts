import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: { messageId: string }
}

// ─── POST: Add reaction (toggle) ─────────────────────────────────────────────

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { messageId } = params

    let body: { emoji: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.emoji || typeof body.emoji !== 'string' || body.emoji.length > 10) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    // Verify message exists
    const message = await prisma.agwsMessage.findUnique({
      where: { id: messageId },
      select: { id: true, deletedAt: true },
    })

    if (!message || message.deletedAt) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if reaction already exists (toggle off)
    const existing = await prisma.agwsReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji: body.emoji } },
    })

    if (existing) {
      // Toggle off
      await prisma.agwsReaction.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ action: 'removed', emoji: body.emoji })
    } else {
      // Add reaction
      const reaction = await prisma.agwsReaction.create({
        data: { messageId, userId, emoji: body.emoji },
      })
      return NextResponse.json({ action: 'added', emoji: body.emoji, id: reaction.id })
    }
  } catch (err) {
    console.error('[POST /api/messages/[id]/reactions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE: Remove reaction ──────────────────────────────────────────────────

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { messageId } = params

    const url = new URL(req.url)
    const emoji = url.searchParams.get('emoji')

    if (!emoji) {
      return NextResponse.json({ error: 'emoji query param required' }, { status: 400 })
    }

    const deleted = await prisma.agwsReaction.deleteMany({
      where: { messageId, userId, emoji },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Reaction not found' }, { status: 404 })
    }

    return NextResponse.json({ action: 'removed', emoji })
  } catch (err) {
    console.error('[DELETE /api/messages/[id]/reactions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
