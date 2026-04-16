import { PrismaClient, ConversationType, AuthorType, ContentType, PlatformRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding AI Agent Workspace...')

  await prisma.$transaction(async (tx) => {
    // ─── Friday Agent ───────────────────────────────────────────────────────
    const friday = await tx.agwsAgent.upsert({
      where: { slug: 'friday' },
      update: {
        name: 'Friday',
        shortTagline: 'Marketing AI',
        brandColor: '#7C3AED',
        brandColorDark: '#5B21B6',
        adapterType: 'mock',
        ownerTeam: 'Marketing',
        capabilities: ['Content', 'SEO', 'Social', 'Analytics'],
        description:
          "The Pinnacle Companies' marketing intelligence agent. Handles campaigns, content strategy, SEO, and social media.",
      },
      create: {
        slug: 'friday',
        name: 'Friday',
        shortTagline: 'Marketing AI',
        brandColor: '#7C3AED',
        brandColorDark: '#5B21B6',
        adapterType: 'mock',
        ownerTeam: 'Marketing',
        capabilities: ['Content', 'SEO', 'Social', 'Analytics'],
        description:
          "The Pinnacle Companies' marketing intelligence agent. Handles campaigns, content strategy, SEO, and social media.",
        sortOrder: 0,
      },
    })
    console.log(`  ✅ Agent: ${friday.name} (${friday.id})`)

    // ─── Friday Channels ────────────────────────────────────────────────────
    const channelDefs = [
      { slug: 'general', name: 'general', isDefault: true, sortOrder: 0 },
      { slug: 'campaigns', name: 'campaigns', isDefault: false, sortOrder: 1 },
      { slug: 'content', name: 'content', isDefault: false, sortOrder: 2 },
    ]

    const channels: Record<string, Awaited<ReturnType<typeof tx.agwsChannel.upsert>>> = {}

    for (const ch of channelDefs) {
      const channel = await tx.agwsChannel.upsert({
        where: { agentId_slug: { agentId: friday.id, slug: ch.slug } },
        update: {
          name: ch.name,
          isDefault: ch.isDefault,
          sortOrder: ch.sortOrder,
        },
        create: {
          agentId: friday.id,
          slug: ch.slug,
          name: ch.name,
          isDefault: ch.isDefault,
          sortOrder: ch.sortOrder,
        },
      })
      channels[ch.slug] = channel
      console.log(`  ✅ Channel: #${channel.name} (${channel.id})`)
    }

    // ─── Friday Sub-Agents ──────────────────────────────────────────────────
    const subAgentDefs = [
      {
        slug: 'seo',
        name: 'SEO Agent',
        brandColor: '#059669',
        capabilities: ['Keyword Research', 'Rankings', 'Technical SEO'],
        sortOrder: 0,
      },
      {
        slug: 'content',
        name: 'Content Agent',
        brandColor: '#7C3AED',
        capabilities: ['Blog Posts', 'Copy', 'Editing'],
        sortOrder: 1,
      },
      {
        slug: 'social',
        name: 'Social Agent',
        brandColor: '#0EA5E9',
        capabilities: ['Instagram', 'LinkedIn', 'Scheduling'],
        sortOrder: 2,
      },
      {
        slug: 'analytics',
        name: 'Analytics Agent',
        brandColor: '#F59E0B',
        capabilities: ['GA4', 'Reporting', 'Insights'],
        sortOrder: 3,
      },
    ]

    for (const sa of subAgentDefs) {
      const subAgent = await tx.agwsSubAgent.upsert({
        where: { agentId_slug: { agentId: friday.id, slug: sa.slug } },
        update: {
          name: sa.name,
          brandColor: sa.brandColor,
          capabilities: sa.capabilities,
          sortOrder: sa.sortOrder,
        },
        create: {
          agentId: friday.id,
          slug: sa.slug,
          name: sa.name,
          brandColor: sa.brandColor,
          capabilities: sa.capabilities,
          sortOrder: sa.sortOrder,
        },
      })
      console.log(`  ✅ Sub-agent: ${subAgent.name} (${subAgent.id})`)
    }

    // ─── Dev Admin User ─────────────────────────────────────────────────────
    const adminUser = await tx.agwsUser.upsert({
      where: { entraId: 'dev-admin-001' },
      update: {
        email: 'admin@thepinnaclecompanies.com',
        displayName: 'Dev Admin',
        role: PlatformRole.PLATFORM_ADMIN,
      },
      create: {
        entraId: 'dev-admin-001',
        email: 'admin@thepinnaclecompanies.com',
        displayName: 'Dev Admin',
        role: PlatformRole.PLATFORM_ADMIN,
      },
    })
    console.log(`  ✅ User: ${adminUser.displayName} (${adminUser.id}) [${adminUser.role}]`)

    // ─── Default Channel Conversations ──────────────────────────────────────
    // One CHANNEL_THREAD conversation per channel, linked to Friday
    const generalConversation = await tx.agwsConversation.upsert({
      where: {
        // There's no unique constraint on channelId alone, so we use a create-if-not-exists
        // pattern by checking first, then creating
        id: `conv-general-${friday.id}`,
      },
      update: {},
      create: {
        id: `conv-general-${friday.id}`,
        type: ConversationType.CHANNEL_THREAD,
        agentId: friday.id,
        channelId: channels['general'].id,
        title: 'General',
      },
    })
    console.log(`  ✅ Conversation: #general thread (${generalConversation.id})`)

    const campaignsConversation = await tx.agwsConversation.upsert({
      where: { id: `conv-campaigns-${friday.id}` },
      update: {},
      create: {
        id: `conv-campaigns-${friday.id}`,
        type: ConversationType.CHANNEL_THREAD,
        agentId: friday.id,
        channelId: channels['campaigns'].id,
        title: 'Campaigns',
      },
    })
    console.log(`  ✅ Conversation: #campaigns thread (${campaignsConversation.id})`)

    const contentConversation = await tx.agwsConversation.upsert({
      where: { id: `conv-content-${friday.id}` },
      update: {},
      create: {
        id: `conv-content-${friday.id}`,
        type: ConversationType.CHANNEL_THREAD,
        agentId: friday.id,
        channelId: channels['content'].id,
        title: 'Content',
      },
    })
    console.log(`  ✅ Conversation: #content thread (${contentConversation.id})`)

    // ─── Welcome System Message in #general ─────────────────────────────────
    // Check if a welcome message already exists to avoid duplication on re-seed
    const existingWelcome = await tx.agwsMessage.findFirst({
      where: {
        conversationId: generalConversation.id,
        authorType: AuthorType.SYSTEM,
        content: {
          contains: 'Welcome to Friday',
        },
      },
    })

    if (!existingWelcome) {
      const welcomeMsg = await tx.agwsMessage.create({
        data: {
          conversationId: generalConversation.id,
          authorType: AuthorType.SYSTEM,
          agentId: friday.id,
          content:
            "Welcome to Friday's general channel. Ask me anything about marketing strategy, campaigns, content, SEO, or social media.",
          contentType: ContentType.TEXT,
        },
      })

      // Update conversation lastMessageAt
      await tx.agwsConversation.update({
        where: { id: generalConversation.id },
        data: { lastMessageAt: welcomeMsg.createdAt },
      })

      console.log(`  ✅ Welcome message created (${welcomeMsg.id})`)
    } else {
      console.log(`  ⏭️  Welcome message already exists, skipping`)
    }
  })

  console.log('\n✨ Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
