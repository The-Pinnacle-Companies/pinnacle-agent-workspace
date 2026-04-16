'use client'

import { useState } from 'react'
import { Search, Bell, Hash, ChevronRight } from 'lucide-react'
import { UserMenu } from '@/components/auth/UserMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/lib/types'

interface BreadcrumbSegment {
  label: string
  href?: string
  isChannel?: boolean
}

interface WorkspaceHeaderProps {
  user: SessionUser
  breadcrumbs?: BreadcrumbSegment[]
  notificationCount?: number
  onSearch?: () => void
}

export function WorkspaceHeader({
  user,
  breadcrumbs = [],
  notificationCount = 0,
  onSearch,
}: WorkspaceHeaderProps) {
  const [searchHovered, setSearchHovered] = useState(false)

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[rgba(255,255,255,0.06)] bg-[#141416] shrink-0 z-20">
      {/* Left — breadcrumb */}
      <div className="flex items-center gap-1 min-w-0">
        {breadcrumbs.length === 0 ? (
          <span className="text-sm font-medium text-[#5a5a6a]">Pinnacle AI Workspace</span>
        ) : (
          breadcrumbs.map((segment, idx) => (
            <span key={idx} className="flex items-center gap-1 min-w-0">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-[#3a3a4a] shrink-0 mx-0.5" />
              )}
              <span
                className={cn(
                  'text-sm truncate',
                  idx === breadcrumbs.length - 1
                    ? 'font-semibold text-[#f0f0f2]'
                    : 'text-[#5a5a6a]'
                )}
              >
                {segment.isChannel && (
                  <Hash className="inline h-3.5 w-3.5 mr-0.5 text-[#5a5a6a] relative -top-px" />
                )}
                {segment.label}
              </span>
            </span>
          ))
        )}
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          onMouseEnter={() => setSearchHovered(true)}
          onMouseLeave={() => setSearchHovered(false)}
          onClick={onSearch}
          className="h-8 w-8 text-[#5a5a6a] hover:text-[#f0f0f2]"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[#5a5a6a] hover:text-[#f0f0f2] relative"
          aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount})` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[10px] font-bold text-white leading-none">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Button>

        {/* Separator */}
        <div className="h-5 w-px bg-[rgba(255,255,255,0.08)] mx-1" />

        {/* User menu */}
        <UserMenu user={user} align="end" side="bottom" compact />
      </div>
    </header>
  )
}
