"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Switch } from "../components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import type { Trip, TripSave } from "../types/models"
import { useCurrencies, getDefaultCurrencyId } from "../hooks/useCurrencies"

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trip: TripSave) => void;
  trip?: Trip | null;
  defaultCurrencyId?: number | null;
}

export default function TripModal({ isOpen, onClose, onSave, trip, defaultCurrencyId }: TripModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [currencyId, setCurrencyId] = useState<number | null>(null)
  const { currencies, isLoading: isLoadingCurrencies } = useCurrencies()
  const fallbackCurrencyId = currencyId ?? trip?.currencyId ?? defaultCurrencyId ?? getDefaultCurrencyId(currencies) ?? currencies[0]?.id ?? null

  useEffect(() => {
    if (trip) {
      setName(trip.name)
      setDescription(trip.description)
      setIsActive(trip.isActive)
      setCurrencyId(trip.currencyId ?? null)
    } else {
      setName("")
      setDescription("")
      setIsActive(true)
      setCurrencyId(defaultCurrencyId ?? getDefaultCurrencyId(currencies) ?? currencies[0]?.id ?? null)
    }
  }, [trip, defaultCurrencyId, currencies])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCurrencyId = fallbackCurrencyId
    if (!selectedCurrencyId) return
    onSave({ name, description, isActive, startTime: null, endTime: null, currencyId: selectedCurrencyId })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{trip ? "Edit Trip" : "Create Trip"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                Active
              </Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right">
                Currency
              </Label>
              <div className="col-span-3">
                <Select
                  value={currencyId?.toString() ?? ""}
                  onValueChange={(value) => setCurrencyId(Number.parseInt(value, 10))}
                  disabled={isLoadingCurrencies}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingCurrencies ? "Loading..." : "Select currency"} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id.toString()}>
                        {currency.symbol} {currency.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
