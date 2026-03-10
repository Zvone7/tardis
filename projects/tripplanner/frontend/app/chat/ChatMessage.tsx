"use client"

import type { ChatMessage as ChatMessageType, ContentPart } from "./types"
import { cn } from "../lib/utils"

interface Props {
  message: ChatMessageType
}

export function ChatMessageBubble({ message }: Props) {
  if (message.role === "system") return null

  if (message.role === "tool") {
    let statusText = message.name ?? "tool"
    try {
      const contentText =
        typeof message.content === "string" ? message.content : ""
      const parsed = JSON.parse(contentText ?? "")
      if (parsed.message) statusText = parsed.message
      else statusText = `${message.name}: done`
    } catch {
      const contentText =
        typeof message.content === "string" ? message.content : ""
      statusText = `${message.name}: ${contentText.slice(0, 100) || "done"}`
    }
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {statusText}
        </span>
      </div>
    )
  }

  if (message.role === "assistant" && message.tool_calls && !message.content) {
    return null
  }

  const isUser = message.role === "user"

  return (
    <div className={cn("flex mb-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {Array.isArray(message.content) ? (
          <>
            {(message.content as ContentPart[]).map((part, i) =>
              part.type === "text" ? (
                <span key={i}>{part.text}</span>
              ) : (
                <img
                  key={i}
                  src={part.image_url.url}
                  alt=""
                  className="max-w-full rounded-md mt-1"
                />
              )
            )}
          </>
        ) : (
          message.content
        )}
      </div>
    </div>
  )
}
