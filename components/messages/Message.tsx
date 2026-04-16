'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MessageWithAuthor } from '@/lib/types'

interface MessageProps {
  message: MessageWithAuthor
  currentUserId: string
  agentName?: string
  agentBrandColor?: string | null
  onReact?: (messageId: string, emoji: string) => Promise<void>
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙌', '🤔']

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

export function Message({ message, currentUserId, agentName, agentBrandColor, onReact }: MessageProps) {
  const [showReactions, setShowReactions] = useState(false)
  const isUser = message.authorType === 'USER'
  const isAgent = message.authorType === 'AGENT'

  const displayName = isUser
    ? message.author?.displayName ?? 'You'
    : agentName ?? message.agentName ?? 'Agent'

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="group flex items-start gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors relative"
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {isAgent ? (
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: agentBrandColor ?? '#7c3aed' }}
          >
            {displayName[0]}
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={cn('text-sm font-semibold', isAgent ? 'text-violet-300' : 'text-white')}>
            {displayName}
          </span>
          <span className="text-[11px] text-white/25">{formatTime(message.createdAt)}</span>
          {message.isStreaming && (
            <span className="text-[10px] text-violet-400 italic">streaming...</span>
          )}
          {message.editedAt && (
            <span className="text-[10px] text-white/25 italic">(edited)</span>
          )}
        </div>

        {/* Message content */}
        {message.contentType === 'MARKDOWN' || isAgent ? (
          <div className="prose prose-sm prose-invert max-w-none text-white/80 [&>p]:leading-relaxed [&>p:last-child]:mb-0 [&>ul]:text-white/80 [&>ol]:text-white/80 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-white [&>code]:bg-white/10 [&>code]:text-violet-300 [&>pre]:bg-white/5 [&>pre]:border [&>pre]:border-white/10">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((att) => (
              <a
                key={att.id}
                href={att.sasUrl ?? att.blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                📎 {att.fileName}
                <span className="text-white/30">({Math.round(att.fileSize / 1024)}KB)</span>
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => onReact?.(message.id, reaction.emoji)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                  reaction.hasReacted
                    ? 'bg-violet-600/20 border-violet-500/40 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                )}
              >
                {reaction.emoji}
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick reaction picker */}
      {showReactions && onReact && (
        <div className="absolute right-4 top-2 flex items-center gap-0.5 bg-[#1a1a2e] border border-white/10 rounded-lg p-1 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-sm leading-none"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <button
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
            title="More reactions"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
