import { NextResponse } from "next/server";
import { getLoans, addLoan } from "@/lib/db";

export async function GET() {
  const loans = await getLoans();
  return NextResponse.json(loans);
}

export async function POST(request: Request) {
  const body = await request.json();
  const loan = await addLoan({
    person_name: body.person_name,
    phone_number: body.phone_number || null,
    original_amount: body.original_amount,
    loan_type: body.loan_type || "given",
    memo: body.memo || null,
  });
  return NextResponse.json(loan);
}
