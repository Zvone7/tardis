"use client"

import { useState, useEffect } from "react"
import { User, LogOut } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog"
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
      } catch {
        // Silently ignore on public pages (home, status) — user is simply not logged in
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
    <div className="flex items-center gap-1">
      {user && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/profile">
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.email}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {user && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoggingOut}
              className="group/logout flex items-center gap-1 text-xs"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline overflow-hidden max-w-0 group-hover/logout:max-w-[4rem] transition-all duration-300 whitespace-nowrap">Logout</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out of TripPlanner?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
