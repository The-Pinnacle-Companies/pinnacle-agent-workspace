import { auth } from '@/lib/auth'
import { getUserAgents } from '@/lib/access'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agents = await getUserAgents(session.user.id)

    return NextResponse.json(agents)
  } catch (err) {
    console.error('[GET /api/agents]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
