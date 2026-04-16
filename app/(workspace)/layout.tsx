import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAgents } from '@/lib/access'
import { Sidebar } from '@/components/sidebar/Sidebar'
import type { SessionUser } from '@/lib/types'

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    entraId: session.user.entraId,
    image: session.user.image,
  }

  // Fetch accessible agents with channels and sub-agents
  const agents = await getUserAgents(user.id)

  // Fetch DM conversations for the current user
  const dmConversations = await prisma.agwsConversation.findMany({
    where: {
      type: 'DIRECT_MESSAGE',
      dmUserId: user.id,
      isArchived: false,
    },
    include: {
      agent: {
        select: { id: true, name: true, brandColor: true },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 20,
  })

  return (
    <div className="flex h-screen bg-[#0f0f18] text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        agents={agents}
        user={user}
        dmConversations={dmConversations}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
