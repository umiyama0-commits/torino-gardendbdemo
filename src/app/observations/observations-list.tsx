"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MODEL_LAYER_CONFIG,
  VALUE_AXIS_CONFIG,
  PROVENANCE_CONFIG,
  CONFIDENCE_CONFIG,
} from "@/lib/constants";

type Observation = {
  id: string;
  text: string;
  summary: string | null;
  modelLayer: string;
  primaryValueAxis: string | null;
  provenance: string;
  confidence: string;
  createdAt: string | Date;
  project: { name: string; client: { industry: string; industryDetail: string | null } } | null;
  store: { name: string; client: { industry: string; industryDetail: string | null } } | null;
  tags: { tag: { id: string; code: string; displayNameJa: string; type: string } }[];
};

type Props = {
  observations: Observation[];
  industries: string[];
};

const FILTER_PROVENANCE = [
  { value: "ALL", label: "すべて" },
  { value: "FIELD_OBSERVED", label: "①固有知" },
  { value: "ANONYMIZED_DERIVED", label: "②汎用知" },
  { value: "PUBLIC_CODIFIED", label: "③公知" },
];

const FILTER_LAYER = [
  { value: "ALL", label: "すべて" },
  { value: "MOVEMENT", label: "動線" },
  { value: "APPROACH", label: "接点" },
  { value: "BREAKDOWN", label: "離脱" },
  { value: "TRANSFER", label: "伝承" },
];

const FILTER_VALUE = [
  { value: "ALL", label: "すべて" },
  { value: "REVENUE_UP", label: "売上向上" },
  { value: "COST_DOWN", label: "コスト削減" },
  { value: "RETENTION", label: "継続率向上" },
];

export function ObservationsList({ observations, industries }: Props) {
  const [filterProvenance, setFilterProvenance] = useState("ALL");
  const [filterLayer, setFilterLayer] = useState("ALL");
  const [filterValue, setFilterValue] = useState("ALL");
  const [filterIndustry, setFilterIndustry] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getIndustry = (obs: Observation) =>
    obs.store?.client?.industryDetail ||
    obs.store?.client?.industry ||
    obs.project?.client?.industryDetail ||
    obs.project?.client?.industry ||
    null;

  const filtered = observations.filter((obs) => {
    if (filterProvenance !== "ALL" && obs.provenance !== filterProvenance) return false;
    if (filterLayer !== "ALL" && obs.modelLayer !== filterLayer) return false;
    if (filterValue !== "ALL" && obs.primaryValueAxis !== filterValue) return false;
    if (filterIndustry !== "ALL" && getIndustry(obs) !== filterIndustry) return false;
    return true;
  });

  const selected = selectedId ? observations.find((o) => o.id === selectedId) : null;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <FilterGroup
              label="プロベナンス"
              options={FILTER_PROVENANCE}
              value={filterProvenance}
              onChange={setFilterProvenance}
            />
            <FilterGroup
              label="モデル層"
              options={FILTER_LAYER}
              value={filterLayer}
              onChange={setFilterLayer}
            />
            <FilterGroup
              label="価値軸"
              options={FILTER_VALUE}
              value={filterValue}
              onChange={setFilterValue}
            />
            <FilterGroup
              label="業種"
              options={[
                { value: "ALL", label: "ALL" },
                ...industries.map((ind) => ({ value: ind, label: ind })),
              ]}
              value={filterIndustry}
              onChange={setFilterIndustry}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{filtered.length}件</p>
      </div>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-zinc-50/50">
              <TableHead className="w-[40%] text-xs font-medium">テキスト</TableHead>
              <TableHead className="w-[8%] text-xs font-medium">業種</TableHead>
              <TableHead className="w-[7%] text-xs font-medium">層</TableHead>
              <TableHead className="w-[9%] text-xs font-medium">価値軸</TableHead>
              <TableHead className="w-[9%] text-xs font-medium">プロベナンス</TableHead>
              <TableHead className="w-[18%] text-xs font-medium">タグ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((obs) => {
              const layerConfig = MODEL_LAYER_CONFIG[obs.modelLayer];
              const valueConfig = obs.primaryValueAxis
                ? VALUE_AXIS_CONFIG[obs.primaryValueAxis]
                : null;
              const provConfig = PROVENANCE_CONFIG[obs.provenance];
              const obsIndustry = getIndustry(obs);
              return (
                <TableRow
                  key={obs.id}
                  className="cursor-pointer hover:bg-blue-50/30 transition-colors"
                  onClick={() => setSelectedId(obs.id === selectedId ? null : obs.id)}
                >
                  <TableCell className="text-sm py-3">
                    <p className="truncate" title={obs.text}>
                      {obs.summary || obs.text}
                    </p>
                  </TableCell>
                  <TableCell>
                    {obsIndustry && (
                      <Badge className="bg-violet-50 border border-violet-200 text-violet-700 text-[11px] px-1.5 py-0">
                        {obsIndustry}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {layerConfig && (
                      <Badge className={`${layerConfig.bg} ${layerConfig.color} text-[11px] px-1.5 py-0`}>
                        {layerConfig.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {valueConfig && (
                      <Badge className={`${valueConfig.bg} ${valueConfig.color} text-[11px] px-1.5 py-0`}>
                        {valueConfig.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {provConfig && (
                      <Badge className={`${provConfig.bg} ${provConfig.color} text-[11px] px-1.5 py-0`}>
                        {provConfig.shortLabel}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {obs.tags.slice(0, 3).map((t) => (
                        <Badge
                          key={t.tag.id}
                          variant="outline"
                          className={`text-[11px] px-1.5 py-0 ${
                            t.tag.type === "THEORY"
                              ? "border-purple-200 text-purple-600 bg-purple-50"
                              : "border-zinc-200"
                          }`}
                        >
                          {t.tag.displayNameJa}
                        </Badge>
                      ))}
                      {obs.tags.length > 3 && (
                        <span className="text-[11px] text-zinc-400">
                          +{obs.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Panel */}
      {selected && (
        <Card className="shadow-sm border-l-4 border-l-blue-400">
          <CardContent className="pt-5 pb-5 space-y-4">
            <p className="font-medium leading-relaxed">{selected.text}</p>
            <div className="flex flex-wrap gap-2">
              {selected.tags.map((t) => (
                <Badge
                  key={t.tag.id}
                  variant="outline"
                  className={
                    t.tag.type === "THEORY"
                      ? "border-purple-200 text-purple-600 bg-purple-50"
                      : "border-zinc-200"
                  }
                >
                  {t.tag.displayNameJa}
                  <span className="text-zinc-400 ml-1">{t.tag.code}</span>
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {selected.project && (
                <div>
                  <p className="text-xs text-zinc-400">プロジェクト</p>
                  <p className="font-medium text-sm">{selected.project.name}</p>
                </div>
              )}
              {selected.store && (
                <div>
                  <p className="text-xs text-zinc-400">店舗</p>
                  <p className="font-medium text-sm">{selected.store.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-400">信頼度</p>
                <Badge className={`${CONFIDENCE_CONFIG[selected.confidence]?.bg} ${CONFIDENCE_CONFIG[selected.confidence]?.color} text-xs mt-0.5`}>
                  {CONFIDENCE_CONFIG[selected.confidence]?.label || selected.confidence}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-400">登録日</p>
                <p className="font-medium text-sm">
                  {new Date(selected.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => (
          <Badge
            key={opt.value}
            variant={value === opt.value ? "default" : "outline"}
            className={`cursor-pointer text-[11px] transition-all ${
              value === opt.value ? "" : "hover:bg-zinc-100"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
