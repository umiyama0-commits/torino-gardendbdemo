import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { fileId } = await request.json();

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const rawFile = await prisma.rawFile.findUnique({ where: { id: fileId } });
  if (!rawFile) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Update status
  await prisma.rawFile.update({
    where: { id: fileId },
    data: { status: "extracting" },
  });

  try {
    let extractedText = "";

    if (rawFile.fileType === "PDF") {
      extractedText = await extractPdfText(rawFile.blobUrl);
    } else if (rawFile.fileType === "DOCX") {
      extractedText = await extractDocxText(rawFile.blobUrl);
    } else if (rawFile.fileType === "TXT" || rawFile.fileType === "CSV") {
      extractedText = await extractPlainText(rawFile.blobUrl);
    } else if (["MP4", "MOV"].includes(rawFile.fileType)) {
      // 動画はテキスト抽出不可 → ファイル名から推定
      extractedText = `[動画ファイル] ${rawFile.fileName}`;
    } else if (["PNG", "JPG"].includes(rawFile.fileType)) {
      extractedText = `[画像ファイル] ${rawFile.fileName}`;
    }

    // Save extracted text (長い報告書PDFも保持できるよう200KBに拡張)
    const updated = await prisma.rawFile.update({
      where: { id: fileId },
      data: {
        extractedText: extractedText.slice(0, 200000),
        status: "extracted",
      },
    });

    // 単発のsuggestMetadataは廃止 (クライアント側で /api/bulk-extract を呼び、
    // 複数観測に自動分割する方式に変更済み)
    return NextResponse.json({ file: updated });
  } catch (err) {
    console.error("Extract error:", err);
    await prisma.rawFile.update({
      where: { id: fileId },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
    return NextResponse.json(
      { error: "テキスト抽出に失敗しました" },
      { status: 500 }
    );
  }
}

async function extractPdfText(url: string): Promise<string> {
  const res = await fetch(url);
  const arrayBuf = await res.arrayBuffer();
  // unpdf はサーバレス環境(DOMMatrix未定義)でも動作する
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocxText(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPlainText(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}
