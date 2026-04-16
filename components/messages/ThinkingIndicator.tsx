interface ThinkingIndicatorProps {
  agentName?: string
  state?: string
  detail?: string
}

export function ThinkingIndicator({ agentName = 'Agent', state, detail }: ThinkingIndicatorProps) {
  const label = state === 'searching'
    ? 'Searching...'
    : state === 'writing'
    ? 'Writing...'
    : state === 'running_task'
    ? 'Running task...'
    : 'Thinking...'

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="h-8 w-8 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm">🤖</span>
      </div>
      <div className="flex-1">
        <p className="text-xs text-white/40 font-medium mb-1">{agentName}</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" />
          </div>
          <span className="text-xs text-white/30 italic">
            {label}
            {detail && ` ${detail}`}
          </span>
        </div>
      </div>
    </div>
  )
}
