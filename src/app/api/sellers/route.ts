import { NextRequest, NextResponse } from "next/server";
import { getSellers, addSeller } from "@/lib/db";

export async function GET() {
  const sellers = await getSellers();
  return NextResponse.json(sellers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone_number, location, memo } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const seller = await addSeller({
    name, phone_number: phone_number || null,
    location: location || null, memo: memo || null,
  });
  return NextResponse.json(seller, { status: 201 });
}
