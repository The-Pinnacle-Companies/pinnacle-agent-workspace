import { Hash } from 'lucide-react'
import type { AgwsAgent, AgwsChannel } from '@prisma/client'

interface WorkspaceHeaderProps {
  agent?: AgwsAgent | null
  channel?: AgwsChannel | null
  title?: string
  subtitle?: string
}

export function WorkspaceHeader({ agent, channel, title, subtitle }: WorkspaceHeaderProps) {
  return (
    <header className="flex items-center gap-3 px-6 h-14 border-b border-white/5 bg-[#0f0f18] flex-shrink-0">
      {channel ? (
        <>
          <Hash className="h-5 w-5 text-white/40" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">{channel.name}</h1>
            {channel.description && (
              <p className="text-xs text-white/30 truncate">{channel.description}</p>
            )}
          </div>
          {agent && (
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <div
                className="h-4 w-4 rounded text-[10px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: agent.brandColor ?? '#7c3aed' }}
              >
                {agent.name[0]}
              </div>
              <span>{agent.name}</span>
            </div>
          )}
        </>
      ) : title ? (
        <>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-xs text-white/30">{subtitle}</p>}
          </div>
        </>
      ) : (
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">Pinnacle AI Workspace</h1>
        </div>
      )}
    </header>
  )
}
