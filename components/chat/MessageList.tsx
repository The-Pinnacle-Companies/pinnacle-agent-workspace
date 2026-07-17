'use client'

import { useRef, useCallback, useEffect } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { motion, AnimatePresence } from 'framer-motion'
import { Message } from '@/components/chat/Message'
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator'
import { isSameDay, formatDateLabel } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { MessageData } from '@/components/chat/Message'

interface MessageListProps {
  messages: MessageData[]
  /** Also accepts isThinking as alias */
  isAgentThinking?: boolean
  isThinking?: boolean
  thinkingDetail?: string
  /** Also accepts agentBrandColor as alias */
  agentColor?: string
  agentBrandColor?: string
  agentName?: string
  onLoadMore: () => Promise<void>
  hasMore: boolean
  currentUserId: string
  firstUnreadMessageId?: string | null
  onReact?: (messageId: string, emoji: string) => void
  onReply?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
}

interface ListItem {
  type: 'date-divider' | 'unread-separator' | 'message' | 'thinking'
  id: string
  date?: string
  message?: MessageData
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 select-none">
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
      <span className="text-xs font-semibold text-[#3a3a4a] px-2">{label}</span>
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
    </div>
  )
}

function UnreadSeparator() {
  return (
    <div className="flex items-center gap-3 px-4 py-1 select-none">
      <div className="h-px flex-1 bg-red-500/40" />
      <span className="text-[11px] font-semibold text-red-400/80 px-2 whitespace-nowrap">
        New Messages
      </span>
      <div className="h-px flex-1 bg-red-500/40" />
    </div>
  )
}

export function MessageList({
  messages,
  isAgentThinking,
  isThinking,
  thinkingDetail: _thinkingDetail,
  agentColor,
  agentBrandColor,
  agentName = 'Agent',
  onLoadMore,
  hasMore,
  currentUserId,
  firstUnreadMessageId,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: MessageListProps) {
  const resolvedThinking = isThinking ?? isAgentThinking ?? false
  const resolvedColor = agentBrandColor ?? agentColor ?? '#7C3AED'
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const isAtBottomRef = useRef(true)
  const prevMessageCountRef = useRef(messages.length)

  // Build the flat list of items including date dividers and unread separator
  const listItems: ListItem[] = []

  messages.forEach((message, index) => {
    // Date divider
    const prev = messages[index - 1]
    if (!prev || !isSameDay(prev.createdAt, message.createdAt)) {
      listItems.push({
        type: 'date-divider',
        id: `date-${message.id}`,
        date: formatDateLabel(message.createdAt),
      })
    }

    // Unread separator
    if (firstUnreadMessageId && message.id === firstUnreadMessageId) {
      listItems.push({
        type: 'unread-separator',
        id: 'unread-sep',
      })
    }

    listItems.push({
      type: 'message',
      id: message.id,
      message,
    })
  })

  // Add thinking indicator as a list item if active
  if (resolvedThinking) {
    listItems.push({
      type: 'thinking',
      id: 'thinking-indicator',
    })
  }

  // Auto-scroll to bottom when new messages arrive (if user is at bottom)
  useEffect(() => {
    const newCount = messages.length
    if (newCount > prevMessageCountRef.current && isAtBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({
        index: listItems.length - 1,
        behavior: 'smooth',
      })
    }
    prevMessageCountRef.current = newCount
  }, [messages.length, listItems.length])

  // Scroll to bottom when thinking starts
  useEffect(() => {
    if (resolvedThinking && isAtBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({
        index: listItems.length - 1,
        behavior: 'smooth',
      })
    }
  }, [resolvedThinking, listItems.length])

  const handleStartReached = useCallback(() => {
    if (hasMore) {
      onLoadMore()
    }
  }, [hasMore, onLoadMore])

  const renderItem = useCallback(
    (index: number) => {
      const item = listItems[index]
      if (!item) return null

      if (item.type === 'date-divider') {
        return <DateDivider key={item.id} label={item.date!} />
      }

      if (item.type === 'unread-separator') {
        return <UnreadSeparator key={item.id} />
      }

      if (item.type === 'thinking') {
        return (
          <AnimatePresence key="thinking">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <ThinkingIndicator agentName={agentName} agentColor={resolvedColor} />
            </motion.div>
          </AnimatePresence>
        )
      }

      if (item.type === 'message' && item.message) {
        return (
          <Message
            key={item.id}
            message={item.message as any}
            currentUserId={currentUserId}
            agentColor={resolvedColor}
            onReact={onReact}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      }

      return null
    },
    [listItems, agentName, resolvedColor, currentUserId, onReact, onReply, onEdit, onDelete]
  )

  if (messages.length === 0 && !resolvedThinking) {
    return null
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%', width: '100%' }}
        totalCount={listItems.length}
        itemContent={renderItem}
        followOutput={(isAtBottom) => {
          isAtBottomRef.current = isAtBottom
          return isAtBottom ? 'smooth' : false
        }}
        atTopStateChange={(atTop) => {
          if (atTop && hasMore) {
            onLoadMore()
          }
        }}
        startReached={handleStartReached}
        initialTopMostItemIndex={Math.max(0, listItems.length - 1)}
        overscan={200}
        components={{
          Header: () =>
            hasMore ? (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-xs text-[#3a3a4a]">
                  <span className="h-1 w-1 rounded-full bg-[#3a3a4a] animate-pulse" />
                  Loading older messages…
                </div>
              </div>
            ) : null,
          Footer: () => <div className="h-4" />,
        }}
      />
    </div>
  )
}
