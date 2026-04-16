import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserAgents } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { Home, Hash, MessageSquare, ChevronRight } from 'lucide-react'

export default async function HomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const agents = await getUserAgents(session.user)

  // Get recent messages across all accessible agents
  const recentConversations = await prisma.agwsConversation.findMany({
    where: {
      agentId: { in: agents.map((a) => a.id) },
      lastMessageAt: { not: null },
    },
    include: {
      agent: {
        select: { id: true, name: true, brandColor: true, slug: true },
      },
      channel: {
        select: { id: true, name: true },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          content: true,
          createdAt: true,
          authorType: true,
          author: { select: { displayName: true } },
        },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 8,
  })

  const firstName = session.user.name?.split(' ')[0] || 'there'

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title="Home"
        subtitle="Your Pinnacle AI workspace"
        icon={<Home className="w-4 h-4" />}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* Welcome */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Good {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-slate-400">
              Here&apos;s what&apos;s happening in your AI workspace today.
            </p>
          </div>

          {/* Quick access agents */}
          {agents.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Your Agents
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agents.map(async (agent) => {
                  const defaultChannel = await prisma.agwsChannel.findFirst({
                    where: { agentId: agent.id, isDefault: true },
                  })

                  return (
                    <Link
                      key={agent.id}
                      href={
                        defaultChannel
                          ? `/agents/${agent.id}/channels/${defaultChannel.id}`
                          : `/agents/${agent.id}`
                      }
                      className="group flex items-center gap-3 p-4 rounded-xl bg-workspace-card border border-workspace-border
                                 hover:border-slate-600 hover:bg-workspace-hover transition-all duration-150"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${agent.brandColor || '#7C3AED'}, ${agent.brandColor || '#7C3AED'}cc)`,
                          boxShadow: `0 4px 12px ${agent.brandColor || '#7C3AED'}30`,
                        }}
                      >
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm">{agent.name}</div>
                        <div className="text-slate-500 text-xs truncate">
                          {agent.shortTagline || agent.description?.substring(0, 50) || 'AI Agent'}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Empty state for no agents */}
          {agents.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-white font-semibold text-lg mb-2">No agents available yet</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Ask your administrator to grant you access to an AI agent to get started.
              </p>
            </div>
          )}

          {/* Recent activity */}
          {recentConversations.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Recent Activity
              </h2>
              <div className="space-y-2">
                {recentConversations.map((conv) => {
                  const lastMessage = conv.messages[0]
                  if (!lastMessage) return null

                  const brandColor = conv.agent?.brandColor || '#7C3AED'
                  const href = conv.channel
                    ? `/agents/${conv.agentId}/channels/${conv.channelId}`
                    : `/dm/${conv.agentId}`

                  return (
                    <Link
                      key={conv.id}
                      href={href}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-workspace-hover transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: brandColor }}
                      >
                        {conv.agent?.name[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white text-sm font-medium">
                            {conv.agent?.name}
                          </span>
                          {conv.channel && (
                            <span className="text-slate-600 text-xs flex items-center gap-0.5">
                              <Hash className="w-3 h-3" />
                              {conv.channel.name}
                            </span>
                          )}
                          {conv.type === 'DIRECT_MESSAGE' && (
                            <span className="text-slate-600 text-xs flex items-center gap-0.5">
                              <MessageSquare className="w-3 h-3" />
                              DM
                            </span>
                          )}
                          <span className="text-slate-600 text-xs ml-auto">
                            {formatRelativeTime(lastMessage.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs truncate">
                          {lastMessage.authorType === 'AGENT'
                            ? conv.agent?.name + ': '
                            : (lastMessage.author?.displayName || 'You') + ': '}
                          {lastMessage.content.substring(0, 80).replace(/[#*`]/g, '')}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
