'use client'

import { Check, Loader2 } from 'lucide-react'
import { TOOL_DISPLAY_NAMES } from '../../lib/ai/tool-definitions'

interface ToolCallIndicatorProps {
  name: string
  isComplete: boolean
}

export function ToolCallIndicator({ name, isComplete }: ToolCallIndicatorProps) {
  const displayName = TOOL_DISPLAY_NAMES[name] ?? name

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-muted-foreground text-xs">
      {isComplete ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      <span>
        {displayName}
        {isComplete ? '' : '...'}
      </span>
    </div>
  )
}
