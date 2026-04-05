"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  BarChart,
  PieChart,
  Area,
  Bar,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MODEL_LAYER_CONFIG, PROVENANCE_CONFIG } from "@/lib/constants";

interface MonthlyData {
  month: string;
  count: number;
}

interface ImpactBucket {
  range: string;
  count: number;
}

interface LayerTrendData {
  month: string;
  MOVEMENT: number;
  APPROACH: number;
  BREAKDOWN: number;
  TRANSFER: number;
}

interface ProvenanceData {
  name: string;
  nameJa: string;
  value: number;
  color: string;
}

interface ChartsData {
  monthlyObservations: MonthlyData[];
  impactDistribution: ImpactBucket[];
  layerTrend: LayerTrendData[];
  provenanceDistribution: ProvenanceData[];
}

const IMPACT_GRADIENT_COLORS = [
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#18181b",
];

function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-1/3 rounded bg-zinc-100" />
      <div className="h-[280px] rounded bg-zinc-50" />
    </div>
  );
}

export default function DashboardCharts() {
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/charts")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border border-zinc-200 shadow-md">
            <CardContent className="pt-6">
              <ChartSkeleton />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Monthly Observations - AreaChart */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Monthly Observations <span className="text-zinc-300">/</span> 月別観測数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.monthlyObservations} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="fillZinc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18181b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#18181b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#18181b"
                strokeWidth={2}
                fill="url(#fillZinc)"
                name="観測数"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Impact Distribution - BarChart */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Impact Distribution <span className="text-zinc-300">/</span> インパクト分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.impactDistribution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                {IMPACT_GRADIENT_COLORS.map((color, i) => (
                  <linearGradient key={i} id={`impactGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
              />
              <Bar dataKey="count" name="件数" radius={[4, 4, 0, 0]}>
                {data.impactDistribution.map((_, i) => (
                  <Cell key={i} fill={`url(#impactGrad${i % IMPACT_GRADIENT_COLORS.length})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Model Layer Trend - Stacked AreaChart */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Model Layer Trend <span className="text-zinc-300">/</span> 4層モデル推移
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.layerTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                {(Object.entries(MODEL_LAYER_CONFIG) as [string, { color: string }][]).map(
                  ([key, cfg]) => (
                    <linearGradient key={key} id={`layer${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cfg.color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={cfg.color} stopOpacity={0.05} />
                    </linearGradient>
                  )
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
              />
              {(Object.entries(MODEL_LAYER_CONFIG) as [string, { color: string; labelJa: string }][]).map(
                ([key, cfg]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="1"
                    stroke={cfg.color}
                    strokeWidth={1.5}
                    fill={`url(#layer${key})`}
                    name={cfg.labelJa}
                  />
                )
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Provenance Distribution - PieChart */}
      <Card className="border border-zinc-200 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Provenance Distribution <span className="text-zinc-300">/</span> 知見出自分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.provenanceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                nameKey="nameJa"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.provenanceDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                formatter={(value, name) => [`${value}件`, name]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                formatter={(value: string) => {
                  const entry = data.provenanceDistribution.find((d) => d.nameJa === value);
                  return entry ? `${entry.nameJa} / ${entry.name}` : value;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
