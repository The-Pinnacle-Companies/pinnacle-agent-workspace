import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { syncUserGroups } from '@/lib/entra'
import type { PlatformRole } from '@prisma/client'
import type { JWT } from 'next-auth/jwt'
import type { Session, User } from 'next-auth'

// Extend next-auth types to carry our custom fields
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      displayName: string
      role: PlatformRole
      entraId: string
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string           // Entra object ID (oid claim)
    email: string
    name: string
    dbUserId?: string
    role?: PlatformRole
    entraId?: string
    accessToken?: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // @ts-expect-error tenantId is a valid MicrosoftEntraID option but not typed in this version
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: 'openid profile email User.Read Group.Read.All',
        },
      },
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    /**
     * signIn — upsert AgwsUser in DB using Entra ID + email from profile,
     * then trigger group sync in the background (non-blocking on failure).
     */
    async signIn({ account, profile }) {
      if (!profile || !account) return true

      const entraId = profile.sub ?? (profile as Record<string, string>).oid ?? ''
      const email = profile.email ?? ''
      const displayName = profile.name ?? email

      if (!entraId || !email) {
        console.error('[auth] signIn: missing entraId or email in profile')
        return true // don't block login — user might see limited access
      }

      try {
        // Upsert user in our agws_users table
        const user = await prisma.agwsUser.upsert({
          where: { entraId },
          update: {
            email,
            displayName,
            lastLoginAt: new Date(),
          },
          create: {
            entraId,
            email,
            displayName,
            lastLoginAt: new Date(),
          },
        })

        // Trigger group sync in the background — don't block login if it fails
        if (account.access_token) {
          syncUserGroups(user.id, account.access_token).catch((err) => {
            console.error('[auth] Group sync failed (non-blocking):', err)
          })
        }
      } catch (err) {
        console.error('[auth] signIn upsert error (non-blocking):', err)
      }

      return true
    },

    /**
     * jwt — persist our DB user ID, role, and entraId in the token.
     * On initial sign-in (user object present), load from DB.
     * On subsequent requests, read from existing token.
     */
    async jwt({ token, account, profile }) {
      // First sign-in: profile and account are populated
      if (profile && account) {
        const entraId = profile.sub ?? (profile as Record<string, string>).oid ?? token.sub ?? ''
        token.entraId = entraId
        token.accessToken = account.access_token

        // Look up our DB user to get id and role
        if (entraId) {
          try {
            const dbUser = await prisma.agwsUser.findUnique({
              where: { entraId },
              select: { id: true, role: true },
            })
            if (dbUser) {
              token.dbUserId = dbUser.id
              token.role = dbUser.role
            }
          } catch (err) {
            console.error('[auth] jwt DB lookup error:', err)
          }
        }
      }

      // If role isn't loaded yet (e.g. DB was slow on first sign-in), try again
      if (!token.role && token.entraId) {
        try {
          const dbUser = await prisma.agwsUser.findUnique({
            where: { entraId: token.entraId },
            select: { id: true, role: true },
          })
          if (dbUser) {
            token.dbUserId = dbUser.id
            token.role = dbUser.role
          }
        } catch (err) {
          console.error('[auth] jwt role refresh error:', err)
        }
      }

      return token
    },

    /**
     * session — attach our custom fields to the session object exposed to the app.
     */
    async session({ session, token }: { session: Session; token: JWT }) {
      session.user = {
        id: token.dbUserId ?? '',
        email: token.email ?? session.user?.email ?? '',
        displayName: token.name ?? (session.user as { name?: string })?.name ?? '',
        role: token.role ?? 'MEMBER',
        entraId: token.entraId ?? token.sub ?? '',
        image: session.user?.image ?? null,
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})
