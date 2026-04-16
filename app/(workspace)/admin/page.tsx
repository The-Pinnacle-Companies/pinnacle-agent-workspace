import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { Shield, Bot, Users, Activity, ChevronRight } from 'lucide-react'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  if (session.user.role !== 'PLATFORM_ADMIN' && session.user.role !== 'AGENT_ADMIN') {
    redirect('/')
  }

  // Admin stats
  const [agentCount, userCount, messageCount, auditCount] = await Promise.all([
    prisma.agwsAgent.count(),
    prisma.agwsUser.count(),
    prisma.agwsMessage.count({ where: { deletedAt: null } }),
    prisma.agwsAuditLog.count(),
  ])

  const recentAuditLogs = await prisma.agwsAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { displayName: true, email: true } },
    },
  })

  const stats = [
    { label: 'Agents', value: agentCount, icon: Bot, color: '#7C3AED', href: '/admin/agents' },
    { label: 'Users', value: userCount, icon: Users, color: '#0EA5E9', href: '/admin/access' },
    { label: 'Messages', value: messageCount, icon: Activity, color: '#10B981', href: '#' },
    { label: 'Audit Events', value: auditCount, icon: Shield, color: '#F59E0B', href: '#' },
  ]

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title="Admin"
        subtitle="Platform administration"
        icon={<Shield className="w-4 h-4" />}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">
              Manage agents, access policies, and monitor platform usage.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="p-4 rounded-xl bg-workspace-card border border-workspace-border
                             hover:border-slate-600 transition-all group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${stat.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <div className="text-2xl font-bold text-white mb-0.5">{stat.value}</div>
                  <div className="text-slate-500 text-sm">{stat.label}</div>
                </Link>
              )
            })}
          </div>

          {/* Quick links */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Administration
            </h2>
            <div className="space-y-2">
              {[
                { href: '/admin/agents', icon: Bot, label: 'Agent Registry', desc: 'Manage agents and their configuration' },
                { href: '/admin/access', icon: Users, label: 'Access Policies', desc: 'Control which Entra groups can access which agents' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-4 p-4 rounded-xl bg-workspace-card border border-workspace-border
                               hover:border-slate-600 hover:bg-workspace-hover transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-workspace-hover flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{item.label}</div>
                      <div className="text-slate-500 text-sm">{item.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </Link>
                )
              })}
            </div>
          </section>

          {/* Recent audit log */}
          {recentAuditLogs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Recent Activity
              </h2>
              <div className="bg-workspace-card border border-workspace-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-workspace-border">
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Event</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workspace-border">
                    {recentAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-workspace-hover transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs text-violet-400">{log.action}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {log.user?.displayName || 'System'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
