'use client'

import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingMessageProps {
  content: string
  isStreaming: boolean
  agentColor?: string
}

export function StreamingMessage({
  content,
  isStreaming,
  agentColor = '#7C3AED',
}: StreamingMessageProps) {
  return (
    <span className="relative">
      <span className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </span>

      {/* Blinking cursor at end of streaming content */}
      <AnimatePresence>
        {isStreaming && (
          <motion.span
            key="cursor"
            className="inline-block w-0.5 h-4 rounded-full ml-0.5 align-text-bottom"
            style={{ backgroundColor: agentColor }}
            animate={{ opacity: [1, 0, 1] }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'steps(1)',
            }}
          />
        )}
      </AnimatePresence>
    </span>
  )
}
