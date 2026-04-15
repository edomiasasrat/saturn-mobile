import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats, getTopSellers, getPhoneActivity } from "@/lib/db";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") || "today";
  const [stats, topSellers, phoneActivity] = await Promise.all([
    getDashboardStats(period),
    getTopSellers(5),
    getPhoneActivity(period),
  ]);
  return NextResponse.json({ stats, topSellers, phoneActivity });
}
