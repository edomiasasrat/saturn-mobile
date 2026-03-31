import { NextRequest, NextResponse } from "next/server";
import { getPhone, sellPhone, deletePhone } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const phone = await getPhone(Number(id));
  if (!phone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(phone);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.action !== "sell") {
    return NextResponse.json({ error: "Invalid action. Expected action: \"sell\"" }, { status: 400 });
  }

  try {
    const result = await sellPhone(Number(id));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sell phone";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deletePhone(Number(id));
  return new NextResponse(null, { status: 204 });
}
