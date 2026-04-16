'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MessageSquare } from 'lucide-react'
import { MessageList } from '@/components/chat/MessageList'
import { MessageComposer } from '@/components/chat/MessageComposer'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import type { MessageData } from '@/components/chat/Message'
import type { PendingFile } from '@/components/chat/MessageComposer'

export default function DMPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const agentId = params.agentId as string
  const subAgentId = searchParams.get('subAgent')

  const { data: session } = useSession()
  const [agent, setAgent] = useState<{
    id: string
    name: string
    brandColor?: string | null
    shortTagline?: string | null
  } | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingDetail, setThinkingDetail] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  // Load agent info
  useEffect(() => {
    async function loadAgent() {
      const res = await fetch(`/api/agents/${agentId}`)
      if (res.ok) {
        const data = await res.json()
        setAgent(data.agent)
      }
    }
    loadAgent()
  }, [agentId])

  // Create or get DM conversation
  useEffect(() => {
    async function initConversation() {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, subAgentId }),
      })
      if (res.ok) {
        const data = await res.json()
        setConversationId(data.conversation.id)
      }
    }
    initConversation()
  }, [agentId, subAgentId])

  // Load messages
  const loadMessages = useCallback(async (before?: string) => {
    if (!conversationId) return
    try {
      const url = `/api/conversations/${conversationId}/messages?limit=50${before ? `&before=${before}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      const newMessages: MessageData[] = data.messages.map((m: MessageData) => ({
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
  }, [conversationId, agent])

  useEffect(() => {
    if (conversationId) {
      loadMessages()
    }
  }, [conversationId, loadMessages])

  const handleLoadMore = async () => {
    const oldest = messages[0]
    if (!oldest) return
    await loadMessages(new Date(oldest.createdAt).toISOString())
  }

  const handleSend = async (content: string, _files?: PendingFile[]) => {
    if (!conversationId || !content.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsThinking(true)
    setThinkingDetail(undefined)

    // Optimistic user message
    const tempId = `temp-${Date.now()}`
    const tempMsg: MessageData = {
      id: tempId,
      content,
      authorType: 'USER',
      authorId: session?.user.id,
      createdAt: new Date(),
      author: {
        displayName: session?.user.name || 'You',
        avatarUrl: session?.user.image,
      },
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      })

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
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          try {
            const event = JSON.parse(dataStr)

            if (event.type === 'message_saved') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempId ? { ...m, id: event.message.id, createdAt: event.message.createdAt } : m
                )
              )
            } else if (event.type === 'agent_message_start') {
              agentMsgId = event.messageId
              setMessages((prev) => [
                ...prev,
                {
                  id: event.messageId,
                  content: '',
                  authorType: 'AGENT',
                  agentId,
                  createdAt: new Date(),
                  isStreaming: true,
                  agentName: agent?.name,
                  agentBrandColor: agent?.brandColor || '#7C3AED',
                },
              ])
            } else if (event.type === 'thinking') {
              setIsThinking(true)
              setThinkingDetail(event.detail)
            } else if (event.type === 'content_delta') {
              setIsThinking(false)
              agentContent += event.delta
              const snapshot = agentContent
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: snapshot, isStreaming: true } : m
                )
              )
            } else if (event.type === 'message_complete') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: event.content, isStreaming: false } : m
                )
              )
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      console.error('DM send error:', err)
    } finally {
      setIsThinking(false)
    }
  }

  const brandColor = agent?.brandColor || '#7C3AED'

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title={agent ? `${agent.name}` : 'Loading...'}
        subtitle={agent?.shortTagline || 'Direct Message'}
        icon={<MessageSquare className="w-4 h-4" />}
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
        />
      )}

      <MessageComposer
        onSend={handleSend}
        placeholder={agent ? `Message ${agent.name}...` : 'Message...'}
        brandColor={brandColor}
        disabled={isLoading || !conversationId}
      />
    </div>
  )
}
