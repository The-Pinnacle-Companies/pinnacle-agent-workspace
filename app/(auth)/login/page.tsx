import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SignInButton } from '@/components/auth/SignInButton'

export const metadata = {
  title: 'Sign In — Pinnacle AI Workspace',
}

export default async function LoginPage() {
  // If already authenticated, redirect to home
  const session = await auth()
  if (session?.user?.id) {
    redirect('/')
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#0f0f10' }}>
      {/* CSS mountain decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Mountain shapes using CSS clip-path */}
        <div
          className="absolute bottom-0 left-0 right-0 opacity-[0.04]"
          style={{
            height: '60%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0891b2 100%)',
            clipPath: 'polygon(0% 100%, 10% 60%, 25% 80%, 40% 35%, 55% 65%, 70% 20%, 85% 55%, 100% 30%, 100% 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 opacity-[0.06]"
          style={{
            height: '40%',
            background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)',
            clipPath: 'polygon(0% 100%, 15% 70%, 35% 40%, 50% 60%, 65% 30%, 80% 50%, 95% 20%, 100% 40%, 100% 100%)',
          }}
        />
        {/* Geometric grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(124,58,237,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(124,58,237,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(124,58,237,0.3) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-2xl border border-white/10 p-8 shadow-2xl"
          style={{
            background: 'linear-gradient(145deg, rgba(26,26,46,0.95) 0%, rgba(15,15,25,0.98) 100%)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo area */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4 select-none" role="img" aria-label="Mountain">
              🏔️
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Pinnacle AI Workspace
            </h1>
            <p className="text-sm text-white/40 mt-2">
              Your team&apos;s AI operating layer
            </p>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#12121e] text-white/30">Secure sign-in</span>
            </div>
          </div>

          {/* Sign in button */}
          <SignInButton />

          {/* Info text */}
          <p className="text-xs text-white/25 text-center mt-4 leading-relaxed">
            Sign in with your Pinnacle Microsoft account.<br />
            Access is controlled by your Entra group memberships.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20 mt-6">
          Internal tool · The Pinnacle Companies · Secure sign-in via Microsoft
        </p>
      </div>
    </div>
  )
}
