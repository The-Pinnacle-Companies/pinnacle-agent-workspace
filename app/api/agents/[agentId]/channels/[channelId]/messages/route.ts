import { auth } from '@/lib/auth'
import { assertAgentAccess, AccessDeniedError } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/factory'
import { NextResponse } from 'next/server'
import type { MessageWithAuthor } from '@/lib/types'
import type { SendMessageParams } from '@/lib/adapters/types'

interface RouteParams {
  params: { agentId: string; channelId: string }
}

// ─── GET: paginated messages ─────────────────────────────────────────────────

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentId, channelId } = params
    await assertAgentAccess(session.user.id, agentId)

    // Verify channel belongs to agent
    const channel = await prisma.agwsChannel.findFirst({
      where: { id: channelId, agentId },
    })
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

    // Get the channel conversation
    const conversation = await prisma.agwsConversation.findFirst({
      where: { channelId, type: 'CHANNEL_THREAD' },
    })

    if (!conversation) {
      return NextResponse.json({ messages: [], nextCursor: null, hasMore: false })
    }

    const rawMessages = await prisma.agwsMessage.findMany({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        ...(cursor && { createdAt: { lt: (await prisma.agwsMessage.findUnique({ where: { id: cursor } }))?.createdAt } }),
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

    const agent = await prisma.agwsAgent.findUnique({ where: { id: agentId } })

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
          hasReacted: data.userIds.includes(session.user.id),
        })),
      }
    })

    const nextCursor = hasMore ? rawMessages[limit - 1]?.id ?? null : null

    return NextResponse.json({ messages: formattedMessages, nextCursor, hasMore })
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error('[GET messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: send message, stream response ─────────────────────────────────────

export async function POST(req: Request, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agentId, channelId } = params
  const userId = session.user.id

  // Access check
  try {
    await assertAgentAccess(userId, agentId)
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Validate body
  let body: { content: string; attachments?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }

  // Load agent
  const agent = await prisma.agwsAgent.findUnique({ where: { id: agentId } })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Verify channel
  const channel = await prisma.agwsChannel.findFirst({
    where: { id: channelId, agentId },
  })
  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

  // Load DB user for context
  const dbUser = await prisma.agwsUser.findUnique({
    where: { id: userId },
    include: {
      groupMemberships: { include: { group: { select: { entraId: true } } } },
    },
  })
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Find or create channel conversation
  let conversation = await prisma.agwsConversation.findFirst({
    where: { channelId, type: 'CHANNEL_THREAD' },
  })
  if (!conversation) {
    conversation = await prisma.agwsConversation.create({
      data: {
        type: 'CHANNEL_THREAD',
        agentId,
        channelId,
        lastMessageAt: new Date(),
      },
    })
  }

  // Save user message
  const userMessage = await prisma.agwsMessage.create({
    data: {
      conversationId: conversation.id,
      authorId: userId,
      authorType: 'USER',
      content: body.content,
      contentType: 'TEXT',
    },
  })

  // Save placeholder agent message
  const agentMessage = await prisma.agwsMessage.create({
    data: {
      conversationId: conversation.id,
      authorType: 'AGENT',
      agentId,
      content: '',
      contentType: 'MARKDOWN',
      isStreaming: true,
    },
  })

  // Update conversation lastMessageAt
  await prisma.agwsConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  // Get adapter and send message
  const adapter = getAdapter(agent)

  const sendParams: SendMessageParams = {
    agentId,
    conversationId: conversation.id,
    channelId,
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
    console.error('[POST messages] adapter error:', err)
    // Clean up placeholder
    await prisma.agwsMessage.delete({ where: { id: agentMessage.id } })
    return NextResponse.json({ error: 'Agent unavailable' }, { status: 502 })
  }

  // Build SSE response stream
  const encoder = new TextEncoder()
  let accumulatedContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      const sendSSE = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Emit message_start so client knows the agent message ID
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
            // Finalize message in DB
            await prisma.agwsMessage.update({
              where: { id: agentMessage.id },
              data: {
                content: accumulatedContent,
                isStreaming: false,
              },
            })

            sendSSE({
              type: 'message_end',
              usage: value.usage,
            })

            // Trigger Pusher if configured
            const pusherKey = process.env.PUSHER_APP_ID
            if (pusherKey) {
              try {
                const Pusher = (await import('pusher')).default
                const pusher = new Pusher({
                  appId: process.env.PUSHER_APP_ID!,
                  key: process.env.PUSHER_KEY!,
                  secret: process.env.PUSHER_SECRET!,
                  cluster: process.env.PUSHER_CLUSTER ?? 'us2',
                  useTLS: true,
                })
                await pusher.trigger(`channel-${channelId}`, 'message.new', {
                  id: agentMessage.id,
                  conversationId: conversation!.id,
                  authorType: 'AGENT',
                  agentId,
                  agentName: agent.name,
                  agentBrandColor: agent.brandColor,
                  content: accumulatedContent,
                  contentType: 'MARKDOWN',
                  isStreaming: false,
                  createdAt: new Date().toISOString(),
                  attachments: [],
                  reactions: [],
                })
              } catch (pusherErr) {
                console.warn('[POST messages] Pusher trigger failed:', pusherErr)
              }
            }

            break
          } else if (value.type === 'error') {
            sendSSE({ type: 'error', code: value.code, message: value.message })
            break
          }
        }
      } catch (err) {
        console.error('[POST messages] stream error:', err)
        sendSSE({ type: 'error', code: 'stream_error', message: 'Stream failed' })
      } finally {
        reader.releaseLock()
        // Make sure agent message is finalized even on error
        if (accumulatedContent) {
          await prisma.agwsMessage.update({
            where: { id: agentMessage.id },
            data: { content: accumulatedContent, isStreaming: false },
          }).catch(() => {})
        } else {
          await prisma.agwsMessage.update({
            where: { id: agentMessage.id },
            data: { isStreaming: false },
          }).catch(() => {})
        }
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
