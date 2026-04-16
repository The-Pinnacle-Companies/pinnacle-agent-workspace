import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { Users, Plus, Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Access Policies' }

export default async function AdminAccessPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'PLATFORM_ADMIN') {
    redirect('/admin')
  }

  const policies = await prisma.agwsAccessPolicy.findMany({
    include: {
      agent: { select: { id: true, name: true, brandColor: true } },
      group: { select: { id: true, displayName: true, entraId: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const overrides = await prisma.agwsUserAgentOverride.findMany({
    include: {
      user: { select: { displayName: true, email: true } },
      agent: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const allGroups = await prisma.agwsEntraGroup.findMany({
    orderBy: { displayName: 'asc' },
  })

  const agentsByGroup = policies.reduce(
    (acc, policy) => {
      const groupId = policy.groupId
      if (!acc[groupId]) {
        acc[groupId] = { group: policy.group, agents: [] }
      }
      acc[groupId].agents.push({ ...policy.agent, role: policy.role })
      return acc
    },
    {} as Record<
      string,
      {
        group: { id: string; displayName: string; entraId: string }
        agents: { id: string; name: string; brandColor: string | null; role: string }[]
      }
    >
  )

  return (
    <div className="flex flex-col h-full">
      <WorkspaceHeader
        title="Access Policies"
        subtitle="Control which Entra groups can access which agents"
        icon={<Shield className="w-4 h-4" />}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                             bg-friday text-white hover:bg-friday-light transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Policy
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Group → Agent policies */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Group Access Policies
            </h2>

            {Object.keys(agentsByGroup).length > 0 ? (
              <div className="space-y-3">
                {Object.values(agentsByGroup).map(({ group, agents }) => (
                  <div
                    key={group.id}
                    className="p-4 bg-workspace-card border border-workspace-border rounded-xl"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-white font-medium">{group.displayName}</span>
                        </div>
                        <code className="text-slate-600 text-xs font-mono mt-0.5 block">
                          {group.entraId}
                        </code>
                      </div>
                      <button className="text-xs text-slate-600 hover:text-slate-400 px-2 py-1 rounded border border-workspace-border transition-colors">
                        Edit
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border"
                          style={{
                            backgroundColor: `${agent.brandColor || '#7C3AED'}15`,
                            borderColor: `${agent.brandColor || '#7C3AED'}30`,
                            color: agent.brandColor || '#7C3AED',
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: agent.brandColor || '#7C3AED' }}
                          >
                            {agent.name[0]}
                          </div>
                          {agent.name}
                          <span className="text-xs opacity-60 ml-1">({agent.role})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-workspace-card border border-workspace-border rounded-xl">
                <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No access policies configured yet.</p>
                <p className="text-slate-600 text-xs mt-1">
                  Add policies to control which Entra groups can access each agent.
                </p>
              </div>
            )}
          </section>

          {/* All groups */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Synced Entra Groups ({allGroups.length})
            </h2>
            <div className="bg-workspace-card border border-workspace-border rounded-xl overflow-hidden">
              {allGroups.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-workspace-border">
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Group</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Entra ID</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workspace-border">
                    {allGroups.map((group) => (
                      <tr key={group.id} className="hover:bg-workspace-hover transition-colors">
                        <td className="px-4 py-2.5 text-white font-medium">{group.displayName}</td>
                        <td className="px-4 py-2.5">
                          <code className="text-violet-400 text-xs font-mono">{group.entraId}</code>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                          {new Date(group.syncedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No Entra groups synced yet. Groups sync automatically when users sign in.
                </div>
              )}
            </div>
          </section>

          {/* User overrides */}
          {overrides.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                User Overrides
              </h2>
              <div className="bg-workspace-card border border-workspace-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-workspace-border">
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Agent</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Access</th>
                      <th className="text-left px-4 py-3 text-slate-500 font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workspace-border">
                    {overrides.map((override) => (
                      <tr key={override.id} className="hover:bg-workspace-hover transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="text-white text-sm">{override.user.displayName}</div>
                          <div className="text-slate-600 text-xs">{override.user.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{override.agent.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              override.access === 'GRANT'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {override.access}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">
                          {override.expiresAt
                            ? new Date(override.expiresAt).toLocaleDateString()
                            : 'Never'}
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
