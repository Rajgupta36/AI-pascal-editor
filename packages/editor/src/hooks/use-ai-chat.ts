'use client'

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useRef, useState } from 'react'
import { executeToolCall } from '../lib/ai/tool-executor'
import type { ChatMessage, SceneContext, SSEEvent, ToolCallInfo } from '../lib/ai/types'

let messageIdCounter = 0
function nextMessageId(): string {
  return `msg_${++messageIdCounter}_${Date.now()}`
}

function getSceneContext(): SceneContext {
  const viewer = useViewer.getState()
  const scene = useScene.getState()
  const siteId = scene.rootNodeIds[0] ?? ''
  const buildingId = viewer.selection.buildingId ?? ''
  const levelId = viewer.selection.levelId ?? ''
  return { siteId, buildingId, levelId }
}

// Convert our messages to OpenAI format
function toOpenAIMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return messages
    .filter((m) => !m.isStreaming)
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        }
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        }
      }
      return { role: m.role, content: m.content }
    })
}

async function* streamSSE(response: Response): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent
          yield event
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    setError(null)

    const userMessage: ChatMessage = {
      id: nextMessageId(),
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Pause undo history to group all agent actions
    useScene.temporal.getState().pause()

    try {
      let currentMessages: ChatMessage[] = []
      setMessages((prev) => {
        currentMessages = [...prev]
        return prev
      })
      // Make sure we include the just-added user message
      if (!currentMessages.find((m) => m.id === userMessage.id)) {
        currentMessages = [...currentMessages, userMessage]
      }

      // Agent loop — keeps going until no more tool calls
      let continueLoop = true
      while (continueLoop) {
        continueLoop = false

        const abortController = new AbortController()
        abortRef.current = abortController

        const openaiMessages = toOpenAIMessages(currentMessages)

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: openaiMessages }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.error || `HTTP ${response.status}`)
        }

        // Stream the response
        const assistantId = nextMessageId()
        let assistantContent = ''
        const toolCalls: ToolCallInfo[] = []

        // Add streaming message placeholder
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ])

        for await (const event of streamSSE(response)) {
          if (abortController.signal.aborted) break

          switch (event.type) {
            case 'delta':
              assistantContent += event.content
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent, isStreaming: true } : m,
                ),
              )
              break

            case 'tool_call':
              toolCalls.push(event.toolCall)
              break

            case 'error':
              throw new Error(event.message)

            case 'done':
              break
          }
        }

        // Finalize assistant message
        const finalAssistantMessage: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: assistantContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          isStreaming: false,
        }

        setMessages((prev) => prev.map((m) => (m.id === assistantId ? finalAssistantMessage : m)))

        currentMessages = [
          ...currentMessages.filter((m) => m.id !== assistantId),
          finalAssistantMessage,
        ]

        // Execute tool calls if any
        if (toolCalls.length > 0) {
          const context = getSceneContext()
          const toolResultMessages: ChatMessage[] = []

          for (const tc of toolCalls) {
            const result = await executeToolCall(
              { name: tc.name, arguments: tc.arguments },
              context,
            )

            const toolMsg: ChatMessage = {
              id: nextMessageId(),
              role: 'tool',
              content: result,
              toolCallId: tc.id,
            }
            toolResultMessages.push(toolMsg)
          }

          setMessages((prev) => [...prev, ...toolResultMessages])
          currentMessages = [...currentMessages, ...toolResultMessages]

          // Continue the loop — agent may want to do more
          continueLoop = true
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setError(msg)
      }
    } finally {
      // Resume undo history
      useScene.temporal.getState().resume()
      setIsLoading(false)
      abortRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, isLoading, error, sendMessage, cancel, clearChat }
}
