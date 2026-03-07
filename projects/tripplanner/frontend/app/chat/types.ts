export interface TextContentPart {
  type: "text"
  text: string
}

export interface ImageContentPart {
  type: "image_url"
  image_url: { url: string }
}

export type ContentPart = TextContentPart | ImageContentPart

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | ContentPart[] | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface ToolCallDelta {
  index: number
  id?: string
  type?: "function"
  function?: {
    name?: string
    arguments?: string
  }
}

export interface StreamDelta {
  content?: string | null
  tool_calls?: ToolCallDelta[]
}

export interface StreamChoice {
  delta: StreamDelta
  finish_reason: string | null
}

export interface StreamChunk {
  choices?: StreamChoice[]
}
