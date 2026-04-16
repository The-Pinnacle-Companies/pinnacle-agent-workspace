import {
  FileText,
  Search,
  Share2,
  BarChart2,
  Mail,
  Code,
  Database,
  Globe,
  Brain,
  Zap,
  Calendar,
  MessageSquare,
  Image,
  Settings,
  Shield,
  Layers,
  TrendingUp,
  PenTool,
  Megaphone,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentCapabilityChipsProps {
  capabilities: string[]
  className?: string
  maxShow?: number
}

function getIconForCapability(cap: string): LucideIcon {
  const lower = cap.toLowerCase()

  if (lower.includes('seo') || lower.includes('search')) return Search
  if (lower.includes('content') || lower.includes('writing') || lower.includes('copy')) return FileText
  if (lower.includes('social') || lower.includes('share')) return Share2
  if (lower.includes('analytic') || lower.includes('report') || lower.includes('insight')) return BarChart2
  if (lower.includes('email') || lower.includes('mail') || lower.includes('campaign')) return Mail
  if (lower.includes('code') || lower.includes('dev') || lower.includes('engineer')) return Code
  if (lower.includes('data') || lower.includes('database')) return Database
  if (lower.includes('web') || lower.includes('site') || lower.includes('online')) return Globe
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('intelligence')) return Brain
  if (lower.includes('automat') || lower.includes('workflow') || lower.includes('task')) return Zap
  if (lower.includes('calendar') || lower.includes('schedul')) return Calendar
  if (lower.includes('chat') || lower.includes('message') || lower.includes('support')) return MessageSquare
  if (lower.includes('image') || lower.includes('design') || lower.includes('visual')) return Image
  if (lower.includes('admin') || lower.includes('manage') || lower.includes('config')) return Settings
  if (lower.includes('security') || lower.includes('compliance') || lower.includes('audit')) return Shield
  if (lower.includes('integrat') || lower.includes('connect')) return Layers
  if (lower.includes('trend') || lower.includes('market')) return TrendingUp
  if (lower.includes('creat') || lower.includes('brand')) return PenTool
  if (lower.includes('advertis') || lower.includes('media')) return Megaphone
  if (lower.includes('team') || lower.includes('hr') || lower.includes('people')) return Users

  return Zap
}

export function AgentCapabilityChips({
  capabilities,
  className,
  maxShow,
}: AgentCapabilityChipsProps) {
  const displayed = maxShow ? capabilities.slice(0, maxShow) : capabilities
  const remaining = maxShow ? capabilities.length - maxShow : 0

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {displayed.map((cap) => {
        const Icon = getIconForCapability(cap)

        return (
          <span
            key={cap}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs text-[#8b8b9a] hover:border-[rgba(255,255,255,0.18)] hover:text-[#f0f0f2] transition-colors cursor-default"
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span>{cap}</span>
          </span>
        )
      })}

      {remaining > 0 && (
        <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-transparent px-2.5 py-1 text-xs text-[#5a5a6a]">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
