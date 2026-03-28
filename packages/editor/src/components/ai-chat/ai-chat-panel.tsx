'use client'

import { Bot, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useAiChat } from '../../hooks/use-ai-chat'
import type { ChatMessage as ChatMessageType } from '../../lib/ai/types'
import useEditor from '../../store/use-editor'
import { ChatInput } from './chat-input'
import { ChatMessage } from './chat-message'

const QUICK_PROMPTS = [
  'Design a 3-bedroom house with kitchen, living room, and 2 bathrooms',
  'I have a 20x30m plot, suggest a house design',
  'Create a small studio apartment (6x8m)',
  'Add furniture to the rooms',
]

function QuickPrompt({ text, onSelect }: { text: string; onSelect: (text: string) => void }) {
  return (
    <button
      className="rounded-lg border border-border/40 bg-accent/20 px-3 py-2 text-left text-muted-foreground text-xs transition-colors hover:border-border/60 hover:bg-accent/40 hover:text-foreground"
      onClick={() => onSelect(text)}
      type="button"
    >
      {text}
    </button>
  )
}

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600/10">
        <Bot className="h-6 w-6 text-blue-400" />
      </div>
      <div className="text-center">
        <h3 className="font-medium text-foreground text-sm">AI Architect</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Describe your building and I'll create the floor plan for you.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <QuickPrompt key={prompt} onSelect={onSelect} text={prompt} />
        ))}
      </div>
    </div>
  )
}

function isToolResultAvailable(messages: ChatMessageType[], toolCallId: string): boolean {
  return messages.some((m) => m.role === 'tool' && m.toolCallId === toolCallId)
}

export function AiChatPanel() {
  const { messages, isLoading, error, sendMessage, cancel, clearChat } = useAiChat()
  const scrollRef = useRef<HTMLDivElement>(null)
  const setAiChatOpen = useEditor((s) => s.setAiChatOpen)

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleClose = useCallback(() => {
    setAiChatOpen(false)
  }, [setAiChatOpen])

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text)
    },
    [sendMessage],
  )

  const visibleMessages = messages.filter((m) => m.role !== 'tool')

  return (
    <div className="pointer-events-auto fixed top-20 right-4 z-50 flex h-[calc(100dvh-100px)] w-[380px] flex-col overflow-hidden rounded-xl border border-border/50 bg-sidebar/95 shadow-2xl backdrop-blur-xl dark:text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-border/50 border-b px-3 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          <span className="font-medium text-sm">AI Architect</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={clearChat}
              title="Clear chat"
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={handleClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {visibleMessages.length === 0 && !isLoading ? (
          <EmptyState onSelect={handleSend} />
        ) : (
          visibleMessages.map((msg) => {
            // Check if tool calls are complete (results available)
            const toolsComplete =
              msg.toolCalls?.every((tc) => isToolResultAvailable(messages, tc.id)) ?? false

            return <ChatMessage isToolComplete={toolsComplete} key={msg.id} message={msg} />
          })
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput isLoading={isLoading} onCancel={cancel} onSend={handleSend} />
    </div>
  )
}
