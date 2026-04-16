'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'
import { AgentStatusBadge } from '@/components/agents/AgentStatusBadge'
import { AgentCapabilityChips } from '@/components/agents/AgentCapabilityChips'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@prisma/client'

interface AgentCardProps {
  id: string
  slug: string
  name: string
  description?: string | null
  shortTagline?: string | null
  avatarUrl?: string | null
  brandColor?: string | null
  status: AgentStatus
  capabilities: string[]
  subAgentCount?: number
  className?: string
}

export function AgentCard({
  id,
  name,
  description,
  shortTagline,
  avatarUrl,
  brandColor,
  status,
  capabilities,
  subAgentCount = 0,
  className,
}: AgentCardProps) {
  const color = brandColor ?? '#7C3AED'

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.998 }}
      transition={{ duration: 0.15 }}
    >
      <Link href={`/agents/${id}`} className="block h-full focus-visible:outline-none">
        <div
          className={cn(
            'group relative flex flex-col h-full rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#141416] p-5 overflow-hidden',
            'hover:border-[rgba(255,255,255,0.14)] hover:bg-[#1a1a1f]',
            'transition-all duration-200 cursor-pointer',
            'focus-visible:ring-2 focus-visible:ring-[#7C3AED]',
            className
          )}
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 60% at 20% 40%, ${color}08, transparent 70%)`,
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
            }}
          />

          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar */}
            <div
              className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold text-white"
              style={{
                backgroundColor: color,
                boxShadow: `0 4px 12px ${color}40`,
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                name[0].toUpperCase()
              )}
            </div>

            {/* Name + tagline */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[#f0f0f2] truncate">{name}</h3>
              {shortTagline && (
                <p className="text-xs text-[#5a5a6a] truncate mt-0.5">{shortTagline}</p>
              )}
            </div>

            {/* Status */}
            <AgentStatusBadge status={status} showLabel={false} />
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-[#8b8b9a] leading-relaxed mb-3 line-clamp-2 flex-1">
              {description}
            </p>
          )}

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="mb-3">
              <AgentCapabilityChips capabilities={capabilities} maxShow={3} />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-[rgba(255,255,255,0.06)]">
            <AgentStatusBadge status={status} />

            {subAgentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-[#5a5a6a]">
                <Bot className="h-3.5 w-3.5" />
                {subAgentCount} sub-agent{subAgentCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
