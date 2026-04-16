'use client'

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Paperclip,
  ArrowUp,
  X,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
import { FileUploadZone } from '@/components/chat/FileUploadZone'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  onSend: (content: string, attachments: File[]) => Promise<void>
  isDisabled?: boolean
  placeholder?: string
  agentColor?: string
  agentName?: string
}

const ACCEPTED_TYPES = 'image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.pptx,.zip'
const MAX_CHAR_WARNING = 1000

function FileChip({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const isImage = file.type.startsWith('image/')
  const previewUrl = isImage ? URL.createObjectURL(file) : null

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 pr-7 max-w-[180px]">
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-6 w-6 rounded object-cover shrink-0"
        />
      ) : (
        <FileText className="h-4 w-4 text-[#5a5a6a] shrink-0" />
      )}
      <span className="text-xs text-[#8b8b9a] truncate">{file.name}</span>

      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[#5a5a6a] hover:text-[#f0f0f2] hover:bg-[rgba(255,255,255,0.1)] transition-colors"
        aria-label="Remove file"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function MessageComposer({
  onSend,
  isDisabled = false,
  placeholder,
  agentColor = '#7C3AED',
  agentName = 'Agent',
}: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const effectivePlaceholder = isDisabled
    ? `${agentName} is thinking…`
    : (placeholder ?? `Message ${agentName}…`)

  const isEmpty = content.trim().length === 0 && attachments.length === 0
  const charCount = content.length
  const showCharCount = charCount > MAX_CHAR_WARNING

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 22 // px per line approx
    const maxHeight = lineHeight * 6 + 16 // 6 lines + padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [content, resizeTextarea])

  const handleSend = useCallback(async () => {
    if (isEmpty || isSending || isDisabled) return
    const text = content.trim()
    const files = [...attachments]
    setContent('')
    setAttachments([])
    setIsSending(true)
    try {
      await onSend(text, files)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }, [content, attachments, isEmpty, isSending, isDisabled, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }, [])

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files)
    setAttachments((prev) => [...prev, ...newFiles])
  }, [])

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files)
      e.target.value = ''
    },
    [handleFileSelect]
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Drag and drop
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragOver(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setIsDragOver(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  const borderGlow = isFocused
    ? `0 0 0 2px ${agentColor}40, 0 0 0 1px ${agentColor}60`
    : undefined

  return (
    <div
      className="relative px-4 pb-4"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      <AnimatePresence>
        {isDragOver && (
          <FileUploadZone isActive agentColor={agentColor} />
        )}
      </AnimatePresence>

      {/* Composer box */}
      <div
        className="flex flex-col rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#1f1f24] transition-all duration-200 overflow-hidden"
        style={{ boxShadow: borderGlow }}
      >
        {/* File chips */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              key="chips"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-wrap gap-2 px-3 pt-3 overflow-hidden"
            >
              {attachments.map((file, i) => (
                <FileChip key={`${file.name}-${i}`} file={file} onRemove={() => removeAttachment(i)} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea row */}
        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5a5a6a] transition-colors mb-0.5',
              'hover:text-[#f0f0f2] hover:bg-[rgba(255,255,255,0.08)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={handleFileInputChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={effectivePlaceholder}
            disabled={isDisabled || isSending}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent text-sm text-[#f0f0f2] outline-none',
              'placeholder:text-[#3a3a4a] leading-relaxed py-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'max-h-[132px] overflow-y-auto'
            )}
            style={{ minHeight: '22px' }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isEmpty || isDisabled || isSending}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all mb-0.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]',
              !isEmpty && !isDisabled && !isSending
                ? 'opacity-100 hover:brightness-110 active:scale-95'
                : 'opacity-30 cursor-not-allowed'
            )}
            style={{
              backgroundColor: !isEmpty && !isDisabled ? agentColor : undefined,
              background: isEmpty || isDisabled ? 'rgba(255,255,255,0.1)' : undefined,
            }}
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
          <p className="text-[10px] text-[#3a3a4a]">
            <kbd className="font-mono">Enter</kbd> to send
            {' · '}
            <kbd className="font-mono">Shift+Enter</kbd> for newline
          </p>

          {showCharCount && (
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums',
                charCount > 4000 ? 'text-red-400' : 'text-[#5a5a6a]'
              )}
            >
              {charCount.toLocaleString()} chars
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
