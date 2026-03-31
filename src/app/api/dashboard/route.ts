import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? undefined;
  const stats = await getDashboardStats(period);
  return NextResponse.json(stats);
}
