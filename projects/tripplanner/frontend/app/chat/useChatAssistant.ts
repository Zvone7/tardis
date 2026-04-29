"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type { ChatMessage, ToolCall, ContentPart } from "./types"
import type { SegmentType, Currency, SegmentApi, OptionApi } from "../types/models"
import { streamChatCompletion } from "./chatApiClient"
import { chatTools } from "./toolDefinitions"
import { executeToolCall, type ToolContext } from "./toolExecutor"
import { segmentsApi, optionsApi, currencyApi } from "../utils/apiClient"
import { normalizeLocation } from "../lib/mapping"
import {
  getActiveSession,
  saveMessages,
  createNewSession,
  switchSession,
  deleteSession,
  listSessions,
  type ChatSession,
} from "./chatSessions"

const MAX_TOOL_ROUNDS = 5

interface UseChatAssistantOptions {
  tripId: number | null
  tripName: string | null
  preferredUtcOffset: number
  preferredCurrencyId: number | null
  onDataChanged?: () => void
}

export function useChatAssistant({ tripId, tripName, preferredUtcOffset, preferredCurrencyId, onDataChanged }: UseChatAssistantOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined" || !tripId) return []
    return getActiveSession(tripId).session.messages
  })
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window === "undefined" || !tripId) return ""
    return getActiveSession(tripId).session.id
  })
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window === "undefined" || !tripId) return []
    return listSessions(tripId)
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Restore session when tripId changes
  useEffect(() => {
    if (!tripId) return
    const { session } = getActiveSession(tripId)
    setMessages(session.messages)
    setActiveSessionId(session.id)
    setSessions(listSessions(tripId))
  }, [tripId])

  // Persist messages on change
  useEffect(() => {
    if (!tripId || !activeSessionId) return
    saveMessages(tripId, activeSessionId, messages)
    setSessions(listSessions(tripId))
  }, [tripId, activeSessionId, messages])

  // Cache for reference data
  const cacheRef = useRef<{
    segmentTypes: SegmentType[]
    currencies: Currency[]
  }>({ segmentTypes: [], currencies: [] })

  const loadReferenceData = useCallback(async () => {
    if (cacheRef.current.segmentTypes.length === 0) {
      const types = await segmentsApi.getTypes()
      console.log("[chat] loaded segment types:", types)
      cacheRef.current.segmentTypes = types
    }
    if (cacheRef.current.currencies.length === 0) {
      const currencies = await currencyApi.getCurrencies()
      console.log("[chat] loaded currencies:", currencies)
      cacheRef.current.currencies = currencies
    }
    return cacheRef.current
  }, [])

  const buildSystemPrompt = useCallback(
    (segments: SegmentApi[], options: OptionApi[], segmentTypes: SegmentType[], currencies: Currency[]) => {
      const preferredCurrencyShortName = preferredCurrencyId
        ? (currencies.find((c) => c.id === preferredCurrencyId)?.shortName ?? null)
        : null

      const segmentSummary = segments
        .map((s) => {
          const typeName = segmentTypes.find((t) => t.id === s.segmentTypeId)?.name ?? "Unknown"
          const curr = currencies.find((c) => c.id === s.currencyId)?.shortName ?? "?"
          const startLoc = s.startLocation ? normalizeLocation(s.startLocation)?.name : ""
          const endLoc = s.endLocation ? normalizeLocation(s.endLocation)?.name : ""
          const nicknameStr = s.name && !/^new\s*segment$/i.test(s.name.trim()) ? ` [nickname: "${s.name}"]` : ""
          return `  - ID:${s.id}${nicknameStr} (${typeName}) ${startLoc}→${endLoc} | ${s.startDateTimeUtc} to ${s.endDateTimeUtc} | ${s.cost} ${curr}`
        })
        .join("\n")

      const optionSummary = options
        .map((o) => `  - ID:${o.id} "${o.name}" | totalCost: ${o.totalCost}, days: ${o.totalDays}`)
        .join("\n")

      const typeList = segmentTypes.map((t) => `${t.name} (ID:${t.id})`).join(", ")
      const currList = currencies.map((c) => `${c.shortName} (ID:${c.id})`).join(", ")

      const utcOffsetLabel = preferredUtcOffset >= 0 ? `UTC+${preferredUtcOffset}` : `UTC${preferredUtcOffset}`

      return `You are a travel planning assistant for the TripPlanner app.
Current trip: "${tripName}" (ID: ${tripId})
User's preferred UTC offset: ${preferredUtcOffset} (${utcOffsetLabel})
User's preferred currency: ${preferredCurrencyShortName ?? "not set"}

Available segment types: ${typeList}
Available currencies: ${currList}

Current segments:
${segmentSummary || "  (none)"}

Current options:
${optionSummary || "  (none)"}

When creating/updating segments:
- Use the segment type name (e.g. "Flight", not the ID) - the tool will resolve it
- Use the currency short name (e.g. "EUR", not the ID) - the tool will resolve it
- Use location names (e.g. "Budapest") - the tool will geocode them
- Provide dates in ISO 8601 format
- If the user doesn't specify a UTC offset, use their preferred offset (${preferredUtcOffset})
- When updating, only provide fields that need to change (plus the segmentId)

Timezone awareness (critical for flights):
- Departure times shown in booking screenshots are in the LOCAL timezone of the departure city.
- Arrival times shown in booking screenshots are in the LOCAL timezone of the arrival city.
- These are often DIFFERENT — always set startUtcOffset and endUtcOffset independently based on each city's timezone.
- Use your knowledge of city timezones to determine the correct integer UTC offsets (e.g. Oslo = +1 in winter/+2 in summer, Tokyo = +9).
- If you are unsure of a city's timezone from the screenshot context, ASK the user before creating or updating the segment.
- The user's home timezone is ${utcOffsetLabel} — use this as a fallback only when no city timezone can be determined.

Currency awareness:
- When extracting prices from screenshots, use the ACTUAL currency shown (e.g. if Skyscanner shows "€123", use EUR with cost 123).
- If the screenshot currency differs from the user's preferred currency (${preferredCurrencyShortName ?? "not set"}), briefly mention the approximate equivalent in ${preferredCurrencyShortName ?? "their preferred currency"} in your summary.
- If no currency is visible in a screenshot, default to ${preferredCurrencyShortName ?? "EUR"}.
- Currency symbols can be ambiguous (e.g. "$" could be USD, CAD, AUD) — if unclear from context, note the ambiguity and ask.

IMPORTANT workflow rules:
- When extracting segments from images or complex input, ALWAYS present a summary of what you plan to create FIRST and ask for confirmation before calling any create tools. List each segment with: type, name, locations, dates/times (with timezone), cost, and currency.
- Only proceed to create after the user confirms (e.g. "yes", "go ahead", "looks good").
- For simple direct requests (e.g. "add a flight from Oslo to Budapest"), you can create immediately without asking.
- Be concise in your responses. Confirm what you did after tool calls complete.`
    },
    [tripId, tripName, preferredUtcOffset, preferredCurrencyId]
  )

  const sendMessage = useCallback(
    async (userText: string, imageDataUrls?: string[]) => {
      if (!tripId || isStreaming) return

      setError(null)
      setIsStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        const { segmentTypes, currencies } = await loadReferenceData()
        const segments = await segmentsApi.getByTripId(tripId)
        const options = await optionsApi.getByTripId(tripId)

        const systemPrompt = buildSystemPrompt(segments, options, segmentTypes, currencies)
        const systemMessage: ChatMessage = { role: "system", content: systemPrompt }

        let userContent: string | ContentPart[]
        if (imageDataUrls && imageDataUrls.length > 0) {
          const parts: ContentPart[] = []
          if (userText) parts.push({ type: "text", text: userText })
          for (const url of imageDataUrls) {
            parts.push({ type: "image_url", image_url: { url } })
          }
          userContent = parts
        } else {
          userContent = userText
        }

        const userMessage: ChatMessage = { role: "user", content: userContent }

        // Build conversation: system + previous non-system messages + new user message
        const previousMessages = messages.filter((m) => m.role !== "system")
        const conversationMessages = [systemMessage, ...previousMessages, userMessage]

        // Update displayed messages (without system prompt)
        setMessages((prev) => [...prev, userMessage])

        let currentMessages = conversationMessages
        let toolRound = 0
        let hadMutation = false

        while (toolRound < MAX_TOOL_ROUNDS) {
          let assistantContent = ""
          let pendingToolCalls: ToolCall[] = []
          let streamDone = false

          await new Promise<void>((resolve, reject) => {
            streamChatCompletion(
              currentMessages,
              chatTools,
              {
                onDelta: (content) => {
                  assistantContent += content
                  // Update the streaming message in real-time
                  setMessages((prev) => {
                    const withoutStreaming = prev.filter((m) => m !== prev[prev.length - 1] || m.role !== "assistant" || m.tool_calls)
                    // Find if last message is our streaming assistant message
                    const last = prev[prev.length - 1]
                    if (last?.role === "assistant" && !last.tool_calls) {
                      return [...prev.slice(0, -1), { role: "assistant" as const, content: assistantContent }]
                    }
                    return [...prev, { role: "assistant" as const, content: assistantContent }]
                  })
                },
                onToolCalls: (toolCalls) => {
                  pendingToolCalls = toolCalls
                },
                onDone: () => {
                  streamDone = true
                  resolve()
                },
                onError: (err) => {
                  reject(new Error(err))
                },
              },
              abortController.signal
            )
          })

          if (pendingToolCalls.length === 0) {
            // No tool calls - conversation round is done
            if (assistantContent) {
              const finalAssistant: ChatMessage = { role: "assistant", content: assistantContent }
              currentMessages = [...currentMessages, finalAssistant]
            }
            break
          }

          // We have tool calls to execute
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: assistantContent || null,
            tool_calls: pendingToolCalls,
          }
          currentMessages = [...currentMessages, assistantMessage]

          // Show tool status in UI
          setMessages((prev) => {
            // Remove streaming assistant message if present, add the one with tool_calls
            const filtered = prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.tool_calls))
            return [...filtered, assistantMessage]
          })

          // Refresh data after mutations for accurate context
          let freshSegments = segments
          let freshOptions = options
          if (hadMutation) {
            freshSegments = await segmentsApi.getByTripId(tripId)
            freshOptions = await optionsApi.getByTripId(tripId)
          }

          const toolContext: ToolContext = {
            tripId,
            segmentTypes,
            currencies,
            segments: freshSegments,
            options: freshOptions,
            preferredUtcOffset,
            preferredCurrencyId,
          }

          // Execute all tool calls
          const toolResults: ChatMessage[] = []
          for (const tc of pendingToolCalls) {
            const result = await executeToolCall(tc, toolContext)
            if (result.mutated) hadMutation = true
            toolResults.push({
              role: "tool",
              content: result.result,
              tool_call_id: tc.id,
              name: tc.function.name,
            })
          }

          currentMessages = [...currentMessages, ...toolResults]

          // Add tool results to displayed messages
          setMessages((prev) => [...prev, ...toolResults])

          // Refresh context if we had mutations
          if (hadMutation) {
            toolContext.segments = await segmentsApi.getByTripId(tripId)
            toolContext.options = await optionsApi.getByTripId(tripId)
          }

          toolRound++
        }

        // After all rounds, notify data changed if there were mutations
        if (hadMutation && onDataChanged) {
          onDataChanged()
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [tripId, messages, isStreaming, loadReferenceData, buildSystemPrompt, preferredUtcOffset, onDataChanged]
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const newConversation = useCallback(() => {
    if (!tripId) return
    const { session } = createNewSession(tripId)
    setMessages([])
    setActiveSessionId(session.id)
    setSessions(listSessions(tripId))
    setError(null)
  }, [tripId])

  const switchToSession = useCallback((sessionId: string) => {
    if (!tripId) return
    const { session } = switchSession(tripId, sessionId)
    setMessages(session.messages)
    setActiveSessionId(session.id)
    setError(null)
  }, [tripId])

  const deleteConversation = useCallback((sessionId: string) => {
    if (!tripId) return
    const { session } = deleteSession(tripId, sessionId)
    setMessages(session.messages)
    setActiveSessionId(session.id)
    setSessions(listSessions(tripId))
    setError(null)
  }, [tripId])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    newConversation,
    switchToSession,
    deleteConversation,
    sessions,
    activeSessionId,
  }
}
