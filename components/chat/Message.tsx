'use client'

import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy,
  Reply,
  Pencil,
  Trash2,
  Check,
  Paperclip,
  FileText,
  Download,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StreamingMessage } from '@/components/chat/StreamingMessage'
import { ReactionPicker } from '@/components/chat/ReactionPicker'
import { formatTime } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { MessageWithAuthor } from '@/lib/types'

interface MessageProps {
  message: MessageWithAuthor
  currentUserId: string
  agentColor?: string
  onReact?: (messageId: string, emoji: string) => void
  onReply?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
}

function AgentAvatar({
  name,
  avatarUrl,
  brandColor,
}: {
  name: string
  avatarUrl?: string | null
  brandColor?: string | null
}) {
  const color = brandColor ?? '#7C3AED'
  return (
    <div
      className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-xl object-cover" />
      ) : (
        name[0].toUpperCase()
      )}
    </div>
  )
}

function UserAvatar({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl?: string | null
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <Avatar className="h-9 w-9 shrink-0 rounded-xl">
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className="rounded-xl bg-[#2a2a35] text-[#8b8b9a] text-xs font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

function AttachmentPreview({
  attachment,
}: {
  attachment: MessageWithAuthor['attachments'][number]
}) {
  const isImage = attachment.mimeType.startsWith('image/')

  if (isImage && attachment.sasUrl) {
    return (
      <div className="mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.sasUrl}
          alt={attachment.fileName}
          className="max-w-xs max-h-64 rounded-lg border border-[rgba(255,255,255,0.1)] object-contain"
        />
      </div>
    )
  }

  return (
    <a
      href={attachment.sasUrl ?? attachment.blobUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2.5 max-w-xs rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 hover:bg-[rgba(255,255,255,0.08)] transition-colors"
    >
      <FileText className="h-5 w-5 shrink-0 text-[#5a5a6a]" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#f0f0f2] truncate">{attachment.fileName}</p>
        <p className="text-[10px] text-[#5a5a6a]">
          {(attachment.fileSize / 1024).toFixed(1)} KB
        </p>
      </div>
      <Download className="h-3.5 w-3.5 text-[#5a5a6a] shrink-0" />
    </a>
  )
}

export function Message({
  message,
  currentUserId,
  agentColor = '#7C3AED',
  onReact,
  onReply,
  onEdit,
  onDelete,
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  const isUser = message.authorType === 'USER'
  const isSystem = message.authorType === 'SYSTEM'
  const isOwnMessage = isUser && message.authorId === currentUserId
  const isDeleted = !!message.deletedAt

  const authorName = isUser
    ? message.author?.displayName ?? 'Unknown User'
    : message.agentName ?? 'Agent'

  const handleCopy = useCallback(() => {
    if (isDeleted) return
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [message.content, isDeleted])

  const handleReact = useCallback(
    (emoji: string) => {
      onReact?.(message.id, emoji)
    },
    [message.id, onReact]
  )

  // System messages render differently
  if (isSystem) {
    return (
      <div className="flex items-center gap-3 my-2 px-4">
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
        <p className="text-xs text-[#3a3a4a] shrink-0">{message.content}</p>
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 py-1 rounded-lg transition-colors',
        'hover:bg-[rgba(255,255,255,0.025)]'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0">
        {isUser ? (
          <UserAvatar
            name={authorName}
            avatarUrl={message.author?.avatarUrl}
          />
        ) : (
          <AgentAvatar
            name={authorName}
            avatarUrl={message.agentAvatarUrl}
            brandColor={message.agentBrandColor ?? agentColor}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Parent message reply indicator */}
        {message.parentMessageId && message.parentMessagePreview && (
          <div className="flex items-center gap-2 mb-1.5 cursor-pointer group/reply">
            <div className="h-4 w-0.5 rounded-full bg-[#5a5a6a] shrink-0" />
            <p className="text-xs text-[#5a5a6a] truncate group-hover/reply:text-[#8b8b9a] transition-colors">
              {message.parentMessagePreview}
            </p>
          </div>
        )}

        {/* Header: name + timestamp */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span
            className="text-sm font-semibold"
            style={{
              color: isUser ? '#f0f0f2' : (message.agentBrandColor ?? agentColor),
            }}
          >
            {authorName}
          </span>

          {!isUser && message.agentBrandColor && (
            <span
              className="text-[10px] font-medium px-1.5 py-px rounded"
              style={{
                backgroundColor: `${message.agentBrandColor}20`,
                color: message.agentBrandColor,
              }}
            >
              AI
            </span>
          )}

          <time className="text-[11px] text-[#3a3a4a]">
            {formatTime(message.createdAt)}
          </time>

          {message.editedAt && !isDeleted && (
            <span className="text-[11px] text-[#3a3a4a] italic">(edited)</span>
          )}
        </div>

        {/* Message body */}
        {isDeleted ? (
          <p className="text-sm text-[#3a3a4a] italic">This message was deleted.</p>
        ) : message.isStreaming ? (
          <StreamingMessage
            content={message.content}
            isStreaming={message.isStreaming}
            agentColor={message.agentBrandColor ?? agentColor}
          />
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Attachments */}
        {!isDeleted && message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <AttachmentPreview key={att.id} attachment={att} />
            ))}
          </div>
        )}

        {/* Reactions */}
        {!isDeleted && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReact(reaction.emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all',
                  reaction.hasReacted
                    ? 'border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.15)] text-[#a78bfa]'
                    : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[#8b8b9a] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.08)]'
                )}
              >
                <span>{reaction.emoji}</span>
                <span className="font-medium">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message action toolbar — appears on hover */}
      <AnimatePresence>
        {isHovered && !isDeleted && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, scale: 0.9, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 2 }}
            transition={{ duration: 0.1 }}
            className="absolute -top-8 right-4 flex items-center gap-0.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1f1f24] p-0.5 shadow-xl shadow-black/40 z-10"
          >
            <ReactionPicker onReact={handleReact} />

            <ActionButton
              icon={Reply}
              label="Reply"
              onClick={() => onReply?.(message.id)}
            />

            <ActionButton
              icon={copied ? Check : Copy}
              label={copied ? 'Copied!' : 'Copy'}
              onClick={handleCopy}
              className={copied ? 'text-green-400' : undefined}
            />

            {isOwnMessage && (
              <>
                <ActionButton
                  icon={Pencil}
                  label="Edit"
                  onClick={() => onEdit?.(message.id)}
                />

                <div className="w-px h-4 bg-[rgba(255,255,255,0.08)] mx-0.5" />

                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  onClick={() => onDelete?.(message.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-[#5a5a6a] transition-colors',
        'hover:text-[#f0f0f2] hover:bg-[rgba(255,255,255,0.08)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7C3AED]',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}
