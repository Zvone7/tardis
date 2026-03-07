"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apartmentApi } from "../../../utils/apiClient";
import { Apartment } from "../../../types/models";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function ApartmentsPage() {
  const params = useParams();
  const rankingCaseId = params.id as string;
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApartments();
  }, [rankingCaseId]);

  async function loadApartments() {
    try {
      const data = await apartmentApi.getByRankingCaseId(rankingCaseId);
      setApartments(data);
    } catch (err) {
      console.error("Failed to load apartments", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = prompt("Apartment name:");
    if (!name) return;
    try {
      await apartmentApi.create({
        rankingCaseId,
        name,
        sillyName: null,
        link: null,
        comment: null,
        hiddenFromRanking: false,
        status: "Considering",
      });
      loadApartments();
    } catch (err) {
      console.error("Failed to create apartment", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this apartment?")) return;
    try {
      await apartmentApi.remove(id);
      loadApartments();
    } catch (err) {
      console.error("Failed to delete apartment", err);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/ranking-cases/${rankingCaseId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold">Apartments</h1>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Apartment
        </Button>
      </div>

      {apartments.length === 0 ? (
        <p className="text-muted-foreground">No apartments yet.</p>
      ) : (
        <div className="grid gap-3">
          {apartments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                {a.sillyName && <p className="text-xs text-muted-foreground">{a.sillyName}</p>}
                <p className="text-xs text-muted-foreground">
                  Status: {a.status}
                  {a.hiddenFromRanking && " (hidden)"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
