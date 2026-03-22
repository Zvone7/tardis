import type { ChatMessage, ToolCall, StreamChunk } from "./types"

interface StreamCallbacks {
  onDelta: (content: string) => void
  onToolCalls: (toolCalls: ToolCall[]) => void
  onDone: () => void
  onError: (error: string) => void
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  tools: unknown[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/chat/completions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, tools }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    let errorMessage = `Request failed: ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.error?.message) {
        const msg = parsed.error.message
        const retryMatch = msg.match(/Please try again in ([\d.]+s)/)
        if (parsed.error.code === "rate_limit_exceeded" && retryMatch) {
          errorMessage = `Rate limit reached. Please try again in ${retryMatch[1]}.`
        } else {
          errorMessage = parsed.error.message
        }
      }
    } catch {
      if (text) errorMessage = text
    }
    callbacks.onError(errorMessage)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError("No response stream")
    return
  }

  const decoder = new TextDecoder()
  let buffer = ""

  // Accumulate tool calls across chunks (they arrive incrementally)
  const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith("data:")) continue

        const data = trimmed.slice(5).trim()
        if (data === "[DONE]") {
          // Flush any accumulated tool calls
          if (toolCallMap.size > 0) {
            const toolCalls: ToolCall[] = Array.from(toolCallMap.values()).map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            }))
            callbacks.onToolCalls(toolCalls)
          }
          callbacks.onDone()
          return
        }

        try {
          const chunk: StreamChunk = JSON.parse(data)
          const choice = chunk.choices?.[0]
          if (!choice) continue

          if (choice.delta.content) {
            callbacks.onDelta(choice.delta.content)
          }

          if (choice.delta.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const existing = toolCallMap.get(tc.index)
              if (!existing) {
                toolCallMap.set(tc.index, {
                  id: tc.id ?? "",
                  name: tc.function?.name ?? "",
                  arguments: tc.function?.arguments ?? "",
                })
              } else {
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.name += tc.function.name
                if (tc.function?.arguments) existing.arguments += tc.function.arguments
              }
            }
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    // Stream ended without [DONE] - flush what we have
    if (toolCallMap.size > 0) {
      const toolCalls: ToolCall[] = Array.from(toolCallMap.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      }))
      callbacks.onToolCalls(toolCalls)
    }
    callbacks.onDone()
  } finally {
    reader.releaseLock()
  }
}
