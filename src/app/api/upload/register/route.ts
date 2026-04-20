import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const MIME_TO_TYPE: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
  "image/png": "PNG",
  "image/jpeg": "JPG",
};

export async function POST(request: NextRequest) {
  const { fileName, mimeType, fileSize, blobUrl } = await request.json();

  if (!fileName || !mimeType || !blobUrl) {
    return NextResponse.json(
      { error: "fileName/mimeType/blobUrl が必要です" },
      { status: 400 }
    );
  }

  const fileType = MIME_TO_TYPE[mimeType];
  if (!fileType) {
    return NextResponse.json(
      { error: `未対応のファイル形式です: ${mimeType}` },
      { status: 400 }
    );
  }

  const rawFile = await prisma.rawFile.create({
    data: {
      fileName,
      fileType,
      mimeType,
      fileSize: fileSize ?? 0,
      blobUrl,
      status: "uploaded",
    },
  });

  return NextResponse.json(rawFile, { status: 201 });
}
