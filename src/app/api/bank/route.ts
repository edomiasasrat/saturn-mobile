import { NextRequest, NextResponse } from "next/server";
import { getBankEntries, getAllBankBalances, addBankEntry } from "@/lib/db";

export async function GET() {
  const [entries, balances] = await Promise.all([getBankEntries(), getAllBankBalances()]);
  return NextResponse.json({ entries, balances });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { type, amount } = body;

  if (!type || amount == null) {
    return NextResponse.json(
      { error: "type and amount are required" },
      { status: 400 }
    );
  }

  const entry = await addBankEntry({
    type,
    amount: Number(amount),
    memo: body.memo ?? null,
    bank_name: body.bank_name ?? null,
    currency: body.currency ?? "birr",
  });

  return NextResponse.json(entry, { status: 201 });
}
