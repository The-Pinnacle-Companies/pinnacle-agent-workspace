'use client'

import type React from 'react'
import { Settings } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AgentStatusBadge } from '@/components/agents/AgentStatusBadge'
import { AgentCapabilityChips } from '@/components/agents/AgentCapabilityChips'
import { cn } from '@/lib/utils'
import type { AgentWithChannels } from '@/lib/types'
import type { AgentAccessRole } from '@prisma/client'

interface AgentHeaderProps {
  agent: AgentWithChannels
  userRole?: AgentAccessRole | null
  compact?: boolean
  channelName?: string
  channelDescription?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

export function AgentHeader({ agent, userRole, compact, channelName, channelDescription }: AgentHeaderProps) {
  const canManage = userRole === 'AGENT_ADMIN'
  const brandColor = agent.brandColor ?? '#7C3AED'

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#141416]"
      style={{
        backgroundImage: `radial-gradient(ellipse 80% 60% at 20% 40%, ${brandColor}0d, transparent 70%)`,
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${brandColor}50, transparent)`,
        }}
      />

      <div className="px-6 py-5">
        {/* Top row: avatar + name + status + manage */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="h-[72px] w-[72px] shrink-0 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg"
            style={{
              backgroundColor: brandColor,
              boxShadow: `0 8px 32px ${brandColor}40`,
            }}
          >
            {agent.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.avatarUrl}
                alt={agent.name}
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              agent.name[0].toUpperCase()
            )}
          </div>

          {/* Name + tagline + status */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#f0f0f2]">{agent.name}</h1>
              <AgentStatusBadge status={agent.status} />
            </div>

            {agent.shortTagline && (
              <p className="text-sm text-[#8b8b9a] mt-0.5">{agent.shortTagline}</p>
            )}
          </div>

          {/* Manage button */}
          {canManage && (
            <div className="shrink-0">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href={`/admin/agents/${agent.id}`}>
                  <Settings className="h-4 w-4" />
                  Manage
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        {agent.description && (
          <p className="mt-4 text-sm text-[#8b8b9a] leading-relaxed max-w-2xl">
            {agent.description}
          </p>
        )}

        {/* Capabilities */}
        {agent.capabilities.length > 0 && (
          <div className="mt-4">
            <AgentCapabilityChips capabilities={agent.capabilities} />
          </div>
        )}

        {/* Footer: owner + access */}
        {agent.ownerTeam && (
          <div className="mt-4 flex items-center gap-4 text-xs text-[#5a5a6a]">
            <span>
              Owned by:{' '}
              <span className="text-[#8b8b9a]">{agent.ownerTeam}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
