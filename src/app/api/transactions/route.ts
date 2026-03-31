import { NextRequest, NextResponse } from "next/server";
import { getTransactions, addTransaction } from "@/lib/db";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || undefined;
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const seller_id = req.nextUrl.searchParams.get("seller_id");
  const transactions = await getTransactions({
    type, category,
    seller_id: seller_id ? Number(seller_id) : undefined,
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, amount, description, memo, category } = body;
  if (!type || !amount || !description || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const tx = await addTransaction({
    type, amount: Number(amount), description, memo: memo || null, category,
  });
  return NextResponse.json(tx, { status: 201 });
}
