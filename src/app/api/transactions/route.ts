import { NextRequest, NextResponse } from "next/server";
import { getTransactions, addTransaction } from "@/lib/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const date = searchParams.get("date") ?? undefined;

  const transactions = await getTransactions({ type, category, date });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { type, amount, description, category } = body;

  if (!type || amount == null || !description || !category) {
    return NextResponse.json(
      { error: "type, amount, description, and category are required" },
      { status: 400 }
    );
  }

  const transaction = await addTransaction({
    type,
    amount: Number(amount),
    description,
    memo: body.memo ?? null,
    category,
  });

  return NextResponse.json(transaction, { status: 201 });
}
