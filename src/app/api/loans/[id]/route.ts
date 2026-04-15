import { NextResponse } from "next/server";
import { getLoan, updateLoan, deleteLoan, addLoanPayment, getLoanPayments, adjustLoanAmount } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loan = await getLoan(Number(id));
  if (!loan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payments = await getLoanPayments(Number(id));
  return NextResponse.json({ loan, payments });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (body.action === "payment") {
    const payment = await addLoanPayment(Number(id), body.amount, body.memo || null);
    return NextResponse.json(payment);
  }

  if (body.action === "adjust") {
    const loan = await adjustLoanAmount(Number(id), body.remaining_amount);
    return NextResponse.json(loan);
  }

  // Default: update loan details
  const loan = await updateLoan(Number(id), {
    person_name: body.person_name,
    phone_number: body.phone_number,
    memo: body.memo,
  });
  return NextResponse.json(loan);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteLoan(Number(id));
  return NextResponse.json({ ok: true });
}
