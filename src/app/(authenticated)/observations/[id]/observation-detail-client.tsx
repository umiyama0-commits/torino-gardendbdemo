"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODEL_LAYER_CONFIG, VALUE_AXIS_CONFIG, PROVENANCE_CONFIG } from "@/lib/constants";

type SerializedObservation = {
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
  observedAt: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function ObservationDetailClient({
  observation,
  user,
}: {
  observation: SerializedObservation;
  user: User;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editText, setEditText] = useState(observation.text);
  const [editTextEn, setEditTextEn] = useState(observation.textEn || "");
  const [editModelLayer, setEditModelLayer] = useState(observation.modelLayer);
  const [editValueAxis, setEditValueAxis] = useState(observation.primaryValueAxis || "");
  const [editProvenance, setEditProvenance] = useState(observation.provenance);
  const [editConfidence, setEditConfidence] = useState(observation.confidence);
  const [editTrustScore, setEditTrustScore] = useState(observation.trustScore);
  const [editImpactMin, setEditImpactMin] = useState(observation.estimatedImpactMin?.toString() || "");
  const [editImpactMax, setEditImpactMax] = useState(observation.estimatedImpactMax?.toString() || "");
  const [editImpactKPI, setEditImpactKPI] = useState(observation.impactKPI || "");
  const [editObservedAt, setEditObservedAt] = useState(observation.observedAt ? new Date(observation.observedAt).toISOString().slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  const canEdit = user.role === "admin" || user.role === "consultant";

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editText,
          textEn: editTextEn || null,
          modelLayer: editModelLayer,
          primaryValueAxis: editValueAxis || null,
          provenance: editProvenance,
          confidence: editConfidence,
          trustScore: editTrustScore,
          estimatedImpactMin: editImpactMin ? parseFloat(editImpactMin) : null,
          estimatedImpactMax: editImpactMax ? parseFloat(editImpactMax) : null,
          impactKPI: editImpactKPI || null,
          observedAt: editObservedAt || null,
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/observations/${observation.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/observations");
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!canEdit) return null;

  return (
    <>
      {/* Edit Button */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          Edit / 編集
        </Button>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Observation / 観測事実を編集</DialogTitle>
            <DialogDescription>
              Update the observation details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs">Text / テキスト</Label>
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">English Text / 英語テキスト</Label>
              <Textarea value={editTextEn} onChange={(e) => setEditTextEn(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Layer / 4層</Label>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
                  value={editModelLayer}
                  onChange={(e) => setEditModelLayer(e.target.value)}
                >
                  {Object.entries(MODEL_LAYER_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} / {cfg.labelJa}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value Axis / 価値軸</Label>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
                  value={editValueAxis}
                  onChange={(e) => setEditValueAxis(e.target.value)}
                >
                  <option value="">-- None --</option>
                  {Object.entries(VALUE_AXIS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} / {cfg.labelJa}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provenance / 出自</Label>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
                  value={editProvenance}
                  onChange={(e) => setEditProvenance(e.target.value)}
                >
                  {Object.entries(PROVENANCE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label} / {cfg.labelJa}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confidence / 確信度</Label>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
                  value={editConfidence}
                  onChange={(e) => setEditConfidence(e.target.value)}
                >
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Trust Score / 信頼度</Label>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm bg-white"
                  value={editTrustScore}
                  onChange={(e) => setEditTrustScore(parseInt(e.target.value))}
                >
                  <option value={1}>1 - 単独</option>
                  <option value={2}>2 - 2層裏付</option>
                  <option value={3}>3 - 3層裏付</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Impact Min (%)</Label>
                <Input type="number" value={editImpactMin} onChange={(e) => setEditImpactMin(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Impact Max (%)</Label>
                <Input type="number" value={editImpactMax} onChange={(e) => setEditImpactMax(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Impact KPI</Label>
                <Input value={editImpactKPI} onChange={(e) => setEditImpactKPI(e.target.value)} placeholder="e.g. 売上, コスト削減率" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">観測日 / Observed Date</Label>
                <Input type="date" value={editObservedAt} onChange={(e) => setEditObservedAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel / キャンセル
            </DialogClose>
            <Button onClick={handleSave} disabled={saving || !editText.trim()}>
              {saving ? "Saving..." : "Save / 保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Button */}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          Delete / 削除
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Observation / 観測事実を削除</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this observation and all associated data.
              <br />
              この操作は取り消せません。この観測事実と関連データがすべて削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel / キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete / 削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
