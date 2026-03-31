import { NextRequest, NextResponse } from "next/server";
import { getPhones, addPhone } from "@/lib/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const phones = await getPhones(status);
  return NextResponse.json(phones);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { brand, model, condition, cost_price, selling_price } = body;

  if (!brand || !model || !condition || cost_price == null || selling_price == null) {
    return NextResponse.json(
      { error: "brand, model, condition, cost_price, and selling_price are required" },
      { status: 400 }
    );
  }

  const phone = await addPhone({
    brand,
    model,
    imei: body.imei ?? null,
    storage: body.storage ?? null,
    color: body.color ?? null,
    condition,
    cost_price: Number(cost_price),
    selling_price: Number(selling_price),
    memo: body.memo ?? null,
  });

  return NextResponse.json(phone, { status: 201 });
}
