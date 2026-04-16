'use client'

import * as Popover from '@radix-ui/react-popover'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/utils'

const COMMON_EMOJIS = [
  '😀', '😂', '🥰', '😮', '😢', '😡',
  '👍', '👎', '👏', '🙌', '🤝', '🤜',
  '❤️', '🔥', '🎉', '✅', '💯', '🚀',
  '👀', '🤔', '💡', '⚡', '🎯', '🔑',
]

interface ReactionPickerProps {
  onReact: (emoji: string) => void
  className?: string
}

export function ReactionPicker({ onReact, className }: ReactionPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-md text-[#5a5a6a] transition-colors',
            'hover:text-[#f0f0f2] hover:bg-[rgba(255,255,255,0.06)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]',
            className
          )}
          aria-label="Add reaction"
        >
          <Smile className="h-4 w-4" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 w-[220px] rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#1f1f24] p-2 shadow-xl shadow-black/50',
            'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
        >
          <div className="grid grid-cols-6 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <Popover.Close key={emoji} asChild>
                <button
                  onClick={() => onReact(emoji)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-lg transition-all',
                    'hover:bg-[rgba(255,255,255,0.1)] hover:scale-125',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]'
                  )}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
