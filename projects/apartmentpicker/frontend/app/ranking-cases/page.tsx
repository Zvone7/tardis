"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { rankingCaseApi } from "../utils/apiClient";
import { RankingCase } from "../types/models";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export default function RankingCasesPage() {
  const [cases, setCases] = useState<RankingCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      const data = await rankingCaseApi.getAll();
      setCases(data);
    } catch (err) {
      console.error("Failed to load ranking cases", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = prompt("Ranking case name:");
    if (!name) return;
    try {
      await rankingCaseApi.create({ name, description: null, currency: null });
      loadCases();
    } catch (err) {
      console.error("Failed to create ranking case", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ranking case and all its data?")) return;
    try {
      await rankingCaseApi.remove(id);
      loadCases();
    } catch (err) {
      console.error("Failed to delete ranking case", err);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ranking Cases</h1>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Case
        </Button>
      </div>

      {cases.length === 0 ? (
        <p className="text-muted-foreground">No ranking cases yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4">
          {cases.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <Link href={`/ranking-cases/${c.id}`} className="flex-1">
                <h2 className="font-semibold">{c.name}</h2>
                {c.description && (
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {c.apartmentCount} apartment{c.apartmentCount !== 1 ? "s" : ""}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(c.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
