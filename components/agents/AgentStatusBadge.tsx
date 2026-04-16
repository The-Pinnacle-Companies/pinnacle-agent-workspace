'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@prisma/client'

interface AgentStatusBadgeProps {
  status: AgentStatus
  className?: string
  showLabel?: boolean
}

const statusConfig = {
  ACTIVE: {
    label: 'Online',
    dotColor: '#22c55e',
    textColor: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    pulse: true,
  },
  INACTIVE: {
    label: 'Offline',
    dotColor: '#5a5a6a',
    textColor: 'text-[#5a5a6a]',
    bgColor: 'bg-[rgba(255,255,255,0.05)]',
    borderColor: 'border-[rgba(255,255,255,0.08)]',
    pulse: false,
  },
  MAINTENANCE: {
    label: 'Maintenance',
    dotColor: '#f59e0b',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    pulse: false,
  },
} as const

export function AgentStatusBadge({
  status,
  className,
  showLabel = true,
}: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.bgColor,
        config.borderColor,
        config.textColor,
        className
      )}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {config.pulse ? (
          <>
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: config.dotColor }}
              animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: config.dotColor }}
            />
          </>
        ) : (
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: config.dotColor }}
          />
        )}
      </span>

      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
