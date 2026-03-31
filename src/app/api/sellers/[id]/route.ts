import { NextRequest, NextResponse } from "next/server";
import { getSellerWithStats, deleteSeller, getPhones, getTransactions } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSellerWithStats(Number(id));
  if (!seller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const phones = await getPhones({ seller_id: Number(id) });
  const transactions = await getTransactions({ seller_id: Number(id) });
  return NextResponse.json({ seller, phones, transactions });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteSeller(Number(id));
  return new NextResponse(null, { status: 204 });
}
