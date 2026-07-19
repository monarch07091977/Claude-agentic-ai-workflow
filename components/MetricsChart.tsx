"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MetricRecord } from "@/lib/notion/metrics";

export function MetricsChart({ metrics }: { metrics: MetricRecord[] }) {
  if (metrics.length === 0) {
    return (
      <p className="mb-6 text-sm text-slate-500">
        Add a metric below to see the value-realization chart.
      </p>
    );
  }

  const data = metrics.map((metric) => ({
    name: metric.metricName,
    Baseline: metric.baseline,
    Current: metric.current,
    Target: metric.target,
  }));

  return (
    <div className="mb-6 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Baseline" fill="#94a3b8" />
          <Bar dataKey="Current" fill="#2563eb" />
          <Bar dataKey="Target" fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
