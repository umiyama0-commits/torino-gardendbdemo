"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MODEL_LAYER_CONFIG,
  VALUE_AXIS_CONFIG,
  PROVENANCE_CONFIG,
  THEORY_TAG_COLOR,
} from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";

type BookmarkItem = {
  id: string;
  createdAt: string | Date;
  observation: {
    id: string;
    text: string;
    textEn: string | null;
    modelLayer: string;
    primaryValueAxis: string | null;
    provenance: string;
    confidence: string;
    trustScore: number;
    estimatedImpactMin: number | null;
    estimatedImpactMax: number | null;
    impactKPI: string | null;
    createdAt: string | Date;
    store: {
      name: string;
      client: {
        name: string;
        industryMajor: string;
        industryMinor: string | null;
      };
    } | null;
    tags: {
      tag: {
        id: string;
        type: string;
        code: string;
        displayNameJa: string;
        displayNameEn: string | null;
        modelLayer: string | null;
      };
    }[];
  };
};

export function BookmarksList({
  bookmarks: initialBookmarks,
}: {
  bookmarks: BookmarkItem[];
}) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(bookmarkId: string, observationId: string) {
    setRemovingId(bookmarkId);
    try {
      const res = await fetch(`/api/observations/${observationId}/bookmark`, {
        method: "POST",
      });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      }
    } catch {
      // silently fail
    } finally {
      setRemovingId(null);
    }
  }

  if (bookmarks.length === 0) {
    return (
      <Card className="border border-zinc-200 shadow-md">
        <CardContent className="py-16 text-center">
          <div className="text-4xl mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="size-12 mx-auto text-zinc-300"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-500">
            ブックマークはまだありません
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            No bookmarks yet. Star observations to save them here.
          </p>
          <Link
            href="/observations"
            className="inline-block mt-4 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Observations を見る / Browse Observations
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-500">
        {bookmarks.length}件のブックマーク / {bookmarks.length} bookmarked
      </div>

      <div className="space-y-3">
        {bookmarks.map((bm) => {
          const obs = bm.observation;
          const layerCfg =
            MODEL_LAYER_CONFIG[
              obs.modelLayer as keyof typeof MODEL_LAYER_CONFIG
            ];
          const axisCfg = obs.primaryValueAxis
            ? VALUE_AXIS_CONFIG[
                obs.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG
              ]
            : null;
          const provCfg =
            PROVENANCE_CONFIG[
              obs.provenance as keyof typeof PROVENANCE_CONFIG
            ];

          return (
            <Card
              key={bm.id}
              className="border border-zinc-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
            >
              <div
                className="h-0.5"
                style={{
                  backgroundColor: layerCfg?.color || "#e4e4e7",
                }}
              />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <Link
                      href={`/observations/${obs.id}`}
                      className="block group"
                    >
                      <p className="text-sm font-medium leading-relaxed group-hover:text-blue-600 transition-colors">
                        {obs.text}
                      </p>
                      {obs.textEn && (
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {obs.textEn}
                        </p>
                      )}
                    </Link>
                    {obs.store && (
                      <div className="text-[11px] text-zinc-400">
                        {obs.store.client.name} / {obs.store.name}
                        <span className="ml-2 text-zinc-300">|</span>
                        <span className="ml-2">
                          {obs.store.client.industryMajor}
                          {obs.store.client.industryMinor
                            ? ` > ${obs.store.client.industryMinor}`
                            : ""}
                        </span>
                      </div>
                    )}
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {layerCfg && (
                        <Badge
                          className="text-white border-0 text-[10px]"
                          style={{ backgroundColor: layerCfg.color }}
                        >
                          {layerCfg.label}
                        </Badge>
                      )}
                      {axisCfg && (
                        <Badge
                          className="text-white border-0 text-[10px]"
                          style={{ backgroundColor: axisCfg.color }}
                        >
                          {axisCfg.labelJa}
                        </Badge>
                      )}
                      {provCfg && (
                        <Badge
                          className="text-white border-0 text-[10px]"
                          style={{ backgroundColor: provCfg.color }}
                        >
                          {provCfg.labelJa}
                        </Badge>
                      )}
                      <TrustBadge score={obs.trustScore} />
                      {obs.tags.map(({ tag }) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0"
                          style={
                            tag.type === "THEORY"
                              ? {
                                  borderColor: THEORY_TAG_COLOR,
                                  color: THEORY_TAG_COLOR,
                                }
                              : tag.type === "BEHAVIOR" && tag.modelLayer
                                ? {
                                    borderColor:
                                      MODEL_LAYER_CONFIG[
                                        tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG
                                      ]?.color,
                                    color:
                                      MODEL_LAYER_CONFIG[
                                        tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG
                                      ]?.color,
                                  }
                                : {}
                          }
                        >
                          {tag.displayNameJa}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemove(bm.id, obs.id)}
                      disabled={removingId === bm.id}
                      className="rounded-md px-2.5 py-1 text-[11px] font-medium text-red-500 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-150 disabled:opacity-50 flex items-center gap-1"
                      title="ブックマーク解除 / Remove bookmark"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-3"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {removingId === bm.id ? "..." : "解除 / Remove"}
                    </button>
                    <ImpactBadge
                      min={obs.estimatedImpactMin}
                      max={obs.estimatedImpactMax}
                      kpi={obs.impactKPI}
                    />
                    <span className="text-[10px] text-zinc-400">
                      {new Date(obs.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
