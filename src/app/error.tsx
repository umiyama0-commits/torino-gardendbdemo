"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-5xl">&#9888;&#65039;</div>
        <h2 className="text-xl font-bold text-zinc-800">
          ページの読み込みに失敗しました
        </h2>
        <p className="text-sm text-zinc-500">
          サーバーとの接続に一時的な問題が発生しました。
          リロードで解消することがあります。
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={reset}>再試行</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            ホームへ戻る
          </Button>
        </div>
        {error.digest && (
          <p className="text-[10px] text-zinc-300 pt-4">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
