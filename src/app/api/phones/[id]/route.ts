import { NextRequest, NextResponse } from "next/server";
import { getPhone, distributePhone, returnPhone, quickSellPhone, deletePhone, updatePhone } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const phone = await getPhone(Number(id));
  if (!phone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(phone);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  try {
    if (body.action === "distribute") {
      if (!body.seller_id) return NextResponse.json({ error: "seller_id required" }, { status: 400 });
      const phone = await distributePhone(Number(id), Number(body.seller_id));
      return NextResponse.json(phone);
    }
    if (body.action === "return") {
      const phone = await returnPhone(Number(id));
      return NextResponse.json(phone);
    }
    if (body.action === "quick_sell") {
      if (!body.price || !body.payment_method) {
        return NextResponse.json({ error: "price and payment_method required" }, { status: 400 });
      }
      const result = await quickSellPhone(Number(id), Number(body.price), body.payment_method);
      return NextResponse.json(result);
    }
    if (body.action === "update") {
      const phone = await updatePhone(Number(id), body);
      return NextResponse.json(phone);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deletePhone(Number(id));
  return new NextResponse(null, { status: 204 });
}
