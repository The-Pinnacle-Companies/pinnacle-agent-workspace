import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/factory'
import { NextResponse } from 'next/server'
import type { MessageWithAuthor } from '@/lib/types'
import type { SendMessageParams } from '@/lib/adapters/types'

interface RouteParams {
  params: { conversationId: string }
}

// ─── Access helper ────────────────────────────────────────────────────────────

async function getConversationWithAccess(conversationId: string, userId: string) {
  const conversation = await prisma.agwsConversation.findUnique({
    where: { id: conversationId },
    include: {
      agent: true,
      subAgent: true,
    },
  })

  if (!conversation) return null

  // DM must belong to current user
  if (conversation.type === 'DIRECT_MESSAGE' && conversation.dmUserId !== userId) {
    return null
  }

  return conversation
}

// ─── GET: paginated messages ──────────────────────────────────────────────────

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { conversationId } = params

    const conversation = await getConversationWithAccess(conversationId, userId)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

    const rawMessages = await prisma.agwsMessage.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(cursor && {
          createdAt: {
            lt: (await prisma.agwsMessage.findUnique({ where: { id: cursor } }))?.createdAt,
          },
        }),
      },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        attachments: true,
        reactions: { include: { user: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })

    const hasMore = rawMessages.length > limit
    const messages = rawMessages.slice(0, limit).reverse()
    const agent = conversation.agent

    const formattedMessages: MessageWithAuthor[] = messages.map((msg) => {
      const reactionMap = new Map<string, { count: number; userIds: string[] }>()
      for (const r of msg.reactions) {
        const ex = reactionMap.get(r.emoji)
        if (ex) { ex.count++; ex.userIds.push(r.userId) }
        else reactionMap.set(r.emoji, { count: 1, userIds: [r.userId] })
      }

      return {
        id: msg.id,
        conversationId: msg.conversationId,
        authorId: msg.authorId,
        authorType: msg.authorType,
        agentId: msg.agentId,
        agentName: msg.agentId ? agent?.name ?? null : null,
        agentAvatarUrl: msg.agentId ? agent?.avatarUrl ?? null : null,
        agentBrandColor: msg.agentId ? agent?.brandColor ?? null : null,
        content: msg.content,
        contentType: msg.contentType,
        isStreaming: msg.isStreaming,
        editedAt: msg.editedAt,
        deletedAt: msg.deletedAt,
        parentMessageId: msg.parentMessageId,
        parentMessagePreview: null,
        createdAt: msg.createdAt,
        author: msg.author ? {
          id: msg.author.id,
          displayName: msg.author.displayName,
          email: msg.author.email,
          avatarUrl: msg.author.avatarUrl,
        } : null,
        attachments: msg.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          blobUrl: a.blobUrl,
          sasUrl: a.sasUrl,
        })),
        reactions: Array.from(reactionMap.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          userIds: data.userIds,
          hasReacted: data.userIds.includes(userId),
        })),
      }
    })

    return NextResponse.json({
      messages: formattedMessages,
      nextCursor: hasMore ? rawMessages[limit - 1]?.id ?? null : null,
      hasMore,
    })
  } catch (err) {
    console.error('[GET /api/conversations/[id]/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: send message, stream response ─────────────────────────────────────

export async function POST(req: Request, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { conversationId } = params

  const conversation = await getConversationWithAccess(conversationId, userId)
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const agent = conversation.agent
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found for conversation' }, { status: 404 })
  }

  let body: { content: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  const dbUser = await prisma.agwsUser.findUnique({
    where: { id: userId },
    include: {
      groupMemberships: { include: { group: { select: { entraId: true } } } },
    },
  })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Save user message
  const userMessage = await prisma.agwsMessage.create({
    data: {
      conversationId,
      authorId: userId,
      authorType: 'USER',
      content: body.content,
      contentType: 'TEXT',
    },
  })

  // Save placeholder agent message
  const agentMessage = await prisma.agwsMessage.create({
    data: {
      conversationId,
      authorType: 'AGENT',
      agentId: agent.id,
      content: '',
      contentType: 'MARKDOWN',
      isStreaming: true,
    },
  })

  await prisma.agwsConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  const adapter = getAdapter(agent)

  const sendParams: SendMessageParams = {
    agentId: agent.id,
    conversationId,
    userContext: {
      userId,
      displayName: dbUser.displayName,
      email: dbUser.email,
      groups: dbUser.groupMemberships.map((gm) => gm.group.entraId),
    },
    message: body.content,
  }

  let adapterStream: ReadableStream<import('@/lib/adapters/types').StreamChunk>
  try {
    adapterStream = await adapter.sendMessage(sendParams)
  } catch (err) {
    console.error('[POST DM messages] adapter error:', err)
    await prisma.agwsMessage.delete({ where: { id: agentMessage.id } })
    return NextResponse.json({ error: 'Agent unavailable' }, { status: 502 })
  }

  const encoder = new TextEncoder()
  let accumulatedContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      const sendSSE = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      sendSSE({ type: 'message_start', messageId: agentMessage.id })

      const reader = adapterStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value.type === 'content_delta') {
            accumulatedContent += value.delta
            sendSSE({ type: 'content_delta', delta: value.delta })
          } else if (value.type === 'thinking') {
            sendSSE({ type: 'thinking', state: value.state, detail: value.detail })
          } else if (value.type === 'message_end') {
            await prisma.agwsMessage.update({
              where: { id: agentMessage.id },
              data: { content: accumulatedContent, isStreaming: false },
            })
            sendSSE({ type: 'message_end', usage: value.usage })
            break
          } else if (value.type === 'error') {
            sendSSE({ type: 'error', code: value.code, message: value.message })
            break
          }
        }
      } catch (err) {
        console.error('[POST DM messages] stream error:', err)
        sendSSE({ type: 'error', code: 'stream_error', message: 'Stream failed' })
      } finally {
        reader.releaseLock()
        await prisma.agwsMessage.update({
          where: { id: agentMessage.id },
          data: {
            content: accumulatedContent || undefined,
            isStreaming: false,
          },
        }).catch(() => {})
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
