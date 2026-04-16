'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Pusher from 'pusher-js'
import { MessageList } from './MessageList'
import { MessageComposer } from './MessageComposer'
import { AgentHeader } from '@/components/agents/AgentHeader'
import type { MessageWithAuthor } from '@/lib/types'
import type { AgwsAgent, AgwsChannel } from '@prisma/client'

interface ChannelViewProps {
  agentId: string
  channelId: string
  agent: AgwsAgent
  channel: AgwsChannel
  initialMessages: MessageWithAuthor[]
  initialHasMore: boolean
  currentUserId: string
}

interface ThinkingState {
  isThinking: boolean
  state?: string
  detail?: string
}

export function ChannelView({
  agentId,
  channelId,
  agent,
  channel,
  initialMessages,
  initialHasMore,
  currentUserId,
}: ChannelViewProps) {
  const [messages, setMessages] = useState<MessageWithAuthor[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [thinking, setThinking] = useState<ThinkingState>({ isThinking: false })
  const streamingMessageIdRef = useRef<string | null>(null)

  // Pusher real-time subscription
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!pusherKey || !pusherCluster) return

    const pusher = new Pusher(pusherKey, { cluster: pusherCluster })
    const channelName = `channel-${channelId}`
    const ch = pusher.subscribe(channelName)

    ch.bind('message.new', (data: MessageWithAuthor) => {
      // Don't add messages from our own streaming (already handled)
      if (data.authorId === currentUserId) return
      setMessages((prev) => {
        if (prev.find((m) => m.id === data.id)) return prev
        return [...prev, data]
      })
    })

    return () => {
      pusher.unsubscribe(channelName)
      pusher.disconnect()
    }
  }, [channelId, currentUserId])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    const cursor = messages[0]?.id
    if (!cursor) return

    setIsLoadingMore(true)
    try {
      const res = await fetch(
        `/api/agents/${agentId}/channels/${channelId}/messages?cursor=${cursor}&limit=50`
      )
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json() as {
        messages: MessageWithAuthor[]
        hasMore: boolean
      }
      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('[ChannelView] loadMore error:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [agentId, channelId, isLoadingMore, hasMore, messages])

  const handleSend = useCallback(
    async (content: string, _attachments?: File[]) => {
      // 1. Optimistic user message
      const optimisticUserMsg: MessageWithAuthor = {
        id: `optimistic-${Date.now()}`,
        conversationId: '',
        authorId: currentUserId,
        authorType: 'USER',
        agentId: null,
        agentName: null,
        agentAvatarUrl: null,
        agentBrandColor: null,
        content,
        contentType: 'TEXT',
        isStreaming: false,
        editedAt: null,
        deletedAt: null,
        parentMessageId: null,
        parentMessagePreview: null,
        createdAt: new Date(),
        author: { id: currentUserId, displayName: 'You', email: '', avatarUrl: null },
        attachments: [],
        reactions: [],
      }
      setMessages((prev) => [...prev, optimisticUserMsg])

      // 2. Show thinking indicator
      setThinking({ isThinking: true, state: 'processing' })

      // 3. POST to messages endpoint
      let res: Response
      try {
        res = await fetch(`/api/agents/${agentId}/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
      } catch (err) {
        console.error('[ChannelView] POST error:', err)
        setThinking({ isThinking: false })
        return
      }

      if (!res.ok || !res.body) {
        console.error('[ChannelView] Bad response:', res.status)
        setThinking({ isThinking: false })
        return
      }

      // 4. Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let agentMessageId: string | null = null
      let accumulatedContent = ''

      const processSSELine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) return

        const dataStr = trimmed.slice(5).trim()
        if (!dataStr || dataStr === '[DONE]') return

        try {
          const event = JSON.parse(dataStr) as {
            type: string
            delta?: string
            state?: string
            detail?: string
            messageId?: string
          }

          if (event.type === 'message_start' && event.messageId) {
            agentMessageId = event.messageId
            streamingMessageIdRef.current = event.messageId
            // Add placeholder agent message
            const placeholder: MessageWithAuthor = {
              id: event.messageId,
              conversationId: '',
              authorId: null,
              authorType: 'AGENT',
              agentId: agentId,
              agentName: agent.name,
              agentAvatarUrl: agent.avatarUrl,
              agentBrandColor: agent.brandColor,
              content: '',
              contentType: 'MARKDOWN',
              isStreaming: true,
              editedAt: null,
              deletedAt: null,
              parentMessageId: null,
              parentMessagePreview: null,
              createdAt: new Date(),
              author: null,
              attachments: [],
              reactions: [],
            }
            setThinking({ isThinking: false })
            setMessages((prev) => [...prev, placeholder])
          } else if (event.type === 'thinking') {
            setThinking({
              isThinking: true,
              state: event.state,
              detail: event.detail,
            })
          } else if (event.type === 'content_delta' && event.delta) {
            accumulatedContent += event.delta
            setThinking({ isThinking: false })
            if (agentMessageId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMessageId
                    ? { ...m, content: accumulatedContent, isStreaming: true }
                    : m
                )
              )
            }
          } else if (event.type === 'message_end') {
            if (agentMessageId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMessageId
                    ? { ...m, content: accumulatedContent, isStreaming: false }
                    : m
                )
              )
            }
            setThinking({ isThinking: false })
            streamingMessageIdRef.current = null
          } else if (event.type === 'error') {
            console.error('[ChannelView] Stream error:', event)
            setThinking({ isThinking: false })
          }
        } catch {
          // Ignore malformed JSON
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            processSSELine(line)
          }
        }
      } catch (err) {
        console.error('[ChannelView] Stream read error:', err)
      } finally {
        setThinking({ isThinking: false })
        if (streamingMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMessageIdRef.current
                ? { ...m, isStreaming: false }
                : m
            )
          )
          streamingMessageIdRef.current = null
        }
      }
    },
    [agentId, channelId, currentUserId, agent]
  )

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      // Optimistically update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const existingReaction = m.reactions.find((r) => r.emoji === emoji)
          if (existingReaction) {
            if (existingReaction.hasReacted) {
              // Remove
              return {
                ...m,
                reactions: m.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, hasReacted: false, userIds: r.userIds.filter((id) => id !== currentUserId) }
                      : r
                  )
                  .filter((r) => r.count > 0),
              }
            } else {
              // Add
              return {
                ...m,
                reactions: m.reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count + 1, hasReacted: true, userIds: [...r.userIds, currentUserId] }
                    : r
                ),
              }
            }
          } else {
            return {
              ...m,
              reactions: [...m.reactions, { emoji, count: 1, hasReacted: true, userIds: [currentUserId] }],
            }
          }
        })
      )
    } catch (err) {
      console.error('[ChannelView] reaction error:', err)
    }
  }, [currentUserId])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <AgentHeader
        agent={agent}
        compact
        channelName={`#${channel.name}`}
        channelDescription={channel.description ?? undefined}
      />

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        agentName={agent.name}
        agentBrandColor={agent.brandColor}
        isThinking={thinking.isThinking}
        thinkingState={thinking.state}
        thinkingDetail={thinking.detail}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onReact={handleReact}
      />

      {/* Composer */}
      <MessageComposer
        placeholder={`Message #${channel.name}...`}
        onSend={handleSend}
      />
    </div>
  )
}
