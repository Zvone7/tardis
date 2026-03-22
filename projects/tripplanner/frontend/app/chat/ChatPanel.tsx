"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Square, Trash2, ImagePlus, X } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet"
import { ScrollArea } from "../components/ui/scroll-area"
import { Button } from "../components/ui/button"
import { useChatContext } from "./ChatProvider"
import { ChatMessageBubble } from "./ChatMessage"

export function ChatPanel() {
  const {
    tripId,
    tripName,
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    isOpen,
    setIsOpen,
  } = useChatContext()

  const [input, setInput] = useState("")
  const [images, setImages] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change or panel opens
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isOpen])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const addImageFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (imageFiles.length === 0) return
    const dataUrls = await Promise.all(imageFiles.map(readFileAsDataUrl))
    setImages((prev) => [...prev, ...dataUrls])
  }, [readFileAsDataUrl])

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        addImageFiles(imageFiles)
      }
    },
    [addImageFiles]
  )

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if ((!text && images.length === 0) || isStreaming) return
    const currentImages = images.length > 0 ? [...images] : undefined
    setInput("")
    setImages([])
    await sendMessage(text, currentImages)
  }, [input, images, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const displayMessages = messages.filter((m) => m.role !== "system")

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <SheetContent side="right" hideOverlay className="flex flex-col p-0 sm:max-w-md w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <SheetTitle className="text-base">Trip Assistant</SheetTitle>
            {tripName && (
              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{tripName}</p>
            )}
          </div>
          {displayMessages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearMessages} className="h-8 w-8 mr-6">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          {!tripId ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground px-4 text-center">
              Open a trip to use the assistant
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div ref={scrollRef} className="p-4 space-y-1">
                {displayMessages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center mt-8">
                    Ask me to create segments, options, or help plan your trip!
                  </div>
                )}
                {displayMessages.map((msg, i) => (
                  <ChatMessageBubble key={i} message={msg} />
                ))}
                {isStreaming && displayMessages[displayMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start mb-2">
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/60"
                          style={{
                            animation: "typing-bounce 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                      <style jsx>{`
                        @keyframes typing-bounce {
                          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
                          30% { opacity: 1; transform: translateY(-4px); }
                        }
                      `}</style>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="text-sm text-destructive text-center mt-2">{error}</div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input */}
        {tripId && (
          <div className="border-t p-3">
            <div className="space-y-2">
              {images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {images.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt="" className="h-16 w-16 object-cover rounded-md border" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addImageFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  className="shrink-0"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Type a message..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 min-h-[36px] max-h-[100px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                {isStreaming ? (
                  <Button variant="outline" size="icon" onClick={stopStreaming} className="shrink-0">
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="icon" onClick={handleSend} disabled={!input.trim() && images.length === 0} className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
