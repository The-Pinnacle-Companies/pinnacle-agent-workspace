'use client'

import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'

interface FileUploadZoneProps {
  isActive: boolean
  agentColor?: string
}

export function FileUploadZone({ isActive, agentColor = '#7C3AED' }: FileUploadZoneProps) {
  if (!isActive) return null

  return (
    <motion.div
      key="upload-zone"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15, 15, 16, 0.88)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex flex-col items-center gap-4 pointer-events-none"
      >
        {/* Dashed border box */}
        <div
          className="flex flex-col items-center gap-4 px-16 py-12 rounded-2xl"
          style={{
            border: `2px dashed ${agentColor}60`,
            backgroundColor: `${agentColor}0a`,
          }}
        >
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Upload className="h-12 w-12" style={{ color: agentColor }} />
          </motion.div>

          <div className="text-center">
            <p className="text-lg font-semibold text-[#f0f0f2]">Drop files to attach</p>
            <p className="text-sm text-[#8b8b9a] mt-1">
              Images, documents, and more
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
