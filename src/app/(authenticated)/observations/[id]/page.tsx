import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG, THEORY_TAG_COLOR } from "@/lib/constants";
import { TrustBadge, ImpactBadge } from "@/components/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ObservationDetailClient } from "./observation-detail-client";
import { CommentsSection } from "@/components/comments-section";
import { BookmarkButton } from "@/components/bookmark-button";
import { HistoryPanel } from "./history-panel";
import { MeasurementsPanel } from "./measurements-panel";

export default async function ObservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const observation = await prisma.observation.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: true } },
      comments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      bookmarks: true,
    },
  });

  if (!observation) notFound();

  const isBookmarked = observation.bookmarks.some((b) => b.userId === user.id);

  // Fetch related insights: same modelLayer or overlapping tags
  const tagIds = observation.tags.map((t) => t.tagId);
  const relatedInsights = await prisma.insight.findMany({
    where: {
      OR: [
        { modelLayer: observation.modelLayer },
        ...(tagIds.length > 0
          ? [{ tags: { some: { tagId: { in: tagIds } } } }]
          : []),
      ],
    },
    include: { tags: { include: { tag: true } } },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  // Fetch measurements
  const measurements = await prisma.observationMeasurement.findMany({
    where: { observationId: id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  // Fetch similar observations: same modelLayer, exclude current
  const similarObservations = await prisma.observation.findMany({
    where: {
      modelLayer: observation.modelLayer,
      id: { not: observation.id },
    },
    include: {
      tags: { include: { tag: true } },
      store: { include: { client: true } },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const layerCfg = MODEL_LAYER_CONFIG[observation.modelLayer as keyof typeof MODEL_LAYER_CONFIG];
  const axisCfg = observation.primaryValueAxis
    ? VALUE_AXIS_CONFIG[observation.primaryValueAxis as keyof typeof VALUE_AXIS_CONFIG]
    : null;
  const provCfg = PROVENANCE_CONFIG[observation.provenance as keyof typeof PROVENANCE_CONFIG];

  const serializedObservation = {
    ...observation,
    observedAt: observation.observedAt?.toISOString() || null,
    createdAt: observation.createdAt.toISOString(),
    updatedAt: observation.updatedAt.toISOString(),
    comments: observation.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    bookmarks: observation.bookmarks.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link href="/observations" className="hover:text-zinc-600 transition-colors">
          Observations / 観測事実
        </Link>
        <span>/</span>
        <span className="text-zinc-600">Detail / 詳細</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {layerCfg && (
              <div className="h-6 w-1 rounded-full" style={{ backgroundColor: layerCfg.color }} />
            )}
            <h1 className="text-xl font-bold tracking-tight leading-relaxed">{observation.text}</h1>
          </div>
          {observation.textEn && (
            <p className="text-sm text-zinc-400 leading-relaxed pl-3">{observation.textEn}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BookmarkButton observationId={observation.id} initialBookmarked={isBookmarked} />
          <ObservationDetailClient
            observation={serializedObservation}
            user={user}
          />
        </div>
      </div>

      {/* Metadata Grid */}
      <Card className="border border-zinc-200 shadow-md">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetadataItem
              label="Layer / 4層モデル"
              value={
                layerCfg ? (
                  <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: layerCfg.color }}>
                    {layerCfg.label} / {layerCfg.labelJa}
                  </Badge>
                ) : (
                  <span className="text-zinc-400">--</span>
                )
              }
            />
            <MetadataItem
              label="Value Axis / 価値軸"
              value={
                axisCfg ? (
                  <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: axisCfg.color }}>
                    {axisCfg.label} / {axisCfg.labelJa}
                  </Badge>
                ) : (
                  <span className="text-zinc-400">--</span>
                )
              }
            />
            <MetadataItem
              label="Provenance / 出自"
              value={
                provCfg ? (
                  <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: provCfg.color }}>
                    {provCfg.label} / {provCfg.labelJa}
                  </Badge>
                ) : (
                  <span className="text-zinc-400">--</span>
                )
              }
            />
            <MetadataItem
              label="Confidence / 確信度"
              value={
                <span className="text-xs font-medium text-zinc-700">{observation.confidence}</span>
              }
            />
            <MetadataItem
              label="Trust / 信頼度"
              value={<TrustBadge score={observation.trustScore} />}
            />
            <MetadataItem
              label="Impact / インパクト"
              value={
                observation.estimatedImpactMin != null && observation.estimatedImpactMax != null ? (
                  <ImpactBadge
                    min={observation.estimatedImpactMin}
                    max={observation.estimatedImpactMax}
                    kpi={observation.impactKPI}
                  />
                ) : (
                  <span className="text-zinc-400">--</span>
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {observation.tags.length > 0 && (
        <Card className="border border-zinc-200 shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tags / タグ</h3>
              <div className="flex flex-wrap gap-1.5">
                {observation.tags.map(({ tag }) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-[10px] px-2 py-0.5"
                    style={
                      tag.type === "THEORY"
                        ? { borderColor: THEORY_TAG_COLOR, color: THEORY_TAG_COLOR }
                        : tag.type === "BEHAVIOR" && tag.modelLayer
                        ? {
                            borderColor: MODEL_LAYER_CONFIG[tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color,
                            color: MODEL_LAYER_CONFIG[tag.modelLayer as keyof typeof MODEL_LAYER_CONFIG]?.color,
                          }
                        : {}
                    }
                  >
                    {tag.displayNameJa}
                    {tag.displayNameEn && (
                      <span className="text-zinc-400 ml-1">/ {tag.displayNameEn}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Measurement Data / 計測データ */}
      <MeasurementsPanel
        observationId={observation.id}
        initialMeasurements={measurements.map(m => ({
          id: m.id,
          category: m.category,
          label: m.label,
          value: m.value,
          unit: m.unit,
          sortOrder: m.sortOrder,
        }))}
        canEdit={user.role === "admin" || user.role === "consultant"}
      />

      {/* Client / Store Info */}
      {observation.store && (
        <Card className="border border-zinc-200 shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Client & Store / クライアント・店舗</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetadataItem label="Client / クライアント" value={<span className="text-xs font-medium">{observation.store.client.name}</span>} />
                <MetadataItem label="Store / 店舗" value={<span className="text-xs font-medium">{observation.store.name}</span>} />
                <MetadataItem
                  label="Industry / 業種"
                  value={
                    <span className="text-xs">
                      {observation.store.client.industryMajor}
                      {observation.store.client.industryMinor && ` > ${observation.store.client.industryMinor}`}
                    </span>
                  }
                />
                <MetadataItem
                  label="Industry (EN)"
                  value={
                    <span className="text-xs text-zinc-500">
                      {observation.store.client.industryMajorEn || "--"}
                      {observation.store.client.industryMinorEn && ` > ${observation.store.client.industryMinorEn}`}
                    </span>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Info */}
      {(observation.sourceType || observation.sourceUrl || observation.sourceTitle) && (
        <Card className="border border-zinc-200 shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Source / ソース</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {observation.sourceType && (
                  <MetadataItem label="Type / 種別" value={<span className="text-xs">{observation.sourceType}</span>} />
                )}
                {observation.sourceTitle && (
                  <MetadataItem label="Title / タイトル" value={<span className="text-xs">{observation.sourceTitle}</span>} />
                )}
                {observation.sourceUrl && (
                  <MetadataItem
                    label="URL"
                    value={
                      <a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                        {observation.sourceUrl}
                      </a>
                    }
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comments Section - 2 col */}
        <div className="lg:col-span-2">
          <CommentsSection
            observationId={observation.id}
            initialComments={serializedObservation.comments}
            currentUserId={user.id}
          />
        </div>

        {/* History Panel - 1 col */}
        <div>
          <HistoryPanel observationId={observation.id} />
        </div>
      </div>

      {/* Related Insights */}
      {relatedInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Related Insights / 関連インサイト</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedInsights.map((insight) => {
              const iLayerCfg = insight.modelLayer
                ? MODEL_LAYER_CONFIG[insight.modelLayer as keyof typeof MODEL_LAYER_CONFIG]
                : null;
              return (
                <Card key={insight.id} className="border border-zinc-200 shadow-md">
                  <div className="h-0.5" style={{ backgroundColor: iLayerCfg?.color || "#e4e4e7" }} />
                  <CardContent className="pt-3 pb-3">
                    <p className="text-xs font-medium leading-relaxed line-clamp-3">{insight.text}</p>
                    {insight.textEn && (
                      <p className="text-[10px] text-zinc-400 mt-1 line-clamp-2">{insight.textEn}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {iLayerCfg && (
                        <Badge className="text-white border-0 text-[9px]" style={{ backgroundColor: iLayerCfg.color }}>
                          {iLayerCfg.label}
                        </Badge>
                      )}
                      <TrustBadge score={insight.trustScore} />
                      <ImpactBadge min={insight.estimatedImpactMin} max={insight.estimatedImpactMax} kpi={insight.impactKPI} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Similar Observations */}
      {similarObservations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Similar Observations / 類似観測</h2>
          <div className="space-y-2">
            {similarObservations.map((sim) => {
              const sLayerCfg = MODEL_LAYER_CONFIG[sim.modelLayer as keyof typeof MODEL_LAYER_CONFIG];
              return (
                <Link key={sim.id} href={`/observations/${sim.id}`}>
                  <Card className="border border-zinc-200 shadow-md hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    <div className="h-0.5" style={{ backgroundColor: sLayerCfg?.color || "#e4e4e7" }} />
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-medium leading-relaxed line-clamp-2">{sim.text}</p>
                          {sim.textEn && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{sim.textEn}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {sLayerCfg && (
                            <Badge className="text-white border-0 text-[9px]" style={{ backgroundColor: sLayerCfg.color }}>
                              {sLayerCfg.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {sim.store && (
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {sim.store.client.name} / {sim.store.name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="flex items-center gap-6 text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
        {observation.observedAt && (
          <span className="text-zinc-600 font-medium">
            <span className="text-[10px] text-zinc-400 mr-1">観測日</span>
            {new Date(observation.observedAt).toLocaleDateString("ja-JP")}
          </span>
        )}
        <span>
          <span className="text-[10px] text-zinc-300 mr-1">登録</span>
          {new Date(observation.createdAt).toLocaleDateString("ja-JP")} {new Date(observation.createdAt).toLocaleTimeString("ja-JP")}
        </span>
        <span>
          <span className="text-[10px] text-zinc-300 mr-1">更新</span>
          {new Date(observation.updatedAt).toLocaleDateString("ja-JP")} {new Date(observation.updatedAt).toLocaleTimeString("ja-JP")}
        </span>
      </div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{label}</div>
      <div>{value}</div>
    </div>
  );
}
