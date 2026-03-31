import { NextRequest, NextResponse } from "next/server";
import { getBankEntries, getBankBalance, addBankEntry } from "@/lib/db";

export async function GET() {
  const [entries, balance] = await Promise.all([getBankEntries(), getBankBalance()]);
  return NextResponse.json({ entries, balance });
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
  });

  return NextResponse.json(entry, { status: 201 });
}
