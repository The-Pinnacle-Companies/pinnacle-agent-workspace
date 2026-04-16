'use client'

import { motion } from 'framer-motion'
import { Hash, Sparkles } from 'lucide-react'

interface EmptyChannelStateProps {
  channelName: string
  agentName: string
  agentBrandColor?: string
  agentAvatarUrl?: string | null
  onStartConversation?: () => void
}

export function EmptyChannelState({
  channelName,
  agentName,
  agentBrandColor = '#7C3AED',
  agentAvatarUrl,
  onStartConversation,
}: EmptyChannelStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 select-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col items-center text-center max-w-md"
      >
        {/* Agent avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative mb-6"
        >
          <div
            className="h-24 w-24 rounded-3xl flex items-center justify-center text-4xl font-bold text-white shadow-2xl"
            style={{
              backgroundColor: agentBrandColor,
              boxShadow: `0 16px 48px ${agentBrandColor}50`,
            }}
          >
            {agentAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agentAvatarUrl}
                alt={agentName}
                className="h-full w-full rounded-3xl object-cover"
              />
            ) : (
              agentName[0].toUpperCase()
            )}
          </div>

          {/* Sparkle decoration */}
          <motion.div
            className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1f] border border-[rgba(255,255,255,0.1)]"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="h-4 w-4" style={{ color: agentBrandColor }} />
          </motion.div>
        </motion.div>

        {/* Channel name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="flex items-center gap-2 mb-3"
        >
          <Hash className="h-6 w-6 text-[#5a5a6a]" />
          <h2 className="text-2xl font-bold text-[#f0f0f2]">
            Welcome to #{channelName}
          </h2>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-sm text-[#8b8b9a] leading-relaxed mb-6"
        >
          This is the beginning of your{' '}
          <span className="font-medium text-[#f0f0f2]">#{channelName}</span> channel
          with{' '}
          <span className="font-medium" style={{ color: agentBrandColor }}>
            {agentName}
          </span>
          .
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <button
            onClick={onStartConversation}
            className="group flex items-center gap-2.5 rounded-xl border border-dashed px-5 py-3 text-sm font-medium transition-all duration-200"
            style={{
              borderColor: `${agentBrandColor}40`,
              color: agentBrandColor,
              backgroundColor: `${agentBrandColor}0a`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${agentBrandColor}18`
              e.currentTarget.style.borderColor = `${agentBrandColor}70`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${agentBrandColor}0a`
              e.currentTarget.style.borderColor = `${agentBrandColor}40`
            }}
          >
            <Sparkles className="h-4 w-4" />
            <span>Start a conversation — ask {agentName} anything</span>
          </button>
        </motion.div>

        {/* Decorative dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 flex items-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: agentBrandColor }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
