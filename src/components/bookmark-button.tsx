"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function BookmarkButton({
  observationId,
  initialBookmarked,
}: {
  observationId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    // Optimistic update
    setBookmarked((prev) => !prev);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/observations/${observationId}/bookmark`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          setBookmarked(data.bookmarked);
        } else {
          // Revert on error
          setBookmarked((prev) => !prev);
        }
      } catch {
        // Revert on error
        setBookmarked((prev) => !prev);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      disabled={isPending}
      title={bookmarked ? "Remove bookmark / ブックマーク解除" : "Add bookmark / ブックマーク追加"}
      className="text-zinc-400 hover:text-zinc-700"
    >
      {bookmarked ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-4 text-amber-500"
        >
          <path
            fillRule="evenodd"
            d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
          />
        </svg>
      )}
    </Button>
  );
}
