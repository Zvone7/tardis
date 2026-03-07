"use client"

import { useEffect, useState } from "react"
import { accountApi } from "../utils/apiClient"
import type { User } from "../types/models"
import { Button } from "../../components/ui/button"

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [unapproved, setUnapproved] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const user = await accountApi.getInfo()
        setCurrentUser(user)
        if (user.role === "admin") {
          const pending = await accountApi.getUnapproved()
          setUnapproved(pending)
        }
      } catch {
        setError("Not authorized")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleApprove = async (userId: number) => {
    try {
      await accountApi.approve(userId)
      setUnapproved((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      console.error("Failed to approve user", err)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>
  if (error || !currentUser || currentUser.role !== "admin") {
    return <p className="text-destructive">Access denied. Admin only.</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin - Pending Approvals</h1>

      {unapproved.length === 0 ? (
        <p className="text-muted-foreground">No pending users.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Signed Up</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {unapproved.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="py-2 pr-4">{user.name}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                  >
                    Approve
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
