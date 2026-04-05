import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { extractTextFromFile } from "@/lib/file-parser";
import { extractObservationsFromText } from "@/lib/llm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { fileId } = body;

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: "processing" },
    });

    const extractedText = await extractTextFromFile(file.storedPath, file.mimeType);
    const observations = await extractObservationsFromText(extractedText);

    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: {
        extractedText,
        extractionResult: JSON.stringify(observations),
        status: "extracted",
      },
    });

    return NextResponse.json({ observations });
  } catch (error) {
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { status: "error" },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
