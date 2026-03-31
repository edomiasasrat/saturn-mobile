import { NextRequest, NextResponse } from "next/server";
import { getPhones, addPhone } from "@/lib/db";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const seller_id = req.nextUrl.searchParams.get("seller_id");
  const phones = await getPhones({
    status: status || undefined,
    seller_id: seller_id ? Number(seller_id) : undefined,
  });
  return NextResponse.json(phones);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand, model, imei, storage, color, condition, cost_price, asking_price, memo } = body;
  if (!brand || !model || !condition || cost_price == null || asking_price == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const phone = await addPhone({
    brand, model, imei: imei || null, storage: storage || null,
    color: color || null, condition, cost_price: Number(cost_price),
    asking_price: Number(asking_price), memo: memo || null,
  });
  return NextResponse.json(phone, { status: 201 });
}
