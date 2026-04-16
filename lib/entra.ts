import { prisma } from '@/lib/prisma'

export interface GraphGroup {
  id: string
  displayName: string
}

interface GraphMemberOfResponse {
  value: Array<{
    '@odata.type'?: string
    id: string
    displayName?: string
  }>
  '@odata.nextLink'?: string
}

/**
 * Fetch all group memberships for the authenticated user from Microsoft Graph.
 * Handles pagination via @odata.nextLink automatically.
 */
export async function getUserGroups(accessToken: string): Promise<GraphGroup[]> {
  const groups: GraphGroup[] = []
  let url: string | undefined = 'https://graph.microsoft.com/v1.0/me/memberOf'

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `[entra] getUserGroups failed: ${response.status} ${response.statusText} — ${body}`
      )
    }

    const data: GraphMemberOfResponse = await response.json()

    for (const item of data.value) {
      // Only process security groups and Microsoft 365 groups
      const type = item['@odata.type'] ?? ''
      if (
        type === '#microsoft.graph.group' ||
        type === '#microsoft.graph.directoryRole' ||
        type === ''
      ) {
        if (item.id && item.displayName) {
          groups.push({
            id: item.id,
            displayName: item.displayName,
          })
        }
      }
    }

    url = data['@odata.nextLink']
  }

  return groups
}

/**
 * Sync a user's Entra group memberships into the DB.
 * Upserts AgwsEntraGroup rows, then upserts AgwsUserGroup join rows.
 * Any groups no longer present are removed from the join table.
 *
 * This is intentionally fault-tolerant — a partial sync is better than no sync.
 */
export async function syncUserGroups(userId: string, accessToken: string): Promise<void> {
  const groups = await getUserGroups(accessToken)

  if (groups.length === 0) {
    console.log(`[entra] syncUserGroups: no groups found for user ${userId}`)
    return
  }

  // Upsert all groups into agws_entra_groups
  const upsertedGroupIds: string[] = []

  for (const group of groups) {
    try {
      const upserted = await prisma.agwsEntraGroup.upsert({
        where: { entraId: group.id },
        update: {
          displayName: group.displayName,
          syncedAt: new Date(),
        },
        create: {
          entraId: group.id,
          displayName: group.displayName,
          syncedAt: new Date(),
        },
        select: { id: true },
      })
      upsertedGroupIds.push(upserted.id)
    } catch (err) {
      console.error(`[entra] Failed to upsert group ${group.id} (${group.displayName}):`, err)
    }
  }

  if (upsertedGroupIds.length === 0) {
    console.warn(`[entra] syncUserGroups: no groups successfully upserted for user ${userId}`)
    return
  }

  // Remove stale memberships (groups user no longer belongs to)
  await prisma.agwsUserGroup.deleteMany({
    where: {
      userId,
      groupId: {
        notIn: upsertedGroupIds,
      },
    },
  })

  // Upsert current memberships
  for (const groupId of upsertedGroupIds) {
    try {
      await prisma.agwsUserGroup.upsert({
        where: {
          userId_groupId: { userId, groupId },
        },
        update: {},
        create: {
          userId,
          groupId,
        },
      })
    } catch (err) {
      console.error(`[entra] Failed to upsert user-group join ${userId}/${groupId}:`, err)
    }
  }

  console.log(
    `[entra] syncUserGroups: synced ${upsertedGroupIds.length} groups for user ${userId}`
  )
}
