'use client'

import { signOut } from 'next-auth/react'
import { ChevronDown, User, Settings, LogOut, Shield } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UserMenuProps {
  user: SessionUser
  className?: string
  align?: 'start' | 'end' | 'center'
  side?: 'top' | 'bottom' | 'left' | 'right'
  compact?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function UserMenu({
  user,
  className,
  align = 'end',
  side = 'top',
  compact = false,
}: UserMenuProps) {
  const isAdmin = user.role === 'PLATFORM_ADMIN'
  const isAgentAdmin = user.role === 'AGENT_ADMIN' || isAdmin
  const initials = getInitials(user.displayName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg p-1.5 transition-colors',
            'hover:bg-[rgba(255,255,255,0.07)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]',
            className
          )}
        >
          <Avatar className={compact ? 'h-7 w-7' : 'h-8 w-8'}>
            {user.image && <AvatarImage src={user.image} alt={user.displayName} />}
            <AvatarFallback
              className="bg-[#7C3AED]/30 text-[#a78bfa] text-xs font-semibold"
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium text-[#f0f0f2] truncate max-w-[120px]">
                  {user.displayName}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#5a5a6a] shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        className="w-64"
      >
        {/* User info header */}
        <div className="flex items-center gap-3 px-3 py-3 mb-1">
          <Avatar className="h-10 w-10">
            {user.image && <AvatarImage src={user.image} alt={user.displayName} />}
            <AvatarFallback className="bg-[#7C3AED]/30 text-[#a78bfa] text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#f0f0f2] truncate">
              {user.displayName}
            </span>
            <span className="text-xs text-[#5a5a6a] truncate">{user.email}</span>
            {isAdmin && (
              <span className="text-xs text-[#7C3AED] font-medium mt-0.5">
                Platform Admin
              </span>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2.5">
          <User className="h-4 w-4 text-[#5a5a6a]" />
          <span>Profile</span>
        </DropdownMenuItem>

        {isAgentAdmin && (
          <DropdownMenuItem
            className="gap-2.5"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/admin'
              }
            }}
          >
            <Settings className="h-4 w-4 text-[#5a5a6a]" />
            <span>Admin</span>
            {isAdmin && (
              <span className="ml-auto">
                <Shield className="h-3.5 w-3.5 text-[#7C3AED]" />
              </span>
            )}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2.5 text-red-400 focus:text-red-400 focus:bg-red-500/10"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
