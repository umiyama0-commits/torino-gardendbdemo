import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = formData.get("category") as string;
  const note = formData.get("note") as string | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !category) {
    return NextResponse.json({ error: "file and category are required" }, { status: 400 });
  }

  const validCategories = ["REPORT", "DAILY_LOG", "VIDEO"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Create uploads dir per category
  const uploadsDir = path.join(process.cwd(), "public", "uploads", category.toLowerCase());
  await mkdir(uploadsDir, { recursive: true });

  // Generate unique filename
  const ext = path.extname(file.name);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${timestamp}_${safeName}`;
  const storedPath = `/uploads/${category.toLowerCase()}/${storedName}`;
  const fullPath = path.join(uploadsDir, storedName);

  // Write file to disk
  const bytes = await file.arrayBuffer();
  await writeFile(fullPath, Buffer.from(bytes));

  // Permission check for consultants
  if (user.role === "consultant" && projectId) {
    const assignment = await prisma.projectAssignment.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Not assigned to this project" }, { status: 403 });
    }
  }

  // Save metadata to DB
  const uploaded = await prisma.uploadedFile.create({
    data: {
      category,
      originalName: file.name,
      storedPath,
      mimeType: file.type,
      fileSize: file.size,
      note: note || null,
      status: "uploaded",
      projectId: projectId || null,
      uploadedById: user.id,
    },
  });

  return NextResponse.json(uploaded);
}

export async function GET() {
  const files = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}
