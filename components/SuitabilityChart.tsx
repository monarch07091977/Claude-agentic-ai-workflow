"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { StepRecord } from "@/lib/notion/steps";
import type { SuitabilityScoreRecord } from "@/lib/notion/suitability";

const CLASSIFICATION_COLORS: Record<string, string> = {
  Algorithmic: "#2563eb",
  Agentic: "#16a34a",
  "Human-required": "#ea580c",
};

export function SuitabilityChart({
  steps,
  scores,
}: {
  steps: StepRecord[];
  scores: SuitabilityScoreRecord[];
}) {
  const data = scores
    .map((score) => {
      const step = steps.find((s) => s.id === score.stepId);
      if (!step) return null;
      return {
        stepName: step.stepName,
        dataComplexity: score.dataComplexity,
        contextVolatility: score.contextVolatility,
        suitabilityScore: score.suitabilityScore,
        classification: score.classification,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Score at least one step below to see the suitability chart.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="dataComplexity"
            name="Data Complexity"
            domain={[1, 5]}
            label={{ value: "Data Complexity", position: "insideBottom", offset: -10 }}
          />
          <YAxis
            type="number"
            dataKey="contextVolatility"
            name="Context Volatility"
            domain={[1, 5]}
            label={{ value: "Context Volatility", angle: -90, position: "insideLeft" }}
          />
          <ZAxis
            type="number"
            dataKey="suitabilityScore"
            range={[60, 400]}
            name="Suitability Score"
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value: number, name: string) => [value, name]}
            labelFormatter={() => ""}
          />
          <Scatter data={data}>
            {data.map((point, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CLASSIFICATION_COLORS[point.classification] ?? "#64748b"}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
