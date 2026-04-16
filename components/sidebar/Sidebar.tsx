'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import {
  Home,
  ChevronDown,
  Hash,
  Bot,
  LogOut,
  Settings,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { AgentWithAccess } from '@/lib/access'
import type { SessionUser } from '@/lib/types'
import type { AgwsConversation } from '@prisma/client'

interface SidebarProps {
  agents: AgentWithAccess[]
  user: SessionUser
  dmConversations: (AgwsConversation & { agent?: { name: string; brandColor?: string | null } | null })[]
}

interface AgentSection {
  agent: AgentWithAccess
  expanded: boolean
}

export function Sidebar({ agents, user, dmConversations }: SidebarProps) {
  const pathname = usePathname()
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>(
    Object.fromEntries(agents.map((a) => [a.id, true]))
  )

  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }))
  }

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="flex flex-col w-60 min-w-[240px] max-w-[240px] h-full bg-[#111118] border-r border-white/5">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-white/5 flex-shrink-0">
        <span className="text-xl">🏔️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">Pinnacle AI</p>
          <p className="text-xs text-white/30 truncate">Workspace</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
            pathname === '/'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          )}
        >
          <Home className="h-4 w-4 flex-shrink-0" />
          <span>Home</span>
        </Link>

        {/* DMs */}
        {dmConversations.length > 0 && (
          <div className="mt-4">
            <p className="px-2 py-1 text-xs font-semibold text-white/30 uppercase tracking-wider">
              Direct Messages
            </p>
            {dmConversations.map((dm) => (
              <Link
                key={dm.id}
                href={`/dm/${dm.agentId}`}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
                  pathname === `/dm/${dm.agentId}`
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                <div
                  className="h-4 w-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dm.agent?.brandColor ?? '#7c3aed' }}
                />
                <span className="truncate">{dm.agent?.name ?? 'Agent'}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Agents */}
        {agents.map((agent) => (
          <div key={agent.id} className="mt-4">
            {/* Agent header */}
            <button
              onClick={() => toggleAgent(agent.id)}
              className="w-full flex items-center gap-2 px-2 py-1 text-white/40 hover:text-white/70 transition-colors group"
            >
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform flex-shrink-0',
                  !expandedAgents[agent.id] && '-rotate-90'
                )}
              />
              <div
                className="h-4 w-4 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: agent.brandColor ?? '#7c3aed' }}
              >
                {agent.name[0]}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider truncate">
                {agent.name}
              </span>
            </button>

            {expandedAgents[agent.id] && (
              <div className="ml-2 mt-0.5 space-y-0.5">
                {/* Channels */}
                {agent.channels.map((channel) => (
                  <Link
                    key={channel.id}
                    href={`/agents/${agent.id}/channels/${channel.id}`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors',
                      pathname === `/agents/${agent.id}/channels/${channel.id}`
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </Link>
                ))}

                {/* Sub-agents */}
                {agent.subAgents.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/dm/${agent.id}?subAgentId=${sub.id}`}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors',
                      'text-white/40 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Bot className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{sub.name}</span>
                  </Link>
                ))}

                {/* DM link */}
                <Link
                  href={`/dm/${agent.id}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors',
                    pathname === `/dm/${agent.id}`
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">Message {agent.name}</span>
                </Link>
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/5 p-3 flex items-center gap-2.5 flex-shrink-0">
        <Avatar className="h-8 w-8">
          {user.image && <AvatarImage src={user.image} />}
          <AvatarFallback className="text-xs bg-violet-700">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
          <p className="text-xs text-white/30 truncate">{user.email}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {user.role === 'PLATFORM_ADMIN' && (
            <Link
              href="/admin"
              className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Admin"
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
