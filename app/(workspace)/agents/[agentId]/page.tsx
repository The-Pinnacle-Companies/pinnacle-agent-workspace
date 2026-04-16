import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canAccessAgent } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { AgentHeader } from '@/components/agents/AgentHeader'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { Hash, MessageSquare, Bot, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

interface Params {
  params: { agentId: string }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const agent = await prisma.agwsAgent.findUnique({ where: { id: params.agentId } })
  return { title: agent?.name || 'Agent' }
}

export default async function AgentPage({ params }: Params) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { agentId } = params

  const hasAccess = await canAccessAgent(session.user, agentId)
  if (!hasAccess) notFound()

  const agent = await prisma.agwsAgent.findUnique({
    where: { id: agentId },
    include: {
      channels: {
        where: { isArchived: false },
        orderBy: { sortOrder: 'asc' },
      },
      subAgents: {
        where: { status: 'ACTIVE' },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!agent) notFound()

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title={agent.name}
        subtitle={agent.shortTagline || 'AI Agent'}
        icon={<Bot className="w-4 h-4" />}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Agent header */}
        <AgentHeader agent={agent} />

        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* Channels */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Channels
            </h2>
            <div className="space-y-2">
              {agent.channels.map((channel) => (
                <Link
                  key={channel.id}
                  href={`/agents/${agentId}/channels/${channel.id}`}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-workspace-card border border-workspace-border
                             hover:border-slate-600 hover:bg-workspace-hover transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-workspace-hover border border-workspace-border flex items-center justify-center">
                    <Hash className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">#{channel.name}</div>
                    {channel.description && (
                      <div className="text-slate-500 text-xs truncate">{channel.description}</div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* DM section */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Direct Message
            </h2>
            <Link
              href={`/dm/${agentId}`}
              className="group flex items-center gap-3 p-3 rounded-xl bg-workspace-card border border-workspace-border
                         hover:border-slate-600 hover:bg-workspace-hover transition-all"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: agent.brandColor || '#7C3AED' }}
              >
                {agent.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium">Chat with {agent.name}</div>
                <div className="text-slate-500 text-xs">Private, 1:1 conversation</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          </section>

          {/* Sub-agents */}
          {agent.subAgents.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Sub-agents
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agent.subAgents.map((subAgent) => (
                  <Link
                    key={subAgent.id}
                    href={`/dm/${agentId}?subAgent=${subAgent.id}`}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-workspace-card border border-workspace-border
                               hover:border-slate-600 hover:bg-workspace-hover transition-all"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: subAgent.brandColor || '#6B7280' }}
                    >
                      {subAgent.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">{subAgent.name}</div>
                      {subAgent.description && (
                        <div className="text-slate-500 text-xs truncate">
                          {subAgent.description.substring(0, 60)}
                        </div>
                      )}
                    </div>
                    <MessageSquare className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
