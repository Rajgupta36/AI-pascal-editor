import { getOpenAIClient } from '../../../../lib/ai/openai'
import { buildSystemPrompt } from '../../../../lib/ai/system-prompt'
import { toolDefinitions } from '../../../../lib/ai/tool-definitions'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages } = await req.json()

  const openai = getOpenAIClient()
  const systemPrompt = buildSystemPrompt()

  const openaiMessages = [{ role: 'system' as const, content: systemPrompt }, ...messages]

  const stream = await openai.chat.completions.create({
    model: 'gpt-5.4',
    messages: openaiMessages,
    tools: toolDefinitions,
    stream: true,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const toolCalls: Record<number, { id: string; name: string; arguments: string }> = {}

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta

          if (!delta) continue

          // Text content
          if (delta.content) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', content: delta.content })}\n\n`,
              ),
            )
          }

          // Tool calls (accumulate across chunks)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' }
              }
              if (tc.id) toolCalls[idx].id = tc.id
              if (tc.function?.name) toolCalls[idx].name = tc.function.name
              if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
            }
          }

          // Check if this chunk signals end of response
          if (chunk.choices[0]?.finish_reason === 'tool_calls') {
            for (const tc of Object.values(toolCalls)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', toolCall: tc })}\n\n`),
              )
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
