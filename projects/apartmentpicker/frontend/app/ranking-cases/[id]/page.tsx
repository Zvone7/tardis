"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { rankingCaseApi, rankingApi } from "../../utils/apiClient";
import { RankingCase, RankedApartment } from "../../types/models";

export default function RankingCaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [rankingCase, setRankingCase] = useState<RankingCase | null>(null);
  const [rankings, setRankings] = useState<RankedApartment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [caseData, rankData] = await Promise.all([
        rankingCaseApi.getById(id),
        rankingApi.getRankings(id),
      ]);
      setRankingCase(caseData);
      setRankings(rankData);
    } catch (err) {
      console.error("Failed to load ranking case", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!rankingCase) return <p>Ranking case not found.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{rankingCase.name}</h1>
        {rankingCase.description && (
          <p className="text-muted-foreground">{rankingCase.description}</p>
        )}
      </div>

      <div className="flex gap-4">
        <Link
          href={`/ranking-cases/${id}/apartments`}
          className="text-sm underline text-primary hover:text-primary/80"
        >
          Manage Apartments
        </Link>
        <Link
          href={`/ranking-cases/${id}/criteria`}
          className="text-sm underline text-primary hover:text-primary/80"
        >
          Manage Criteria
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Rankings</h2>
        {rankings.length === 0 ? (
          <p className="text-muted-foreground">No ranked apartments yet. Add apartments and criteria to see rankings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Apartment</th>
                  <th className="text-right p-2">Score</th>
                  <th className="text-right p-2">%</th>
                  {rankings[0]?.criterionScores.map((cs) => (
                    <th key={cs.criterionId} className="text-right p-2 min-w-[80px]">
                      {cs.criterionName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.apartment.id} className="border-b hover:bg-accent/30">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-medium">{r.apartment.name}</td>
                    <td className="p-2 text-right font-mono">{r.totalScore}</td>
                    <td className="p-2 text-right font-mono">{r.percentScore}%</td>
                    {r.criterionScores.map((cs) => (
                      <td key={cs.criterionId} className="p-2 text-right font-mono">
                        <span className="text-muted-foreground text-xs">{cs.rawDisplayValue ?? "-"}</span>
                        {cs.weightedScore != null && (
                          <span className="ml-1">({cs.weightedScore})</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
