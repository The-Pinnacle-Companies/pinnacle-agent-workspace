'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MessageList } from './MessageList'
import { MessageComposer } from './MessageComposer'
import type { MessageWithAuthor } from '@/lib/types'
import type { AgwsAgent } from '@prisma/client'

interface DmViewProps {
  agent: AgwsAgent
  currentUserId: string
  subAgentId?: string | null
}

interface ThinkingState {
  isThinking: boolean
  state?: string
  detail?: string
}

export function DmView({ agent, currentUserId, subAgentId }: DmViewProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageWithAuthor[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [thinking, setThinking] = useState<ThinkingState>({ isThinking: false })
  const [isInitializing, setIsInitializing] = useState(true)
  const streamingMessageIdRef = useRef<string | null>(null)

  // Initialize or create DM conversation
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, subAgentId }),
        })
        if (!res.ok) throw new Error('Failed to create conversation')
        const data = await res.json() as { id: string }
        setConversationId(data.id)

        // Load messages
        const msgRes = await fetch(`/api/conversations/${data.id}/messages?limit=50`)
        if (msgRes.ok) {
          const msgData = await msgRes.json() as { messages: MessageWithAuthor[]; hasMore: boolean }
          setMessages(msgData.messages)
          setHasMore(msgData.hasMore)
        }
      } catch (err) {
        console.error('[DmView] init error:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    init()
  }, [agent.id, subAgentId])

  const loadMore = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMore) return
    const cursor = messages[0]?.id
    if (!cursor) return

    setIsLoadingMore(true)
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?cursor=${cursor}&limit=50`
      )
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json() as { messages: MessageWithAuthor[]; hasMore: boolean }
      setMessages((prev) => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    } catch (err) {
      console.error('[DmView] loadMore error:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversationId, isLoadingMore, hasMore, messages])

  const handleSend = useCallback(
    async (content: string, _attachments?: File[]) => {
      if (!conversationId) return

      // Optimistic user message
      const optimisticUserMsg: MessageWithAuthor = {
        id: `optimistic-${Date.now()}`,
        conversationId,
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
      setThinking({ isThinking: true, state: 'processing' })

      let res: Response
      try {
        res = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
      } catch (err) {
        console.error('[DmView] POST error:', err)
        setThinking({ isThinking: false })
        return
      }

      if (!res.ok || !res.body) {
        setThinking({ isThinking: false })
        return
      }

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
            const placeholder: MessageWithAuthor = {
              id: event.messageId,
              conversationId,
              authorId: null,
              authorType: 'AGENT',
              agentId: agent.id,
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
            setThinking({ isThinking: true, state: event.state, detail: event.detail })
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
          }
        } catch {
          // Ignore malformed
        }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) processSSELine(line)
        }
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
    [conversationId, currentUserId, agent]
  )

  if (isInitializing) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-white/30">
        <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full mb-3" />
        <p className="text-sm">Starting conversation...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* DM header */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-white/5 bg-[#0f0f18] flex-shrink-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: agent.brandColor ?? '#7c3aed' }}
        >
          {agent.name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{agent.name}</p>
          <p className="text-xs text-white/30">Private conversation</p>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">Online</span>
        </div>
      </div>

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
      />

      {/* Composer */}
      <MessageComposer
        placeholder={`Message ${agent.name}...`}
        onSend={handleSend}
      />
    </div>
  )
}
