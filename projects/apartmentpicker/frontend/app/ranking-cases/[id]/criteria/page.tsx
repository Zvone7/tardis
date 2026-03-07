"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { criterionApi } from "../../../utils/apiClient";
import { Criterion } from "../../../types/models";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function CriteriaPage() {
  const params = useParams();
  const rankingCaseId = params.id as string;
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCriteria();
  }, [rankingCaseId]);

  async function loadCriteria() {
    try {
      const data = await criterionApi.getByRankingCaseId(rankingCaseId);
      setCriteria(data);
    } catch (err) {
      console.error("Failed to load criteria", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = prompt("Criterion name:");
    if (!name) return;
    try {
      await criterionApi.create({
        rankingCaseId,
        name,
        description: null,
        includeInRanking: true,
        dataType: "Number",
        unit: null,
        weight: 3,
        missingValueHandling: "Ignore",
        sortOrder: criteria.length,
        numericIntervals: [],
        booleanRule: null,
        enumOptions: [],
      });
      loadCriteria();
    } catch (err) {
      console.error("Failed to create criterion", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this criterion?")) return;
    try {
      await criterionApi.remove(id);
      loadCriteria();
    } catch (err) {
      console.error("Failed to delete criterion", err);
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
          <h1 className="text-2xl font-bold">Criteria</h1>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Criterion
        </Button>
      </div>

      {criteria.length === 0 ? (
        <p className="text-muted-foreground">No criteria defined yet.</p>
      ) : (
        <div className="grid gap-3">
          {criteria.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">
                  {c.name}
                  {!c.includeInRanking && <span className="text-xs text-muted-foreground ml-2">(excluded)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.dataType} | Weight: {c.weight} | Missing: {c.missingValueHandling}
                  {c.unit && ` | Unit: ${c.unit}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
