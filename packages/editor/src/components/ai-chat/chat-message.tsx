'use client'

import type { ChatMessage as ChatMessageType } from '../../lib/ai/types'
import { cn } from '../../lib/utils'
import { ToolCallIndicator } from './tool-call-indicator'

interface ChatMessageProps {
  message: ChatMessageType
  isToolComplete?: boolean
}

export function ChatMessage({ message, isToolComplete = false }: ChatMessageProps) {
  // Don't render tool result messages directly
  if (message.role === 'tool') return null

  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
          isUser ? 'bg-blue-600/90 text-white' : 'bg-accent/60 text-foreground',
        )}
      >
        {message.content && (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div
            className={cn(
              'flex flex-col gap-0.5',
              message.content && 'mt-1.5 border-t border-white/10 pt-1.5',
            )}
          >
            {message.toolCalls.map((tc) => (
              <ToolCallIndicator isComplete={isToolComplete} key={tc.id} name={tc.name} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
