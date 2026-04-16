'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Settings,
  MessageCircle,
  ChevronDown,
  ChevronsUpDown,
  Bot,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserMenu } from '@/components/auth/UserMenu'
import { AgentSection } from '@/components/layout/AgentSection'
import { cn } from '@/lib/utils'
import type { AgentWithSidebarData, SessionUser, DmConversation } from '@/lib/types'
import { formatDistanceToNow } from '@/lib/date-utils'

interface SidebarProps {
  agents: AgentWithSidebarData[]
  currentPath: string
  user: SessionUser
  dmConversations: DmConversation[]
}

function SectionHeader({
  label,
  action,
}: {
  label: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1 mb-0.5">
      <span className="text-[0.6875rem] font-semibold text-[#3a3a4a] uppercase tracking-widest">
        {label}
      </span>
      {action}
    </div>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  isActive,
  accentColor,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
  isActive: boolean
  accentColor?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-md text-sm transition-colors relative',
        isActive
          ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f2] font-medium'
          : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
          style={{ backgroundColor: accentColor ?? '#7C3AED' }}
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#8b8b9a]' : 'text-[#3a3a4a] group-hover:text-[#5a5a6a]')} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 bg-[#7C3AED] text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ agents, user, dmConversations }: SidebarProps) {
  const pathname = usePathname()
  const [agentsCollapsed, setAgentsCollapsed] = useState(false)
  const [dmsCollapsed, setDmsCollapsed] = useState(false)

  const isAdmin = user.role === 'PLATFORM_ADMIN'

  // Recent threads — last 5 DM conversations
  const recentThreads = dmConversations.slice(0, 5)

  return (
    <aside className="flex flex-col w-60 min-w-[240px] max-w-[240px] h-full bg-[#1a1a1f] border-r border-[rgba(255,255,255,0.06)] overflow-hidden">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <span className="text-xl leading-none" role="img" aria-label="mountain">
          🏔️
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#f0f0f2] leading-tight">Pinnacle AI</span>
          <span className="text-[0.625rem] text-[#3a3a4a] leading-tight uppercase tracking-wider">
            Agent Workspace
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 py-2">
        <div className="px-1 space-y-0.5">
          {/* Home nav */}
          <div className="mb-3">
            <NavItem
              href="/"
              icon={Home}
              label="Home"
              isActive={pathname === '/'}
              accentColor="#7C3AED"
            />
          </div>

          {/* Agents section */}
          <div className="mb-2">
            <button
              onClick={() => setAgentsCollapsed((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1 mb-0.5 hover:text-[#5a5a6a] transition-colors focus-visible:outline-none"
            >
              <span className="text-[0.6875rem] font-semibold text-[#3a3a4a] hover:text-[#5a5a6a] uppercase tracking-widest transition-colors">
                Agents
              </span>
              <motion.span
                animate={{ rotate: agentsCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-3 w-3 text-[#3a3a4a]" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {!agentsCollapsed && (
                <motion.div
                  key="agents"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {agents.map((agent) => (
                    <AgentSection key={agent.id} agent={agent} />
                  ))}

                  {agents.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[#3a3a4a]">
                      No agents available
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator className="my-2 mx-2 w-[calc(100%-1rem)]" />

          {/* Direct Messages */}
          <div className="mb-2">
            <button
              onClick={() => setDmsCollapsed((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1 mb-0.5 hover:text-[#5a5a6a] transition-colors focus-visible:outline-none"
            >
              <span className="text-[0.6875rem] font-semibold text-[#3a3a4a] hover:text-[#5a5a6a] uppercase tracking-widest transition-colors">
                Direct Messages
              </span>
              <motion.span
                animate={{ rotate: dmsCollapsed ? -90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-3 w-3 text-[#3a3a4a]" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {!dmsCollapsed && (
                <motion.div
                  key="dms"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {dmConversations.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[#3a3a4a]">
                      No conversations yet
                    </div>
                  ) : (
                    dmConversations.map((dm) => {
                      const href = `/dm/${dm.id}`
                      const isActive = pathname === href

                      return (
                        <Link
                          key={dm.id}
                          href={href}
                          className={cn(
                            'group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md transition-colors relative',
                            isActive
                              ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f2]'
                              : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
                          )}
                        >
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                              style={{ backgroundColor: dm.agentBrandColor ?? '#7C3AED' }}
                            />
                          )}

                          {/* Agent avatar dot */}
                          <span className="relative shrink-0">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
                              style={{ backgroundColor: dm.agentBrandColor ?? '#7C3AED' }}
                            >
                              {dm.agentName[0].toUpperCase()}
                            </span>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#1a1a1f]',
                                dm.agentStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-[#3a3a4a]'
                              )}
                            />
                          </span>

                          <div className="flex flex-1 items-center justify-between min-w-0">
                            <span className="text-[0.8125rem] truncate">{dm.agentName}</span>
                            {dm.unreadCount > 0 && (
                              <span
                                className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 text-white shrink-0"
                                style={{ backgroundColor: dm.agentBrandColor ?? '#7C3AED' }}
                              >
                                {dm.unreadCount}
                              </span>
                            )}
                          </div>
                        </Link>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent threads */}
          {recentThreads.length > 0 && (
            <div className="mb-2">
              <SectionHeader label="Recent Threads" />
              {recentThreads.map((thread) => {
                const href = `/dm/${thread.id}`
                const isActive = pathname === href
                return (
                  <Link
                    key={thread.id}
                    href={href}
                    className={cn(
                      'group flex items-center gap-2 px-2 py-1 mx-1 rounded-md transition-colors relative',
                      isActive
                        ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f2]'
                        : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
                    )}
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[0.8125rem] truncate flex-1">
                      {thread.agentName}
                    </span>
                    {thread.lastMessageAt && (
                      <span className="text-[0.65rem] text-[#3a3a4a] shrink-0">
                        {formatDistanceToNow(thread.lastMessageAt)}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom section */}
      <div className="border-t border-[rgba(255,255,255,0.06)] p-2">
        {isAdmin && (
          <NavItem
            href="/admin"
            icon={Settings}
            label="Admin Panel"
            isActive={pathname.startsWith('/admin')}
            accentColor="#7C3AED"
          />
        )}

        {/* User card */}
        <div className="mt-1 px-1">
          <UserMenu user={user} align="end" side="top" />
        </div>
      </div>
    </aside>
  )
}
