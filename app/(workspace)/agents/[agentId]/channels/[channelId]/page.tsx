'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, notFound } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Hash } from 'lucide-react'
import { MessageList } from '@/components/chat/MessageList'
import { MessageComposer } from '@/components/chat/MessageComposer'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import type { MessageData } from '@/components/chat/Message'
import type { PendingFile } from '@/components/chat/MessageComposer'

export default function ChannelPage() {
  const params = useParams()
  const agentId = params.agentId as string
  const channelId = params.channelId as string

  const { data: session } = useSession()
  const [agent, setAgent] = useState<{
    id: string
    name: string
    brandColor?: string | null
    shortTagline?: string | null
  } | null>(null)
  const [channel, setChannel] = useState<{ id: string; name: string; description?: string | null } | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingDetail, setThinkingDetail] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load agent + channel info
  useEffect(() => {
    async function loadAgent() {
      try {
        const res = await fetch(`/api/agents/${agentId}`)
        if (!res.ok) return
        const data = await res.json()
        setAgent(data.agent)
        const ch = data.agent.channels?.find((c: { id: string }) => c.id === channelId)
        if (ch) setChannel(ch)
      } catch (err) {
        console.error('Failed to load agent:', err)
      }
    }
    loadAgent()
  }, [agentId, channelId])

  // Load messages
  const loadMessages = useCallback(async (before?: string) => {
    try {
      const url = `/api/agents/${agentId}/channels/${channelId}/messages?limit=50${before ? `&before=${before}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      setConversationId(data.conversationId)

      const newMessages: MessageData[] = data.messages.map((m: MessageData & {
        agentId?: string;
        author?: { displayName: string; avatarUrl?: string | null; id: string };
        reactions?: { emoji: string; userId: string }[];
        attachments?: { id: string; fileName: string; mimeType: string; blobUrl: string; sasUrl?: string | null }[];
      }) => ({
        ...m,
        agentName: agent?.name,
        agentBrandColor: agent?.brandColor,
      }))

      if (before) {
        setMessages((prev) => [...newMessages, ...prev])
      } else {
        setMessages(newMessages)
      }
      setHasMore(data.hasMore)
    } finally {
      setIsLoading(false)
    }
  }, [agentId, channelId, agent])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const handleLoadMore = async () => {
    const oldest = messages[0]
    if (!oldest) return
    await loadMessages(new Date(oldest.createdAt).toISOString())
  }

  const handleSend = async (content: string, _files?: PendingFile[]) => {
    if (!content.trim() && !_files?.length) return

    // Abort any existing stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsThinking(true)
    setThinkingDetail(undefined)

    // Optimistically add user message
    const tempUserMsgId = `temp-user-${Date.now()}`
    const tempUserMsg: MessageData = {
      id: tempUserMsgId,
      content,
      authorType: 'USER',
      authorId: session?.user.id,
      createdAt: new Date(),
      author: {
        displayName: session?.user.displayName || 'You',
        avatarUrl: session?.user.image,
      },
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await fetch(
        `/api/agents/${agentId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        }
      )

      if (!res.ok || !res.body) {
        setIsThinking(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let agentMsgId: string | null = null
      let agentContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const dataStr = trimmed.slice(5).trim()

          try {
            const event = JSON.parse(dataStr)

            if (event.type === 'message_saved') {
              // Replace temp user message with saved one
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempUserMsgId
                    ? {
                        ...m,
                        id: event.message.id,
                        createdAt: event.message.createdAt,
                      }
                    : m
                )
              )
            } else if (event.type === 'agent_message_start') {
              agentMsgId = event.messageId
              const agentMsg: MessageData = {
                id: event.messageId,
                content: '',
                authorType: 'AGENT',
                agentId,
                createdAt: new Date(),
                isStreaming: true,
                agentName: agent?.name,
                agentBrandColor: agent?.brandColor || '#7C3AED',
              }
              setMessages((prev) => [...prev, agentMsg])
            } else if (event.type === 'thinking') {
              setIsThinking(true)
              setThinkingDetail(event.detail)
            } else if (event.type === 'content_delta') {
              setIsThinking(false)
              agentContent += event.delta
              const content = agentContent
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, content, isStreaming: true }
                    : m
                )
              )
            } else if (event.type === 'message_complete') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, content: event.content, isStreaming: false }
                    : m
                )
              )
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      console.error('Send error:', err)
    } finally {
      setIsThinking(false)
    }
  }

  const handleReact = async (messageId: string, emoji: string) => {
    const userId = session?.user.id || ''
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const reactions = [...(m.reactions || [])]
        const existing = reactions.find((r) => r.emoji === emoji)
        if (existing) {
          const hasIt = existing.userIds.includes(userId)
          return {
            ...m,
            reactions: reactions.map((r) =>
              r.emoji !== emoji ? r : {
                ...r,
                count: hasIt ? r.count - 1 : r.count + 1,
                userIds: hasIt ? r.userIds.filter((id) => id !== userId) : [...r.userIds, userId],
                hasReacted: !hasIt,
              }
            ).filter((r) => r.count > 0),
          }
        }
        return {
          ...m,
          reactions: [...reactions, { emoji, count: 1, userIds: [userId], hasReacted: true }],
        }
      })
    )
    // TODO: persist reaction via API
  }

  const brandColor = agent?.brandColor || '#7C3AED'

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title={`#${channel?.name || '...'}`}
        subtitle={channel?.description || agent?.shortTagline || ''}
        icon={<Hash className="w-4 h-4" />}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${brandColor}40`, borderTopColor: brandColor }}
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={session?.user.id || ''}
          isThinking={isThinking}
          thinkingDetail={thinkingDetail}
          agentName={agent?.name}
          agentBrandColor={brandColor}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          onReact={handleReact}
        />
      )}

      <MessageComposer
        onSend={handleSend}
        placeholder={`Message #${channel?.name || '...'}`}
        brandColor={brandColor}
        disabled={isLoading}
      />
    </div>
  )
}
