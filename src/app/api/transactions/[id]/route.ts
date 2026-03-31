import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteTransaction(Number(id));
  return new NextResponse(null, { status: 204 });
}
