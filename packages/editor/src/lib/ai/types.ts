export type ChatRole = 'user' | 'assistant' | 'tool'

export type ToolCallInfo = {
  id: string
  name: string
  arguments: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  toolCalls?: ToolCallInfo[]
  toolCallId?: string
  isStreaming?: boolean
}

export type SceneContext = {
  siteId: string
  buildingId: string
  levelId: string
}

export type SSEEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallInfo }
  | { type: 'done' }
  | { type: 'error'; message: string }
