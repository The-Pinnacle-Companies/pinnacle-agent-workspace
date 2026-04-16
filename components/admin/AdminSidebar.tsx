'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Shield,
  ScrollText,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminNavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description?: string
}

const NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    icon: LayoutDashboard,
    label: 'Dashboard',
    description: 'Overview & stats',
  },
  {
    href: '/admin/agents',
    icon: Bot,
    label: 'Agents',
    description: 'Manage AI agents',
  },
  {
    href: '/admin/access-policies',
    icon: Shield,
    label: 'Access Policies',
    description: 'Groups & permissions',
  },
  {
    href: '/admin/audit-logs',
    icon: ScrollText,
    label: 'Audit Logs',
    description: 'Activity history',
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col w-56 min-w-[224px] max-w-[224px] h-full bg-[#1a1a1f] border-r border-[rgba(255,255,255,0.06)]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <Link
          href="/"
          className="flex items-center gap-2 text-[#5a5a6a] hover:text-[#8b8b9a] transition-colors text-sm mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Workspace
        </Link>

        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: '#7C3AED' }}
          >
            ⚙️
          </span>
          <div>
            <p className="text-sm font-semibold text-[#f0f0f2]">Admin Panel</p>
            <p className="text-[10px] text-[#3a3a4a] uppercase tracking-wide">
              Pinnacle AI
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all relative',
                active
                  ? 'bg-[rgba(124,58,237,0.15)] text-[#f0f0f2]'
                  : 'text-[#5a5a6a] hover:text-[#8b8b9a] hover:bg-[rgba(255,255,255,0.04)]'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#7C3AED]" />
              )}

              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-[#7C3AED]' : 'text-[#3a3a4a] group-hover:text-[#5a5a6a]'
                )}
              />

              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    'text-sm font-medium',
                    active ? 'text-[#f0f0f2]' : 'text-inherit'
                  )}
                >
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-[10px] text-[#3a3a4a] group-hover:text-[#5a5a6a] transition-colors">
                    {item.description}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
        <p className="text-[10px] text-[#3a3a4a] text-center">
          Pinnacle AI Workspace Admin
        </p>
      </div>
    </aside>
  )
}
