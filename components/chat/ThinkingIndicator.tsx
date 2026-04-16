'use client'

import { motion } from 'framer-motion'

interface ThinkingIndicatorProps {
  agentName?: string
  agentColor?: string
}

export function ThinkingIndicator({
  agentName = 'Agent',
  agentColor = '#7C3AED',
}: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 select-none">
      {/* Orb container */}
      <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
        {/* Outer pulsing ring */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: agentColor }}
          animate={{
            scale: [1, 1.7, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Middle ring */}
        <motion.span
          className="absolute inset-1 rounded-full"
          style={{ backgroundColor: agentColor }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.5, 0.1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.1,
          }}
        />

        {/* Core orb */}
        <motion.span
          className="relative flex h-4 w-4 rounded-full"
          style={{ backgroundColor: agentColor }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.2,
          }}
        />
      </div>

      {/* Label */}
      <motion.p
        className="text-sm text-[#5a5a6a]"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="font-medium" style={{ color: agentColor }}>
          {agentName}
        </span>{' '}
        is thinking…
      </motion.p>
    </div>
  )
}
