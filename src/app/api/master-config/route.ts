import { loadAppConfig } from "@/lib/master-config";
import { NextResponse } from "next/server";

export async function GET() {
  const config = await loadAppConfig();
  return NextResponse.json(config);
}
