'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Hash, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentWithSidebarData } from '@/lib/types'

interface AgentSectionProps {
  agent: AgentWithSidebarData
  defaultOpen?: boolean
}

function AgentAvatar({
  agent,
  size = 'sm',
}: {
  agent: Pick<AgentWithSidebarData, 'name' | 'avatarUrl' | 'brandColor'>
  size?: 'sm' | 'md'
}) {
  const sizeClasses = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm'

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-md font-bold shrink-0 text-white',
        sizeClasses
      )}
      style={{ backgroundColor: agent.brandColor ?? '#7C3AED' }}
    >
      {agent.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agent.avatarUrl}
          alt={agent.name}
          className={cn('rounded-md object-cover', sizeClasses)}
        />
      ) : (
        agent.name[0].toUpperCase()
      )}
    </span>
  )
}

export function AgentSection({ agent, defaultOpen = true }: AgentSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const pathname = usePathname()

  const agentBasePath = `/agents/${agent.id}`

  const isAgentActive = pathname.startsWith(agentBasePath)

  return (
    <div className="mb-1">
      {/* Agent header / toggle */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors',
          'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7C3AED]',
          isAgentActive && 'text-[#8b8b9a]'
        )}
      >
        <AgentAvatar agent={agent} size="sm" />

        <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide">
          {agent.name}
        </span>

        {agent.totalUnread > 0 && !isOpen && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: agent.brandColor ?? '#7C3AED' }}
          >
            {agent.totalUnread > 99 ? '99+' : agent.totalUnread}
          </span>
        )}

        <motion.span
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="py-0.5">
              {/* Channels */}
              {agent.channels.map((channel) => {
                const href = `/agents/${agent.id}/channels/${channel.id}`
                const isActive = pathname === href || pathname.startsWith(href + '/')

                return (
                  <Link
                    key={channel.id}
                    href={href}
                    className={cn(
                      'group flex items-center gap-1.5 px-2 py-1 mx-1 rounded-md text-sm transition-colors relative',
                      isActive
                        ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f2]'
                        : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                        style={{ backgroundColor: agent.brandColor ?? '#7C3AED' }}
                      />
                    )}

                    <Hash
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-[#8b8b9a]' : 'text-[#3a3a4a] group-hover:text-[#5a5a6a]'
                      )}
                    />

                    <span className="flex-1 truncate text-[0.8125rem]">{channel.name}</span>

                    {channel.unreadCount > 0 && (
                      <span
                        className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 text-white"
                        style={{ backgroundColor: agent.brandColor ?? '#7C3AED' }}
                      >
                        {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* Sub-agents */}
              {agent.subAgents.length > 0 && (
                <div className="mt-1">
                  {agent.subAgents.map((sub) => {
                    const href = `/agents/${agent.id}/sub-agents/${sub.id}`
                    const isActive = pathname === href || pathname.startsWith(href + '/')

                    return (
                      <Link
                        key={sub.id}
                        href={href}
                        className={cn(
                          'group flex items-center gap-1.5 px-2 py-1 mx-1 rounded-md text-sm transition-colors relative',
                          isActive
                            ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f2]'
                            : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
                        )}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                            style={{ backgroundColor: sub.brandColor ?? agent.brandColor ?? '#7C3AED' }}
                          />
                        )}

                        <Bot
                          className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            isActive ? 'text-[#8b8b9a]' : 'text-[#3a3a4a] group-hover:text-[#5a5a6a]'
                          )}
                        />

                        <span className="flex-1 truncate text-[0.8125rem]">{sub.name}</span>

                        {/* Status dot */}
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            sub.status === 'ACTIVE' ? 'bg-green-500' : 'bg-[#3a3a4a]'
                          )}
                        />
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
