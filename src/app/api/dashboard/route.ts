import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats, getTopSellers } from "@/lib/db";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") || "today";
  const [stats, topSellers] = await Promise.all([
    getDashboardStats(period),
    getTopSellers(5),
  ]);
  return NextResponse.json({ stats, topSellers });
}
