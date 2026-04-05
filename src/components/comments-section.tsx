"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

type Comment = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export function CommentsSection({
  observationId,
  initialComments,
  currentUserId,
}: {
  observationId: string;
  initialComments: Comment[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSubmit() {
    if (!newComment.trim()) return;
    const text = newComment;
    setNewComment("");

    startSubmit(async () => {
      try {
        const res = await fetch(`/api/observations/${observationId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = await res.json();
          setComments((prev) => [
            { ...data, createdAt: data.createdAt, updatedAt: data.updatedAt },
            ...prev,
          ]);
        }
      } catch {
        setNewComment(text);
      }
    });
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    try {
      const res = await fetch(
        `/api/observations/${observationId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } finally {
      setDeletingId(null);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now / たった今";
    if (diffMin < 60) return `${diffMin}m ago / ${diffMin}分前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago / ${diffHr}時間前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago / ${diffDay}日前`;
    return d.toLocaleDateString("ja-JP");
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Comments / コメント ({comments.length})
          </h3>

          {/* Add comment form */}
          <div className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment... / コメントを追加..."
              rows={2}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">Cmd+Enter to submit</span>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !newComment.trim()}
              >
                {isSubmitting ? "Posting..." : "Post / 投稿"}
              </Button>
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">
              No comments yet / まだコメントはありません
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  {/* Avatar */}
                  <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 text-xs font-semibold">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-700">{comment.user.name}</span>
                      <span className="text-[10px] text-zinc-400">{formatTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-zinc-600 mt-0.5 whitespace-pre-wrap">{comment.text}</p>
                  </div>
                  {/* Delete button */}
                  {comment.user.id === currentUserId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 text-xs"
                      title="Delete / 削除"
                    >
                      {deletingId === comment.id ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
