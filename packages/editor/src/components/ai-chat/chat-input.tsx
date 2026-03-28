'use client'

import { ArrowUp, Square } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  onCancel: () => void
  isLoading: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onCancel, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isLoading, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }, [])

  return (
    <div className="flex items-end gap-2 border-border/50 border-t bg-sidebar/80 px-3 py-3">
      <textarea
        ref={textareaRef}
        className="flex-1 resize-none rounded-lg border border-border/50 bg-accent/30 px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground/50 focus:border-blue-500/50 focus:outline-none"
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Describe your building..."
        rows={1}
        value={value}
      />
      {isLoading ? (
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/80 text-white transition-colors hover:bg-red-500"
          onClick={onCancel}
          title="Stop generating"
          type="button"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          disabled={!value.trim() || disabled}
          onClick={handleSend}
          title="Send message"
          type="button"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
