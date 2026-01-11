"use client"

import { useState, useEffect } from "react"
import { User, LogOut } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
import { Button } from "../components/ui/button"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { User as UserModel } from "../types/models"
import { userApi } from "../utils/apiClient"

export function UserInfo() {
  const [user, setUser] = useState<UserModel | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const userData = await userApi.getAccountInfo()
        setUser(userData)
      } catch (error) {
        console.error("Failed to fetch user info:", error)
        if (
          window.location.pathname !== "/" &&
          window.location.pathname !== "/status"
        ) {
          window.location.href = "/"
        }
      }
    }

    fetchUserInfo()
  }, [])

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await userApi.logout()
      setUser(null)
      router.push("/")
    } catch (error) {
      console.error("Error during logout:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="flex items-center gap-4 group">
      {user && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/profile">
                <div className="flex items-center space-x-2 text-sm">
                  <User className="w-4 h-4" />
                  <span>{user.name.split(" ")[0]}</span>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.email}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex items-center gap-1 text-xs"
      >
        <span className=" opacity-0 group-hover:opacity-100 transition-opacity">Logout</span>
        <LogOut className="w-3 h-3" />
      </Button>
    </div>
  )
}
