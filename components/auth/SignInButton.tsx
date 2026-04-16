'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function MicrosoftLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 21 21"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

interface SignInButtonProps {
  callbackUrl?: string
  className?: string
}

export function SignInButton({ callbackUrl = '/', className }: SignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('microsoft-entra-id', { callbackUrl })
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={isLoading}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-5 py-3',
        'text-sm font-semibold text-gray-700 shadow-sm',
        'transition-all duration-200',
        'hover:shadow-md hover:border-gray-400 hover:bg-gray-50',
        'active:scale-[0.98] active:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f10]',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
        className
      )}
    >
      <span className="flex-shrink-0 w-5 h-5">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        ) : (
          <MicrosoftLogo />
        )}
      </span>
      <span className="whitespace-nowrap">
        {isLoading ? 'Signing in...' : 'Sign in with Microsoft'}
      </span>
    </button>
  )
}
