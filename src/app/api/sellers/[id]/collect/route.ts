import { NextRequest, NextResponse } from "next/server";
import { collectPerPhone, collectLumpSum } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { mode, phone_ids, amount, payment_method, memo } = body;

  if (!payment_method || !["cash", "bank"].includes(payment_method)) {
    return NextResponse.json({ error: "payment_method must be cash or bank" }, { status: 400 });
  }

  try {
    if (mode === "per_phone") {
      if (!phone_ids || !Array.isArray(phone_ids) || phone_ids.length === 0) {
        return NextResponse.json({ error: "phone_ids required" }, { status: 400 });
      }
      const txs = await collectPerPhone(Number(id), phone_ids, payment_method, body.price_override);
      return NextResponse.json({ transactions: txs }, { status: 201 });
    } else if (mode === "lump_sum") {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "amount required" }, { status: 400 });
      }
      const tx = await collectLumpSum(Number(id), Number(amount), payment_method, memo || null);
      return NextResponse.json({ transaction: tx }, { status: 201 });
    }
    return NextResponse.json({ error: "mode must be per_phone or lump_sum" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
