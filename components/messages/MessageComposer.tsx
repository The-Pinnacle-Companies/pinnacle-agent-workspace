'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  placeholder?: string
  disabled?: boolean
  onSend: (content: string, attachments?: File[]) => Promise<void> | void
}

export function MessageComposer({ placeholder = 'Message...', disabled, onSend }: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending || disabled) return

    setIsSending(true)
    const filesToSend = [...attachments]
    setContent('')
    setAttachments([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await onSend(trimmed, filesToSend.length > 0 ? filesToSend : undefined)
    } catch (err) {
      console.error('[MessageComposer] send error:', err)
      // Restore content on error
      setContent(trimmed)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachments((prev) => [...prev, ...files].slice(0, 5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const canSend = content.trim().length > 0 && !isSending && !disabled

  return (
    <div className="px-4 pb-4 flex-shrink-0">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60"
            >
              <span>📎 {file.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="hover:text-white transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'flex items-end gap-2 rounded-xl border bg-white/5 px-3 py-2 transition-colors',
          disabled
            ? 'border-white/5 opacity-50'
            : 'border-white/10 focus-within:border-violet-500/50 focus-within:bg-white/[0.07]'
        )}
      >
        {/* File attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
          className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded disabled:pointer-events-none"
          title="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.docx,.xlsx,.txt"
          onChange={handleFileSelect}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isSending ? 'Sending...' : placeholder}
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none resize-none max-h-[200px] leading-relaxed py-1 disabled:cursor-not-allowed"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'p-1.5 rounded-lg transition-all flex-shrink-0',
            canSend
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'text-white/20 cursor-not-allowed'
          )}
          title="Send message (Enter)"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <p className="text-[10px] text-white/20 mt-1.5 text-center">
        Press <kbd className="font-mono bg-white/10 px-1 rounded">Enter</kbd> to send ·{' '}
        <kbd className="font-mono bg-white/10 px-1 rounded">Shift+Enter</kbd> for new line
      </p>
    </div>
  )
}
