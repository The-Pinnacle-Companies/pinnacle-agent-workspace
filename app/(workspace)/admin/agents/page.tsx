import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { Bot, Plus, Check, X } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Agent Registry' }

export default async function AdminAgentsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PLATFORM_ADMIN' && session.user.role !== 'AGENT_ADMIN') {
    redirect('/')
  }

  const agents = await prisma.agwsAgent.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      subAgents: { orderBy: { sortOrder: 'asc' } },
      channels: { orderBy: { sortOrder: 'asc' } },
      _count: {
        select: {
          accessPolicies: true,
        },
      },
    },
  })

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-emerald-400 bg-emerald-400/10',
    INACTIVE: 'text-slate-500 bg-slate-500/10',
    MAINTENANCE: 'text-amber-400 bg-amber-400/10',
  }

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title="Agent Registry"
        subtitle="Manage AI agents and their configuration"
        icon={<Bot className="w-4 h-4" />}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                             bg-friday text-white hover:bg-friday-light transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Agent
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-workspace-card border border-workspace-border rounded-xl overflow-hidden"
              >
                {/* Agent header row */}
                <div className="p-4 flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${agent.brandColor || '#7C3AED'}, ${agent.brandColorDark || '#6D28D9'})`,
                    }}
                  >
                    {agent.name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-semibold">{agent.name}</span>
                      <span className="font-mono text-xs text-slate-600">/{agent.slug}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[agent.status]}`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm line-clamp-2">{agent.description}</p>

                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        {agent.subAgents.length} sub-agents
                      </span>
                      <span className="flex items-center gap-1">
                        # {agent.channels.length} channels
                      </span>
                      <span className="flex items-center gap-1">
                        {agent._count.accessPolicies} access policies
                      </span>
                      <span className="flex items-center gap-1">
                        Adapter: {agent.adapterType}
                      </span>
                      {agent.ownerTeam && (
                        <span className="flex items-center gap-1">
                          Team: {agent.ownerTeam}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="px-3 py-1.5 text-xs rounded-lg border border-workspace-border
                                       text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>

                {/* Gateway URL */}
                {agent.openclawGateway && (
                  <div className="px-4 py-2.5 border-t border-workspace-border bg-workspace-hover/50 flex items-center gap-2">
                    <span className="text-slate-600 text-xs">Gateway:</span>
                    <code className="text-violet-400 text-xs font-mono">{agent.openclawGateway}</code>
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                      <Check className="w-3 h-3" />
                      Connected
                    </div>
                  </div>
                )}

                {/* Sub-agents */}
                {agent.subAgents.length > 0 && (
                  <div className="px-4 py-3 border-t border-workspace-border">
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">
                      Sub-agents
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {agent.subAgents.map((sa) => (
                        <div
                          key={sa.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                                     bg-workspace-hover border border-workspace-border"
                          style={{ color: sa.brandColor || '#6B7280' }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: sa.brandColor || '#6B7280' }}
                          />
                          {sa.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {agents.length === 0 && (
            <div className="text-center py-16">
              <Bot className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-white font-semibold text-lg mb-2">No agents configured</h3>
              <p className="text-slate-500 text-sm mb-4">
                Add your first AI agent to get started.
              </p>
              <button className="px-4 py-2 rounded-lg bg-friday text-white text-sm font-medium hover:bg-friday-light transition-colors">
                Add Agent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
