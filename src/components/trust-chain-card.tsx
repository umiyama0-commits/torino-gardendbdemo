"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  fieldSingleCount: number;
  fieldDoubleCount: number;
  fieldTripleCount: number;
  referenceOnlyCount: number;
};

export function TrustChainCard({
  fieldSingleCount,
  fieldDoubleCount,
  fieldTripleCount,
  referenceOnlyCount,
}: Props) {
  const chainTotal = fieldSingleCount + fieldDoubleCount + fieldTripleCount;
  const allTotal = chainTotal + referenceOnlyCount;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
          信頼度チェーン — 固有知を基軸とした裏付け構造
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500 mb-5">
          固有知（現場観測）を起点とするタグのみが信頼度チェーンの対象です。
          公知・汎用知のみのタグは「参考値」として分離表示されます。
        </p>

        {/* Main chain visualization */}
        <div className="flex items-end gap-3">
          {/* Field single */}
          <ChainColumn
            label="固有知（単層）"
            sublabel="現場観測のみ"
            count={fieldSingleCount}
            maxCount={allTotal}
            level="field-single"
          />
          {/* Field + 1 more */}
          <ChainColumn
            label="2層チェーン"
            sublabel="固有知 + 汎用知 or 公知"
            count={fieldDoubleCount}
            maxCount={allTotal}
            level="field-double"
          />
          {/* Field + derived + public */}
          <ChainColumn
            label="3層チェーン"
            sublabel="固有知 + 汎用知 + 公知"
            count={fieldTripleCount}
            maxCount={allTotal}
            level="field-triple"
          />
          {/* Separator */}
          <div className="flex flex-col items-center justify-end pb-8">
            <div className="w-px h-16 bg-zinc-200" />
          </div>
          {/* Reference only */}
          <ChainColumn
            label="参考値"
            sublabel="固有知なし（公知・汎用知のみ）"
            count={referenceOnlyCount}
            maxCount={allTotal}
            level="reference"
          />
        </div>

        {/* Summary */}
        <div className="mt-6 flex gap-3">
          <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              チェーン対象
            </p>
            <p className="text-xl font-bold mt-0.5">{chainTotal}</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              固有知を基軸とするタグ数
            </p>
          </div>
          <div className="flex-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">
              多層裏付け
            </p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">
              {fieldDoubleCount + fieldTripleCount}
            </p>
            <p className="text-[11px] text-blue-600 mt-1">
              うち3層完成: {fieldTripleCount}
            </p>
          </div>
          <div className="flex-1 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
            <p className="text-[10px] font-medium text-zinc-300 uppercase tracking-wider">
              参考値
            </p>
            <p className="text-xl font-bold text-zinc-400 mt-0.5">
              {referenceOnlyCount}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              チェーン対象外
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 grid grid-cols-4 gap-3">
          <LegendItem
            layers={["①固有知"]}
            desc="現場観測のみ"
            trust="基礎信頼"
            color="zinc"
          />
          <LegendItem
            layers={["①固有知", "+ ②or③"]}
            desc="業種横断 or 理論裏付け"
            trust="高信頼"
            color="blue"
          />
          <LegendItem
            layers={["①固有知", "②汎用知", "③公知"]}
            desc="3層完全チェーン"
            trust="最高信頼"
            color="emerald"
          />
          <LegendItem
            layers={["②or③のみ"]}
            desc="固有知なし"
            trust="参考値"
            color="gray"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ChainColumn({
  label,
  sublabel,
  count,
  maxCount,
  level,
}: {
  label: string;
  sublabel: string;
  count: number;
  maxCount: number;
  level: "field-single" | "field-double" | "field-triple" | "reference";
}) {
  const height = maxCount > 0 ? Math.max((count / maxCount) * 120, 8) : 8;
  const colors = {
    "field-single": "bg-zinc-300",
    "field-double": "bg-blue-400",
    "field-triple": "bg-gradient-to-t from-emerald-500 to-emerald-400",
    reference: "bg-zinc-100 border border-dashed border-zinc-300",
  };
  const ringColors = {
    "field-single": "",
    "field-double": "ring-2 ring-blue-200",
    "field-triple": "ring-2 ring-emerald-200",
    reference: "",
  };
  const countColors = {
    "field-single": "text-zinc-800",
    "field-double": "text-blue-700",
    "field-triple": "text-emerald-700",
    reference: "text-zinc-400",
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <span className={`text-2xl font-bold tabular-nums ${countColors[level]}`}>
        {count}
      </span>
      <div
        className={`w-full rounded-lg ${colors[level]} ${ringColors[level]} transition-all`}
        style={{ height: `${height}px` }}
      />
      <div className="text-center">
        <p className={`text-xs font-medium ${level === "reference" ? "text-zinc-400" : ""}`}>
          {label}
        </p>
        <p className="text-[10px] text-zinc-400">{sublabel}</p>
      </div>
    </div>
  );
}

function LegendItem({
  layers,
  desc,
  trust,
  color,
}: {
  layers: string[];
  desc: string;
  trust: string;
  color: string;
}) {
  const borderColor: Record<string, string> = {
    zinc: "border-zinc-200",
    blue: "border-blue-200",
    emerald: "border-emerald-200",
    gray: "border-zinc-100",
  };
  const bgColor: Record<string, string> = {
    zinc: "bg-zinc-50",
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    gray: "bg-zinc-50/50",
  };
  const textColor: Record<string, string> = {
    zinc: "text-zinc-600",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    gray: "text-zinc-400",
  };

  return (
    <div
      className={`rounded-lg border ${borderColor[color]} ${bgColor[color]} p-3`}
    >
      <div className="flex items-center gap-1 mb-1 flex-wrap">
        {layers.map((l) => (
          <span key={l} className={`text-[10px] font-medium ${color === "gray" ? "text-zinc-400" : "text-zinc-500"}`}>
            {l}
          </span>
        ))}
      </div>
      <p className={`text-[11px] ${color === "gray" ? "text-zinc-400" : "text-zinc-600"}`}>{desc}</p>
      <p className={`text-xs font-semibold mt-1 ${textColor[color]}`}>
        {trust}
      </p>
    </div>
  );
}
