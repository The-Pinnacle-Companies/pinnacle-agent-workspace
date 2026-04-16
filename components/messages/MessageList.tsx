'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Message } from './Message'
import { ThinkingIndicator } from './ThinkingIndicator'
import type { MessageWithAuthor } from '@/lib/types'

interface MessageListProps {
  messages: MessageWithAuthor[]
  currentUserId: string
  agentName?: string
  agentBrandColor?: string | null
  isThinking?: boolean
  thinkingState?: string
  thinkingDetail?: string
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  onReact?: (messageId: string, emoji: string) => Promise<void>
}

export function MessageList({
  messages,
  currentUserId,
  agentName,
  agentBrandColor,
  isThinking,
  thinkingState,
  thinkingDetail,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onReact,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isAtBottomRef = useRef(true)

  // Track whether user is at bottom
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const threshold = 80
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold

    // Infinite scroll: detect reaching top
    if (el.scrollTop < 100 && hasMore && !isLoadingMore && onLoadMore) {
      prevScrollHeightRef.current = el.scrollHeight
      onLoadMore()
    }
  }, [hasMore, isLoadingMore, onLoadMore])

  // Scroll to bottom on new messages (if user is near bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isThinking])

  // Restore scroll position after loading more messages
  useEffect(() => {
    if (isLoadingMore === false && prevScrollHeightRef.current > 0) {
      const el = listRef.current
      if (el) {
        const delta = el.scrollHeight - prevScrollHeightRef.current
        el.scrollTop += delta
        prevScrollHeightRef.current = 0
      }
    }
  }, [isLoadingMore])

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-4 space-y-0.5"
    >
      {/* Load more indicator */}
      {hasMore && (
        <div className="flex justify-center py-4">
          {isLoadingMore ? (
            <span className="text-xs text-white/30 animate-pulse">Loading older messages...</span>
          ) : (
            <button
              onClick={onLoadMore}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Load older messages
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !isThinking && (
        <div className="flex flex-col items-center justify-center py-20 text-white/30">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm font-medium">No messages yet</p>
          <p className="text-xs mt-1">Start the conversation below</p>
        </div>
      )}

      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          agentName={agentName}
          agentBrandColor={agentBrandColor}
          onReact={onReact}
        />
      ))}

      {/* Thinking indicator */}
      {isThinking && (
        <ThinkingIndicator
          agentName={agentName}
          state={thinkingState}
          detail={thinkingDetail}
        />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
