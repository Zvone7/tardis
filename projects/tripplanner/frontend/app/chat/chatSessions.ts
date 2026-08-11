import type { ChatMessage, ContentPart } from "./types"

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
}

interface SessionStore {
  activeSessionId: string
  sessions: ChatSession[]
}

function getStoreKey(tripId: number) {
  return `chat-sessions-${tripId}`
}

function stripImagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      const textParts = (msg.content as ContentPart[]).filter((p) => p.type === "text")
      return { ...msg, content: textParts.length ? textParts : "[image]" }
    }
    return msg
  })
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function getSessionName(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user")
  if (!firstUserMsg) return "New conversation"
  const text = typeof firstUserMsg.content === "string"
    ? firstUserMsg.content
    : Array.isArray(firstUserMsg.content)
      ? firstUserMsg.content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join(" ")
      : ""
  return text.slice(0, 40) || "New conversation"
}

function loadStore(tripId: number): SessionStore {
  try {
    const raw = sessionStorage.getItem(getStoreKey(tripId))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.sessions?.length > 0) return parsed
    }
  } catch {}

  // Migrate old format
  try {
    const oldKey = `chat-messages-${tripId}`
    const oldRaw = sessionStorage.getItem(oldKey)
    if (oldRaw) {
      const oldMessages = JSON.parse(oldRaw)
      if (Array.isArray(oldMessages) && oldMessages.length > 0) {
        const session: ChatSession = {
          id: generateId(),
          name: getSessionName(oldMessages),
          messages: oldMessages,
          createdAt: Date.now(),
        }
        sessionStorage.removeItem(oldKey)
        return { activeSessionId: session.id, sessions: [session] }
      }
      sessionStorage.removeItem(oldKey)
    }
  } catch {}

  const session: ChatSession = {
    id: generateId(),
    name: "New conversation",
    messages: [],
    createdAt: Date.now(),
  }
  return { activeSessionId: session.id, sessions: [session] }
}

function saveStore(tripId: number, store: SessionStore) {
  try {
    const toSave = {
      ...store,
      sessions: store.sessions.map((s) => ({
        ...s,
        messages: stripImagesForStorage(s.messages),
      })),
    }
    sessionStorage.setItem(getStoreKey(tripId), JSON.stringify(toSave))
  } catch {}
}

export function getActiveSession(tripId: number): { store: SessionStore; session: ChatSession } {
  const store = loadStore(tripId)
  const session = store.sessions.find((s) => s.id === store.activeSessionId) ?? store.sessions[0]
  return { store, session }
}

export function saveMessages(tripId: number, sessionId: string, messages: ChatMessage[]) {
  const store = loadStore(tripId)
  const session = store.sessions.find((s) => s.id === sessionId)
  if (session) {
    session.messages = messages
    if (session.name === "New conversation" && messages.length > 0) {
      session.name = getSessionName(messages)
    }
  }
  saveStore(tripId, store)
}

export function createNewSession(tripId: number): { store: SessionStore; session: ChatSession } {
  const store = loadStore(tripId)
  const session: ChatSession = {
    id: generateId(),
    name: "New conversation",
    messages: [],
    createdAt: Date.now(),
  }
  store.sessions.unshift(session)
  store.activeSessionId = session.id
  saveStore(tripId, store)
  return { store, session }
}

export function switchSession(tripId: number, sessionId: string): { store: SessionStore; session: ChatSession } {
  const store = loadStore(tripId)
  store.activeSessionId = sessionId
  saveStore(tripId, store)
  const session = store.sessions.find((s) => s.id === sessionId) ?? store.sessions[0]
  return { store, session }
}

export function deleteSession(tripId: number, sessionId: string): { store: SessionStore; session: ChatSession } {
  const store = loadStore(tripId)
  store.sessions = store.sessions.filter((s) => s.id !== sessionId)
  if (store.sessions.length === 0) {
    return createNewSession(tripId)
  }
  if (store.activeSessionId === sessionId) {
    store.activeSessionId = store.sessions[0].id
  }
  saveStore(tripId, store)
  const session = store.sessions.find((s) => s.id === store.activeSessionId) ?? store.sessions[0]
  return { store, session }
}

export function listSessions(tripId: number): ChatSession[] {
  return loadStore(tripId).sessions
}
