"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG } from "@/lib/constants";

type ExtractedObservation = {
  text: string;
  modelLayer: string;
  valueAxis: string;
  confidence: string;
  impact: string;
  included: boolean;
};

type ExtractionState = "idle" | "extracting" | "reviewing" | "saving" | "done";

export function ExtractionReview({
  fileId,
  onComplete,
}: {
  fileId: string;
  onComplete: () => void;
}) {
  const [state, setState] = useState<ExtractionState>("idle");
  const [observations, setObservations] = useState<ExtractedObservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  async function handleExtract() {
    setState("extracting");
    setError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Extraction failed");
      }

      const data = await res.json();
      const extracted: ExtractedObservation[] = (data.observations || []).map(
        (obs: Record<string, string>) => ({
          text: obs.text || "",
          modelLayer: obs.modelLayer || "MOVEMENT",
          valueAxis: obs.valueAxis || "REVENUE_UP",
          confidence: obs.confidence || "MEDIUM",
          impact: obs.impact || "",
          included: true,
        })
      );

      setObservations(extracted);
      setState(extracted.length > 0 ? "reviewing" : "idle");
      if (extracted.length === 0) {
        setError(
          "抽出結果がありません / No observations were extracted from this file."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "抽出に失敗しました / Extraction failed"
      );
      setState("idle");
    }
  }

  function toggleInclude(index: number) {
    setObservations((prev) =>
      prev.map((obs, i) =>
        i === index ? { ...obs, included: !obs.included } : obs
      )
    );
  }

  function updateField(
    index: number,
    field: keyof ExtractedObservation,
    value: string
  ) {
    setObservations((prev) =>
      prev.map((obs, i) => (i === index ? { ...obs, [field]: value } : obs))
    );
  }

  async function handleSaveAll() {
    const included = observations.filter((o) => o.included);
    if (included.length === 0) return;

    setState("saving");
    setError(null);

    try {
      const res = await fetch("/api/observations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          observations: included.map((o) => ({
            text: o.text,
            modelLayer: o.modelLayer,
            primaryValueAxis: o.valueAxis,
            confidence: o.confidence,
            impact: o.impact,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      const data = await res.json();
      setSavedCount(data.count || included.length);
      setState("done");
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "保存に失敗しました / Save failed"
      );
      setState("reviewing");
    }
  }

  if (state === "idle") {
    return (
      <div className="mt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExtract}
          className="text-[11px] h-7 gap-1.5"
        >
          <span className="text-xs">&#x2728;</span>
          AI抽出 / Extract
        </Button>
        {error && (
          <p className="text-xs text-red-500 mt-1.5">{error}</p>
        )}
      </div>
    );
  }

  if (state === "extracting") {
    return (
      <Card className="border-0 shadow-sm mt-3">
        <CardContent className="py-8 text-center">
          <div className="animate-spin text-2xl mb-3">&#x25CC;</div>
          <p className="text-sm text-zinc-600 font-medium">
            LLM抽出中... / Extracting with AI...
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            ファイルからObservationを自動抽出しています
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state === "done") {
    return (
      <Card className="border-0 shadow-sm mt-3">
        <CardContent className="py-8 text-center">
          <div className="text-2xl mb-3 text-emerald-500">&#x2713;</div>
          <p className="text-sm text-emerald-700 font-medium">
            {savedCount}件のObservationを保存しました
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {savedCount} observations saved successfully
          </p>
        </CardContent>
      </Card>
    );
  }

  // reviewing or saving state
  const includedCount = observations.filter((o) => o.included).length;

  return (
    <Card className="border-0 shadow-sm mt-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>
            抽出結果レビュー{" "}
            <span className="text-zinc-400 font-normal text-xs">
              / Review Extracted Observations
            </span>
          </span>
          <span className="text-xs text-zinc-400 font-normal">
            {includedCount}/{observations.length}件選択中
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {observations.map((obs, i) => {
          const layerCfg =
            MODEL_LAYER_CONFIG[
              obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG
            ];
          const axisCfg =
            VALUE_AXIS_CONFIG[
              obs.valueAxis as keyof typeof VALUE_AXIS_CONFIG
            ];

          return (
            <div
              key={i}
              className={`rounded-lg border p-3 space-y-2 transition-all duration-200 ${
                obs.included
                  ? "border-zinc-200 bg-white"
                  : "border-zinc-100 bg-zinc-50 opacity-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <label className="flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={obs.included}
                    onChange={() => toggleInclude(i)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  />
                </label>
                <div className="flex-1 space-y-2">
                  <Input
                    value={obs.text}
                    onChange={(e) => updateField(i, "text", e.target.value)}
                    className="text-sm h-8"
                    placeholder="Observation text..."
                    disabled={!obs.included}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={obs.modelLayer}
                      onChange={(e) =>
                        updateField(i, "modelLayer", e.target.value)
                      }
                      disabled={!obs.included}
                      className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:ring-1 focus:ring-zinc-400"
                    >
                      {Object.entries(MODEL_LAYER_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.labelJa} / {v.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={obs.valueAxis}
                      onChange={(e) =>
                        updateField(i, "valueAxis", e.target.value)
                      }
                      disabled={!obs.included}
                      className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:ring-1 focus:ring-zinc-400"
                    >
                      {Object.entries(VALUE_AXIS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.labelJa} / {v.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={obs.confidence}
                      onChange={(e) =>
                        updateField(i, "confidence", e.target.value)
                      }
                      disabled={!obs.included}
                      className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-700 focus:ring-1 focus:ring-zinc-400"
                    >
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                    <Input
                      value={obs.impact}
                      onChange={(e) =>
                        updateField(i, "impact", e.target.value)
                      }
                      placeholder="Impact..."
                      disabled={!obs.included}
                      className="h-7 w-32 text-[11px]"
                    />
                    {layerCfg && (
                      <Badge
                        className="text-white border-0 text-[9px]"
                        style={{ backgroundColor: layerCfg.color }}
                      >
                        {layerCfg.label}
                      </Badge>
                    )}
                    {axisCfg && (
                      <Badge
                        className="text-white border-0 text-[9px]"
                        style={{ backgroundColor: axisCfg.color }}
                      >
                        {axisCfg.labelJa}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setObservations([]);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            キャンセル / Cancel
          </button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={state === "saving" || includedCount === 0}
            className="text-[11px] h-8 gap-1.5"
          >
            {state === "saving" ? (
              <>
                <span className="animate-spin">&#x25CC;</span>
                保存中... / Saving...
              </>
            ) : (
              <>
                一括保存 / Save All ({includedCount}件)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
